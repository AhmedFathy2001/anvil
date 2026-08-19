// Barring someone from a clan — and only from that clan.
//
// The distinction this file exists to hold: a clan removing someone is a decision about ITS OWN
// roster, and it must not be able to reach further. Before this, the clan-side ban wrote
// `users.banned`, which verifyUser refuses a session on — so one clan's moderator signed a person
// out of every clan on the deployment. `players.banned` is the platform's level and is set only
// from /staff.
//
// A clan ban does three things and no more: removes the seat, blocks a new one, and is on the
// record. It takes nothing away from the person elsewhere — not their account, not their profile,
// not the history they built in this clan, which is the clan's record as much as theirs.

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanBans, clanMemberships, clanRoster } from '@/db/schema';

/** Is this person barred from this clan right now? */
export async function isBannedFromClan(clanId: number, playerId: number | null | undefined): Promise<boolean> {
  if (playerId == null) return false;
  const row = await db.query.clanBans.findFirst({
    where: and(eq(clanBans.clanId, clanId), eq(clanBans.playerId, playerId), isNull(clanBans.liftedAt)),
    columns: { id: true },
  });
  return row != null;
}

/**
 * Bar a person from a clan: record it, and empty their seats here.
 *
 * EVERY seat, not the one that prompted it. The ban is about the person, so leaving their alt on the
 * roster would make it decorative — and an alt is exactly how someone walks back in.
 */
export async function banFromClan(opts: {
  clanId: number;
  playerId: number;
  accountId?: number | null;
  reason?: string | null;
  byUserId: number;
}): Promise<{ ok: true; seatsCleared: number } | { ok: false; error: string }> {
  const already = await isBannedFromClan(opts.clanId, opts.playerId);
  if (already) return { ok: false, error: 'Already banned from this clan' };

  await db.insert(clanBans).values({
    clanId: opts.clanId,
    playerId: opts.playerId,
    accountId: opts.accountId ?? null,
    reason: opts.reason?.trim().slice(0, 500) || null,
    bannedByUserId: opts.byUserId,
  });

  const nowIso = new Date().toISOString();
  const seats = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(
      and(eq(clanRoster.clanId, opts.clanId), eq(clanRoster.playerId, opts.playerId), isNull(clanRoster.leftAt)),
    );

  for (const seat of seats) {
    // The seat is emptied, never deleted: completions, submissions and audit entries reference it,
    // and a clan's record of an event should not develop holes because someone was later removed.
    await db.update(clanMemberships).set({ leftAt: nowIso }).where(eq(clanMemberships.id, seat.id));
  }

  await db
    .insert(clanAuditLog)
    .values({
      clanId: opts.clanId,
      eventType: 'clan_banned',
      actorUserId: opts.byUserId,
      newValue: JSON.stringify({ playerId: opts.playerId, reason: opts.reason ?? null, seats: seats.length }),
      notes: 'barred from this clan only',
    })
    .catch(() => {});

  return { ok: true, seatsCleared: seats.length };
}

/** Lift it. Does not restore the seat — coming back is a fresh join, which is the clan's call. */
export async function liftClanBan(clanId: number, playerId: number, byUserId: number): Promise<boolean> {
  const [row] = await db
    .update(clanBans)
    .set({ liftedAt: new Date().toISOString(), liftedByUserId: byUserId })
    .where(and(eq(clanBans.clanId, clanId), eq(clanBans.playerId, playerId), isNull(clanBans.liftedAt)))
    .returning();
  if (!row) return false;

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'clan_unbanned',
      actorUserId: byUserId,
      newValue: JSON.stringify({ playerId }),
    })
    .catch(() => {});
  return true;
}

/** Everyone currently barred from this clan, for the staff list. */
export async function liveClanBans(clanId: number) {
  return db
    .select()
    .from(clanBans)
    .where(and(eq(clanBans.clanId, clanId), isNull(clanBans.liftedAt)));
}
