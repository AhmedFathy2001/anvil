// Barring someone from a clan — and only from that clan.
//
// The distinction this file exists to hold: a clan removing someone is a decision about ITS OWN
// roster, and it must not be able to reach further. Before this, the clan-side ban wrote
// `users.banned`, which verifyUser refuses a session on — so one clan's moderator signed a person
// out of every clan on the deployment. `players.banned` is the platform's level and is set only
// from /staff.
//
// A clan ban does four things and no more: removes the seat, removes any staff job they held IN
// THIS CLAN (a banned moderator must not keep moderating), blocks a new seat, and is on the record. It takes nothing away from the person elsewhere — not their account, not their profile,
// not the history they built in this clan, which is the clan's record as much as theirs.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { rankOf } from '@/lib/clanRoles';
import { clanAuditLog, clanBans, clanMemberships, clanRoster, clanStaff, eventEditors, events, users } from '@/db/schema';

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
 * The highest clan role any of this person's logins holds in this clan ('member' when none).
 *
 * A ban is on the PERSON, so the rank check before one (never ban someone at or above you) has to
 * see every login they sign in with, not just the one a row happened to name.
 */
export async function highestClanRoleOfPerson(clanId: number, playerId: number): Promise<string> {
  const rows = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), eq(users.playerId, playerId)));
  return rows.map((r) => r.role).sort((a, b) => rankOf(b) - rankOf(a))[0] ?? 'member';
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

  // Every login this person signs in with. Grants are held by a login; the ban is on the person.
  const logins = (
    await db.select({ id: users.id }).from(users).where(eq(users.playerId, opts.playerId))
  ).map((u) => u.id);
  const staffRows = logins.length
    ? await db
        .select({ userId: clanStaff.userId, role: clanStaff.role })
        .from(clanStaff)
        .where(and(eq(clanStaff.clanId, opts.clanId), inArray(clanStaff.userId, logins)))
    : [];
  // The routes refuse this first; here as well because a ban strips staff rows, and the owner's is
  // the one row that only a transfer may move.
  if (staffRows.some((r) => r.role === 'owner')) return { ok: false, error: 'The clan owner cannot be banned' };

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
    // A pre-assigned role goes with it: lifting the ban and rejoining must not hand it back.
    await db.update(clanMemberships).set({ leftAt: nowIso, pendingRole: null }).where(eq(clanMemberships.id, seat.id));
  }

  // Their authority HERE, and only here. Staff rows in other clans, and board grants on other clans'
  // events, are those clans' decisions and are left alone.
  const boardGrants = logins.length
    ? await db
        .select({ id: eventEditors.id, userId: eventEditors.userId, eventId: eventEditors.eventId, role: eventEditors.role })
        .from(eventEditors)
        .innerJoin(events, eq(events.id, eventEditors.eventId))
        .where(and(eq(events.clanId, opts.clanId), inArray(eventEditors.userId, logins)))
    : [];
  if (staffRows.length) {
    await db
      .delete(clanStaff)
      .where(and(eq(clanStaff.clanId, opts.clanId), inArray(clanStaff.userId, staffRows.map((r) => r.userId))));
  }
  if (boardGrants.length) {
    await db.delete(eventEditors).where(inArray(eventEditors.id, boardGrants.map((g) => g.id)));
  }
  if (staffRows.length || boardGrants.length) {
    await db
      .insert(clanAuditLog)
      .values({
        clanId: opts.clanId,
        eventType: 'staff_removed_on_ban',
        actorUserId: opts.byUserId,
        oldValue: JSON.stringify({
          playerId: opts.playerId,
          roles: staffRows.map((r) => ({ userId: r.userId, role: r.role })),
          boards: boardGrants.map((g) => ({ userId: g.userId, eventId: g.eventId, role: g.role })),
        }),
        notes: 'staff job and board grants in this clan removed by the ban',
      })
      .catch(() => {});
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
