// Letting go of a character — one flow behind two buttons.
//
// The profile's "Remove" (DELETE /api/profile/accounts/[id]) and the plugin's "Not my account"
// (POST /api/plugin/account 'release') are the same act: this login no longer claims the character.
// Ownership is detached, not deleted — the seat and its history stay, so the real owner's plugin can
// pick it up, and the person who let go sees it under Ignored on their profile, one click from
// re-adding it. Their proof does not stay (see releaseCharacter).

import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster, detectedAccounts, eventParticipants, events, players } from '@/db/schema';
import { findRosterSeats } from '@/lib/roster';

export type ReleaseOutcome = { ok: true } | { ok: false; reason: 'not-found' | 'live-event' };

export const LIVE_EVENT_RELEASE_MESSAGE =
  'This account is in an active event — you can remove it once the event ends.';

/** Is any of these seats on a board that has not ended? Upcoming boards count, as on the profile. */
async function seatsInLiveEvent(seatIds: number[], nowIso: string): Promise<boolean> {
  if (seatIds.length === 0) return false;
  // clan-scope: global -- the subject is one CHARACTER's own seats, which span clans by design.
  const rows = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(
      and(
        inArray(eventParticipants.clanMemberId, seatIds),
        isNull(events.forceEndedAt),
        or(isNull(events.endDate), gt(events.endDate, nowIso)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Remember that this login let go of (or never wanted) this character, so the plugin's
 * auto-link-on-play leaves it alone. Shows in the profile's Ignored list, re-addable there.
 */
export async function markCharacterIgnored(
  userId: number,
  rsn: string,
  rsnNormalized: string,
  accountHash: string | null,
  nowIso: string,
): Promise<void> {
  const marker = await db.query.detectedAccounts.findFirst({
    where: and(eq(detectedAccounts.userId, userId), eq(detectedAccounts.rsnNormalized, rsnNormalized)),
  });
  if (marker) {
    await db
      .update(detectedAccounts)
      .set({ status: 'dismissed', rsn, accountHash: accountHash ?? marker.accountHash, lastSeenAt: nowIso })
      .where(eq(detectedAccounts.id, marker.id));
    return;
  }
  await db
    .insert(detectedAccounts)
    .values({ userId, rsn, rsnNormalized, accountHash, status: 'dismissed', detectedAt: nowIso, lastSeenAt: nowIso })
    .onConflictDoNothing();
}

/** Undo {@link markCharacterIgnored}: the next play links it again, exactly as before. */
export async function unmarkCharacterIgnored(userId: number, rsnNormalized: string): Promise<void> {
  await db
    .delete(detectedAccounts)
    .where(
      and(
        eq(detectedAccounts.userId, userId),
        eq(detectedAccounts.rsnNormalized, rsnNormalized),
        eq(detectedAccounts.status, 'dismissed'),
      ),
    );
}

/**
 * Detach `accountId` from `playerId` (the person behind `userId`).
 *
 * Refused while ANY of the character's seats is on a live or upcoming board: unclaiming is global,
 * so a seat in another clan's event would lose its owner just the same.
 */
export async function releaseCharacter(input: {
  userId: number;
  playerId: number;
  accountId: number;
  nowIso?: string;
  via: 'profile' | 'plugin';
}): Promise<ReleaseOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.playerId, input.playerId)))
    .limit(1);
  if (!account) return { ok: false, reason: 'not-found' };

  // clan-scope: global -- one CHARACTER's seats in every clan; unclaiming it is global too.
  const seats = await findRosterSeats(eq(clanRoster.accountId, account.id));
  if (await seatsInLiveEvent(seats.map((s) => s.id), nowIso)) return { ok: false, reason: 'live-event' };
  const anySeat = seats.find((s) => s.leftAt == null) ?? seats[0];

  // Back to a placeholder person of its own, and UNCLAIMED. The profile's Remove used to stop at
  // the person swap (unclaimAccountOfSeat) and leave `claimedAt` set, so the placeholder "owned" it:
  // every later claim — the real owner's plugin included — was refused as owned-by-other, and the
  // character could never move again.
  //
  // The proof goes with the owner: it was THEIR proof. Left behind, a verified-but-unclaimed account
  // is "established", and the hash path hands an established account to whoever presents its hash —
  // non-provisionally. That is a laundering route for a first-use claim, whose hash is whatever the
  // claiming client sent: claim by name with a made-up hash, release, then claim it verified from a
  // second login with the same made-up hash. So a first-use hash is dropped too (as staff detach
  // does). A hash anchored any other way came from a client really logged into the character, and
  // stays — on a roster member that is what lets the real owner's plugin pick it straight back up,
  // and what keeps a name-only claimant out.
  const [placeholder] = await db.insert(players).values({ displayName: account.rsn }).returning({ id: players.id });
  await db
    .update(accounts)
    .set({
      playerId: placeholder.id,
      isPrimary: 0,
      claimedAt: null,
      provisional: 0,
      verifiedAt: null,
      verificationMethod: null,
      verifiedByUserId: null,
      ...(account.verificationMethod === 'plugin_first_use' ? { accountHash: null } : {}),
    })
    .where(eq(accounts.id, account.id));

  await markCharacterIgnored(input.userId, account.rsn, account.rsnNormalized, account.accountHash ?? null, nowIso);

  // If we just removed the primary, promote another owned account so the person still has one.
  if (account.isPrimary === 1) {
    // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to theirs via playerId.
    const [next] = await db
      .select()
      .from(clanRoster)
      .where(and(eq(clanRoster.playerId, input.playerId), isNull(clanRoster.leftAt)))
      .orderBy(desc(clanRoster.verifiedAt))
      .limit(1);
    if (next) await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, next.accountId));
  }

  if (anySeat) {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: anySeat.id,
        eventType: 'unclaimed',
        oldValue: JSON.stringify({ userId: input.userId, rsn: account.rsn, via: input.via }),
        actorUserId: input.userId,
      })
      .catch(() => {});
  }
  return { ok: true };
}
