import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, detectedAccounts, users } from '@/db/schema';
import { avatarUrl } from '@/lib/discord-oauth';
import { claimAccountForPerson } from '@/lib/accountClaim';

/**
 * Mod-approve: the other way an unclaimed roster member links, when self-verify is a poor fit.
 *
 * Closing the takeover means a public RSN can no longer auto-claim an established member — the person
 * must prove control (XP-delta) or a moderator must vouch. This is the vouch. It exists because a mod
 * knows their own members: "yes, that's John, our Hells Taco" is a judgement a name-match cannot make
 * but a human can, and it saves a member who has no time to go and train from being stuck.
 *
 * A request is a `detected_accounts` suggestion — "we saw this PERSON play as this RSN" — whose RSN
 * matches an unclaimed member seat in the mod's clan. The suggestion is the same artifact the plugin
 * path already raises when it refuses to auto-claim; this just makes it visible to staff and gives
 * them one button. Approving binds the account to the requesting person with the mod as the vouch;
 * the mod's own eyes are the proof, so it bypasses the hash/XP gate — which is exactly what "a
 * moderator may vouch" means, and why the identity shown has to be the RIGHT person (see the join).
 */

export interface ClaimRequest {
  /** The detected_accounts row id — what the approve/reject action addresses. */
  id: number;
  rsn: string;
  /** The clan member seat being claimed, and its account. */
  seatId: number;
  accountId: number;
  /** Who is asking — the requester's Discord identity, for the mod to recognise or not. */
  requester: {
    userId: number;
    playerId: number | null;
    displayName: string | null;
    discordUsername: string | null;
    avatarUrl: string | null;
  };
  requestedAt: string;
}

/**
 * Every pending claim on an unclaimed, established member of THIS clan.
 *
 * The suggestion carries a login (`detected_accounts.user_id`); the requester's identity is read by
 * joining that login to `users` on its own primary key — NOT the person id, which is the mistake the
 * needs-review page made. A person id here would show an unrelated human, and this whole surface is a
 * mod looking at a face to decide if a claim is real.
 */
export async function pendingClaimRequests(clanId: number): Promise<ClaimRequest[]> {
  const rows = await db
    .select({
      id: detectedAccounts.id,
      rsn: detectedAccounts.rsn,
      requestedAt: detectedAccounts.lastSeenAt,
      seatId: clanMemberships.id,
      accountId: accounts.id,
      userId: users.id,
      playerId: users.playerId,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      discordAvatar: users.discordAvatar,
    })
    .from(detectedAccounts)
    // The account this RSN names, and its seat IN THIS CLAN. Both joins are the point of the surface:
    // a suggestion only becomes a "claim request" when its name matches a real seat here.
    .innerJoin(accounts, eq(accounts.rsnNormalized, detectedAccounts.rsnNormalized))
    .innerJoin(
      clanMemberships,
      and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId)),
    )
    .innerJoin(users, eq(users.id, detectedAccounts.userId))
    .where(
      and(
        eq(detectedAccounts.status, 'pending'),
        isNull(clanMemberships.leftAt),
        // Established and UNCLAIMED — the exact rows the gate refuses to auto-claim. A claimed
        // account is settled; a bare guest is not something a mod needs to adjudicate.
        eq(clanMemberships.kind, 'member'),
        isNull(accounts.claimedAt),
      ),
    )
    .orderBy(desc(detectedAccounts.lastSeenAt));

  return rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
    seatId: r.seatId,
    accountId: r.accountId,
    requester: {
      userId: r.userId,
      playerId: r.playerId,
      displayName: r.displayName,
      discordUsername: r.discordUsername,
      avatarUrl: avatarUrl(r.discordId ?? '', r.discordAvatar),
    },
    requestedAt: r.requestedAt,
  }));
}

export type ApproveOutcome =
  | { ok: true; accountId: number }
  | { ok: false; code: 'not_found' | 'no_person' | 'owned_by_other'; error: string };

/**
 * Approve one claim request: bind the member's account to the requesting person, vouched by `modUserId`.
 *
 * Re-checked against the clan at approve time, not trusted from the id — a request only clears if it
 * still names an unclaimed member seat in this clan the instant the mod acts, so a race (the member
 * self-verified in between, an admin removed the seat) resolves cleanly instead of writing a stale
 * decision.
 */
export async function approveClaimRequest(
  clanId: number,
  requestId: number,
  modUserId: number,
): Promise<ApproveOutcome> {
  const [req] = await pendingByIdInClan(clanId, requestId);
  if (!req) return { ok: false, code: 'not_found', error: 'That request is no longer open.' };

  const [requester] = await db
    .select({ playerId: users.playerId, rsnNormalized: detectedAccounts.rsnNormalized, rsn: detectedAccounts.rsn, accountHash: detectedAccounts.accountHash })
    .from(detectedAccounts)
    .innerJoin(users, eq(users.id, detectedAccounts.userId))
    .where(eq(detectedAccounts.id, requestId));
  if (!requester?.playerId) {
    return { ok: false, code: 'no_person', error: 'That account has no person to attach to.' };
  }

  const claim = await claimAccountForPerson({
    playerId: requester.playerId,
    rsn: requester.rsn,
    rsnNormalized: requester.rsnNormalized,
    accountHash: requester.accountHash,
    // The mod is the proof, so this is a confirmed link, not a provisional one awaiting a second look.
    method: 'manual',
    provisional: false,
    verifiedByUserId: modUserId,
    actorUserId: modUserId,
  });
  if (!claim.ok) {
    return { ok: false, code: 'owned_by_other', error: claim.error };
  }

  await db.update(detectedAccounts).set({ status: 'dismissed' }).where(eq(detectedAccounts.id, requestId));

  db.insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'claim_request_approved',
      actorUserId: modUserId,
      newValue: JSON.stringify({ requestId, accountId: claim.accountId, playerId: requester.playerId }),
      notes: 'mod vouch',
    })
    .catch(() => {});

  return { ok: true, accountId: claim.accountId };
}

/** Reject: the suggestion is dismissed, nothing is bound. The requester can still self-verify by XP. */
export async function rejectClaimRequest(
  clanId: number,
  requestId: number,
  modUserId: number,
): Promise<{ ok: boolean }> {
  const [req] = await pendingByIdInClan(clanId, requestId);
  if (!req) return { ok: false };
  await db.update(detectedAccounts).set({ status: 'dismissed' }).where(eq(detectedAccounts.id, requestId));
  db.insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'claim_request_rejected',
      actorUserId: modUserId,
      newValue: JSON.stringify({ requestId }),
    })
    .catch(() => {});
  return { ok: true };
}

/** One pending request, re-verified to still name an unclaimed member seat in this clan. */
async function pendingByIdInClan(clanId: number, requestId: number) {
  return db
    .select({ id: detectedAccounts.id })
    .from(detectedAccounts)
    .innerJoin(accounts, eq(accounts.rsnNormalized, detectedAccounts.rsnNormalized))
    .innerJoin(
      clanMemberships,
      and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId)),
    )
    .where(
      and(
        eq(detectedAccounts.id, requestId),
        eq(detectedAccounts.status, 'pending'),
        isNull(clanMemberships.leftAt),
        eq(clanMemberships.kind, 'member'),
        isNull(accounts.claimedAt),
      ),
    )
    .limit(1);
}
