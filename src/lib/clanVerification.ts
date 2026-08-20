// Proving a clan is the clan it says it is.
//
// The in-game name is the only thing tying a site to a real OSRS clan, and until now anybody could
// type any name into a settings field. Nothing stopped someone claiming a well-known clan's name and
// standing up a site that looked official — impersonation rather than a naming clash.
//
// HOW THE PROOF WORKS. The roster payload is self-attesting: the plugin reads the clan member list
// from the game, and the person pushing it appears in that list with their rank. So the server can
// ask a question only a real member could pass — "are you in the roster you just sent me, holding an
// owner-tier rank?" — without needing anything the client could not already have.
//
// WHAT IT IS NOT. This is practical proof, not cryptographic. A modified client can send whatever it
// likes, and saying otherwise in the code would be worse than the limitation itself. What backs it:
//
//   - first claim wins, so the name is taken before an impersonator arrives rather than after
//   - the account hash is unforgeable, so a claim names a specific Jagex account
//   - a second claim is refused and escalates to a human rather than silently losing
//
// It raises the cost from "type a name" to "control an account with an owner rank in that clan, or
// modify your client", and gives the real owners a place to complain. That is the honest claim.

import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { isOwnerTierRank } from '@/lib/ingameRanks';

export { isOwnerTierRank } from '@/lib/ingameRanks';

export interface VerificationState {
  inGameName: string | null;
  verified: boolean;
  verifiedAt: string | null;
  claimedByAccountId: number | null;
}

export async function verificationOf(clanId: number): Promise<VerificationState> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  return {
    inGameName: row?.inGameName ?? null,
    verified: row?.ingameNameVerifiedAt != null,
    verifiedAt: row?.ingameNameVerifiedAt ?? null,
    claimedByAccountId: row?.ingameNameClaimedByAccountId ?? null,
  };
}

export type ClaimResult =
  | { outcome: 'verified'; inGameName: string }
  /** Already this clan's. Nothing to do. */
  | { outcome: 'already' }
  /** Another clan verified this name first. A human decides. */
  | { outcome: 'taken'; byClanSlug: string }
  /** The pusher is in the roster but not senior enough. */
  | { outcome: 'not-owner'; rank: string | null }
  /** The pusher is not in the roster they sent, which is the one thing a real member cannot be. */
  | { outcome: 'not-in-roster' };

/**
 * Try to bind an in-game name to a clan, from a roster push.
 *
 * Called on every sync and expected to say `already` almost every time — verification is a one-off
 * that happens on some ordinary Tuesday, not a ceremony anyone performs.
 */
export async function claimFromRoster(opts: {
  clanId: number;
  /** The name the plugin read out of the game. */
  reportedClanName: string;
  /** The account doing the pushing. */
  pusherRsnNormalized: string | null;
  pusherAccountId: number | null;
  /** The roster as sent: every member, with the rank the game gave them. */
  roster: { rsnNormalized: string; rank: string | null }[];
}): Promise<ClaimResult> {
  const name = opts.reportedClanName.trim();
  if (!name) return { outcome: 'not-in-roster' };

  const current = await verificationOf(opts.clanId);
  if (current.verified) return { outcome: 'already' };

  // Somebody else got there first. Refused rather than merged: two clans cannot both be the same
  // in-game clan, and picking one automatically would be picking a side in a dispute.
  const taken = await db.query.clans.findFirst({
    where: and(
      sql`lower(${clans.inGameName}) = ${name.toLowerCase()}`,
      isNotNull(clans.ingameNameVerifiedAt),
      ne(clans.id, opts.clanId),
    ),
  });
  if (taken) return { outcome: 'taken', byClanSlug: taken.slug };

  // The question only a real member passes: are you in the list you just sent?
  const me = opts.pusherRsnNormalized
    ? opts.roster.find((r) => r.rsnNormalized === opts.pusherRsnNormalized)
    : undefined;
  if (!me) return { outcome: 'not-in-roster' };
  if (!isOwnerTierRank(me.rank)) return { outcome: 'not-owner', rank: me.rank };

  const nowIso = new Date().toISOString();
  await db
    .update(clans)
    .set({
      inGameName: name,
      ingameNameVerifiedAt: nowIso,
      ingameNameClaimedByAccountId: opts.pusherAccountId,
    })
    .where(eq(clans.id, opts.clanId));

  await db
    .insert(clanAuditLog)
    .values({
      clanId: opts.clanId,
      eventType: 'ingame_name_verified',
      newValue: JSON.stringify({ inGameName: name, rank: me.rank, accountId: opts.pusherAccountId }),
      notes: 'roster pushed by an owner-tier account',
    })
    .catch(() => {});

  return { outcome: 'verified', inGameName: name };
}

/**
 * Verified by an operator, for the cases the automatic path cannot reach: a clan whose owner rank is
 * renamed, one whose owner has left the game, or a dispute resolved in someone's favour.
 *
 * Platform-side only — see /api/staff. A clan verifying itself would be the whole point missed.
 */
export async function verifyManually(
  clanId: number,
  inGameName: string,
  byUserId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = inGameName.trim();
  if (!name) return { ok: false, error: 'Give the in-game clan name' };

  const taken = await db.query.clans.findFirst({
    where: and(
      sql`lower(${clans.inGameName}) = ${name.toLowerCase()}`,
      isNotNull(clans.ingameNameVerifiedAt),
      ne(clans.id, clanId),
    ),
  });
  if (taken) return { ok: false, error: `"${name}" is already verified for ${taken.slug}` };

  await db
    .update(clans)
    .set({ inGameName: name, ingameNameVerifiedAt: new Date().toISOString() })
    .where(eq(clans.id, clanId));

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'ingame_name_verified',
      actorUserId: byUserId,
      newValue: JSON.stringify({ inGameName: name }),
      notes: 'verified by platform staff',
    })
    .catch(() => {});

  return { ok: true };
}

/** Withdraw a badge — a dispute resolved the other way, or a claim that turned out to be false. */
export async function unverify(clanId: number, byUserId: number, reason?: string | null): Promise<void> {
  await db
    .update(clans)
    .set({ ingameNameVerifiedAt: null, ingameNameClaimedByAccountId: null })
    .where(eq(clans.id, clanId));

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'ingame_name_unverified',
      actorUserId: byUserId,
      newValue: JSON.stringify({ reason: reason ?? null }),
      notes: 'badge withdrawn by platform staff',
    })
    .catch(() => {});
}
