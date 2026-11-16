// Applying to a clan with a character you have only NAMED so far.
//
// The clan page lets a person type their in-game name and apply in one step, choosing how they will
// confirm it: the plugin, or the XP check. Neither has happened yet, so nothing is granted and staff
// are not asked anything: the application is kept as a clan_join_requests row with the status
// `awaiting-proof`, which no queue reads. The moment that same person proves that same character
// (lib/accountClaim), it goes through the clan's ordinary door (`admit`), exactly as if they had
// pressed Apply with a proven character: a guest seat at once, or a request for staff where staff
// removed them before; refused where the clan is closed or has barred them.
//
// (Asking staff to vouch is the third choice and needs none of this: it files its request at once,
// /api/auth/request-manual-review.)

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanJoinRequests, clanMemberships, clans, userNotices, users } from '@/db/schema';
import { doorPolicy } from '@/lib/characterState';
import { admit, removedByStaff } from '@/lib/guestAdmission';
import { findOrCreateAccount } from '@/lib/roster';

export const AWAITING_PROOF = 'awaiting-proof';
export type ApplyVia = 'plugin' | 'xp';

/** Is this name on the clan's in-game member list, and not yet linked to anyone? */
export async function onInGameList(clanId: number, rsnNormalized: string): Promise<boolean> {
  const rows = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.kind, 'member'),
        eq(clanMemberships.source, 'roster'),
        isNull(clanMemberships.leftAt),
        eq(accounts.rsnNormalized, rsnNormalized),
        isNull(accounts.claimedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Keep the application until the character is proved. One per person per clan: a new name replaces the old. */
export async function fileApplyIntent(opts: { clanId: number; playerId: number; rsn: string; rsnNormalized: string; via: ApplyVia }): Promise<void> {
  const account = await findOrCreateAccount({ rsn: opts.rsn, rsnNormalized: opts.rsnNormalized });
  await db
    .delete(clanJoinRequests)
    .where(and(eq(clanJoinRequests.clanId, opts.clanId), eq(clanJoinRequests.playerId, opts.playerId), eq(clanJoinRequests.status, AWAITING_PROOF)));
  await db.insert(clanJoinRequests).values({
    clanId: opts.clanId,
    accountId: account.id,
    playerId: opts.playerId,
    status: AWAITING_PROOF,
    source: 'web',
    message: `via:${opts.via}`,
  });
}

/** The application this person has waiting on proof at this clan, for their own page. */
export async function applyIntentOf(clanId: number, playerId: number): Promise<{ rsn: string; via: ApplyVia } | null> {
  const [row] = await db
    .select({ rsn: accounts.rsn, message: clanJoinRequests.message })
    .from(clanJoinRequests)
    .innerJoin(accounts, eq(accounts.id, clanJoinRequests.accountId))
    .where(and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.playerId, playerId), eq(clanJoinRequests.status, AWAITING_PROOF)))
    .limit(1);
  return row ? { rsn: row.rsn, via: row.message === 'via:xp' ? 'xp' : 'plugin' } : null;
}

/**
 * This person has just PROVED this character: carry out what they applied for while it was only a
 * name. Called after every proven claim; with nothing waiting it is one indexed read.
 */
export async function completeApplyIntents(playerId: number, accountId: number): Promise<void> {
  const waiting = await db
    .select()
    .from(clanJoinRequests)
    .where(and(eq(clanJoinRequests.playerId, playerId), eq(clanJoinRequests.accountId, accountId), eq(clanJoinRequests.status, AWAITING_PROOF)));
  for (const intent of waiting) {
    const admission = await admit({
      clanId: intent.clanId,
      accountId,
      source: 'web',
      message: 'Applied from the clan’s page.',
      policy: doorPolicy({ removedByStaff: await removedByStaff(intent.clanId, accountId) }),
    });
    const now = new Date().toISOString();
    await db
      .update(clanJoinRequests)
      .set({ status: admission.outcome === 'seated' ? 'approved' : 'withdrawn', decidedAt: now })
      .where(eq(clanJoinRequests.id, intent.id));
    if (admission.outcome !== 'seated') continue;
    // Tell them on the site (the bell, and Settings > Characters). The clan's name and theirs only.
    const [clan] = await db.select({ name: clans.name }).from(clans).where(eq(clans.id, intent.clanId));
    const [acct] = await db.select({ rsn: accounts.rsn }).from(accounts).where(eq(accounts.id, accountId));
    const logins = await db.select({ id: users.id }).from(users).where(eq(users.playerId, playerId));
    if (clan && acct && logins.length > 0) {
      await db.insert(userNotices).values(
        logins.map((l) => ({
          userId: l.id,
          kind: 'seat-granted',
          refId: admission.seatId,
          title: `You’re in ${clan.name}`,
          body: `${acct.rsn} is confirmed, so your application went through: you are a guest of ${clan.name} and can sign up for its events.`,
          createdAt: now,
        })),
      );
    }
  }
}
