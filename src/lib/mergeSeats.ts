import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, clanRoster, eventParticipants, eventSignups, signupFees, weeklyParticipants } from '@/db/schema';
import { findRosterSeat, loginOf } from '@/lib/roster';
import { mergeEmptyPersonInto } from '@/lib/mergePeople';

export type MergeSeatsResult =
  | { ok: true; targetId: number; mergedRsn: string; rsn: string }
  | { ok: false; status: 404 | 409; error: string };

function parsePrevious(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Fold one seat of a clan into another: the same OSRS account seen twice, almost always a rename
 * clan-sync could only see as "X left, Y joined" (it matches by name — there is no hash to anchor on).
 *
 * The TARGET seat survives and keeps the history; the source's history moves onto it. But the
 * surviving NAME, rank and presence come from whichever side the in-game roster still lists. The old
 * code kept the target's name unconditionally, so picking the pair the wrong way round left the old
 * name standing as a "left" row, and the very next sync re-created the new name as a fresh ranked
 * member — two rows again, one ranked, one not.
 *
 * Both seats must belong to `clanId`.
 */
export async function mergeSeats(input: {
  clanId: number;
  sourceId: number;
  targetId: number;
  actorUserId: number | null;
  note?: string | null;
}): Promise<MergeSeatsResult> {
  const { clanId, sourceId, targetId, actorUserId } = input;
  const [source, target] = await Promise.all([
    findRosterSeat(and(eq(clanRoster.id, sourceId), eq(clanRoster.clanId, clanId))),
    findRosterSeat(and(eq(clanRoster.id, targetId), eq(clanRoster.clanId, clanId))),
  ]);
  if (!source || !target) return { ok: false, status: 404, error: 'Source or target not found' };

  // Refuse if both are actively claimed by different users — that's a real conflict that
  // needs the users involved to resolve, not an admin merge.
  if (source.claimedAt && target.claimedAt && source.playerId !== target.playerId) {
    return { ok: false, status: 409, error: 'Both records are claimed by different users. Resolve ownership before merging.' };
  }

  // The side the in-game roster still lists is the account's current identity. Both or neither
  // listed: the target, as the caller chose.
  const current = target.leftAt == null || source.leftAt != null ? target : source;

  // The surviving identity's owner: at most one side is claimed (the conflict guard above), so this
  // is unambiguous. Every account has a placeholder person, so playerId alone does not say which
  // side has a human owner. Prefer the CLAIMED side; otherwise keep the target placeholder.
  const finalOwner = target.claimedAt
    ? target.playerId
    : source.claimedAt
      ? source.playerId
      : target.playerId ?? source.playerId ?? null;
  const finalLogin = await loginOf(finalOwner);

  // Move references off of source.
  await db.update(eventParticipants).set({ clanMemberId: targetId }).where(eq(eventParticipants.clanMemberId, sourceId));
  await db.update(weeklyParticipants).set({ clanMemberId: targetId }).where(eq(weeklyParticipants.clanMemberId, sourceId));
  await db.update(clanAuditLog).set({ clanMemberId: targetId }).where(eq(clanAuditLog.clanMemberId, sourceId));

  // Event sign-ups: carry the source's sign-ups over to the target, deduping on the
  // (event_id, clan_member_id) unique index. FK enforcement can't be relied on to cascade
  // signup_fees, so a dropped duplicate sign-up takes its fee with it explicitly.
  const sourceSignups = await db
    .select({ id: eventSignups.id, eventId: eventSignups.eventId, userId: eventSignups.userId })
    .from(eventSignups)
    .where(eq(eventSignups.clanMemberId, sourceId));
  if (sourceSignups.length) {
    const targetEventIds = new Set(
      (
        await db
          .select({ eventId: eventSignups.eventId })
          .from(eventSignups)
          .where(eq(eventSignups.clanMemberId, targetId))
      ).map((r) => r.eventId),
    );
    for (const s of sourceSignups) {
      if (targetEventIds.has(s.eventId)) {
        await db.delete(signupFees).where(eq(signupFees.signupId, s.id));
        await db.delete(eventSignups).where(eq(eventSignups.id, s.id));
      } else {
        await db
          .update(eventSignups)
          // event_signups.user_id names a LOGIN; finalOwner is a PERSON.
          .set({ clanMemberId: targetId, userId: s.userId ?? finalLogin })
          .where(eq(eventSignups.id, s.id));
        targetEventIds.add(s.eventId);
      }
    }
  }

  // Drop the losing SEAT, and the account behind it only if no other clan is still seating it —
  // a merge inside one clan has no business removing an account another clan still rosters.
  //
  // BEFORE the account update below: rsn_normalized and account_hash are unique across accounts,
  // so the survivor can only take the source's name or hash once the source account is gone. The
  // old order tripped the hash index whenever the source was the plugin-linked side — exactly the
  // renamed player's old row — and the merge failed.
  await db.delete(clanMemberships).where(eq(clanMemberships.id, sourceId));
  let sourceAccountGone = source.accountId === target.accountId;
  if (!sourceAccountGone) {
    // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
    const stillSeated = await db
      .select({ id: clanMemberships.id })
      .from(clanMemberships)
      .where(eq(clanMemberships.accountId, source.accountId))
      .limit(1);
    if (stillSeated.length === 0) {
      await db.delete(accounts).where(eq(accounts.id, source.accountId));
      sourceAccountGone = true;
    }
  }

  // Another clan still seats the source account: its name and hash stay with it.
  const identity = current === source && !sourceAccountGone ? target : current;
  const previous = Array.from(
    new Set(
      [...parsePrevious(target.previousRsns), ...parsePrevious(source.previousRsns), source.rsn, target.rsn]
        .filter((n): n is string => Boolean(n) && n !== identity.rsn),
    ),
  );

  // Promote any source-side fields the target is missing. All of these describe the account.
  await db
    .update(accounts)
    .set({
      rsn: identity.rsn,
      rsnNormalized: identity.rsnNormalized,
      previousRsns: previous.length ? JSON.stringify(previous) : null,
      accountHash: target.accountHash ?? (sourceAccountGone ? source.accountHash : null),
      playerId: finalOwner ?? target.playerId ?? source.playerId ?? undefined,
      isPrimary: target.isPrimary === 1 || source.isPrimary === 1 ? 1 : 0,
      verifiedAt: target.verifiedAt ?? source.verifiedAt,
      verificationMethod: target.verificationMethod ?? source.verificationMethod,
      verifiedByUserId: target.verifiedByUserId ?? source.verifiedByUserId,
      provisional: target.claimedAt ? target.provisional : source.provisional,
      claimedAt: target.claimedAt ?? source.claimedAt,
    })
    .where(eq(accounts.id, target.accountId));

  // The seat takes the roster's view of whichever side is current, so the next sync matches it
  // by name instead of re-seating the new name as a stranger.
  if (current === source) {
    await db
      .update(clanMemberships)
      .set({
        kind: source.kind,
        rank: source.rank,
        source: source.source,
        leftAt: source.leftAt,
        lastSeenInClan: source.lastSeenInClan,
      })
      .where(eq(clanMemberships.id, targetId));
  }

  // Keep event/weekly display names on the surviving name.
  await db.update(eventParticipants).set({ name: identity.rsn }).where(eq(eventParticipants.clanMemberId, targetId));

  // The account merge can empty either placeholder: normally the source account is deleted, but a
  // claimed source also moves the target account onto the source's person. Preserve any person-level
  // history and remove only rows that now hold neither an account nor a login.
  if (finalOwner != null) {
    for (const priorOwner of new Set([source.playerId, target.playerId])) {
      if (priorOwner != null && priorOwner !== finalOwner) {
        await mergeEmptyPersonInto(priorOwner, finalOwner, actorUserId);
      }
    }
  }

  // Audit the merge against the surviving target so history stays attached.
  db.insert(clanAuditLog)
    .values({
      clanMemberId: targetId,
      eventType: 'merged',
      oldValue: JSON.stringify({ mergedFromMemberId: sourceId, mergedFromRsn: source.rsn }),
      newValue: JSON.stringify({ intoMemberId: targetId, rsn: identity.rsn }),
      actorUserId,
      notes: input.note || null,
    })
    .catch(() => {});

  return { ok: true, targetId, mergedRsn: source.rsn, rsn: identity.rsn };
}
