// Proving a clan is the clan it says it is.
//
// The in-game name is the only thing tying a site to a real OSRS clan, and until now anybody could
// type any name into a settings field. Nothing stopped someone claiming a well-known clan's name and
// standing up a site that looked official — impersonation rather than a naming clash.
//
// HOW THE PROOF WORKS. The roster payload is self-attesting: the plugin reads the clan member list
// from the game, and the person pushing it appears in that list with their rank. So the server can
// ask a question only a real member could pass — "are you in the roster you just sent me?" — without
// needing anything the client could not already have. Any rank: the owner-tier requirement held new
// clans hostage to one person's session, and the harm a squatter could do with a sync (demoting real
// members' seats elsewhere) is gone — a sync never moves a membership between clans now.
//
// WHAT IT IS NOT. This is practical proof, not cryptographic. A modified client can send whatever it
// likes, and saying otherwise in the code would be worse than the limitation itself. What backs it:
//
//   - first claim wins, so the name is taken before an impersonator arrives rather than after
//   - a previously anchored account hash gives continuity to a specific Jagex account; a newly
//     supplied client value is not treated as independent proof
//   - a second claim is refused and escalates to a human rather than silently losing
//
// It raises the cost from "type a name" to "control a verified account in that clan, or modify your
// client", and gives the real owners a place to complain. That is the honest claim.

import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanRoster, clans, clanStaff, users } from '@/db/schema';
import { releaseRosterMemberships } from '@/lib/homeClan';
import { parseStamp } from '@/lib/dbTime';
import { getBotTokenOnly } from '@/lib/discord-roles';
import { ANVIL_LOGO_URL, EMBED_COLOR, POWERED_BY } from '@/lib/discordEmbeds';
import { isOwnerTierRank } from '@/lib/ingameRanks';
import { sendDm } from '@/lib/onboardingNudge';

export { isOwnerTierRank };

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
  /** The pusher is not in the roster they sent, which is the one thing a real member cannot be. */
  | { outcome: 'not-in-roster' };

/** How long a clan holds an unverified in-game name before a proven claim may take it over. */
const UNVERIFIED_NAME_GRACE_MS = 7 * 24 * 60 * 60_000;

/** Is this clan past the grace period? Dated from its creation; a clan from before that was logged is. */
async function pastNameGrace(clanId: number): Promise<boolean> {
  const [created] = await db
    .select({ at: clanAuditLog.occurredAt })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanId, clanId), eq(clanAuditLog.eventType, 'clan_created')))
    .limit(1);
  const at = created ? parseStamp(created.at) : null;
  return at == null || Date.now() - at > UNVERIFIED_NAME_GRACE_MS;
}

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

  // The question only a real member passes: are you in the list you just sent? Asked up front because
  // the pusher's RANK decides whether a lower-rank verification elsewhere can be taken over (below).
  const me = opts.pusherRsnNormalized
    ? opts.roster.find((r) => r.rsnNormalized === opts.pusherRsnNormalized)
    : undefined;
  const pusherOwnerTier = me != null && isOwnerTierRank(me.rank);

  // Somebody else got there first. Refused rather than merged: two clans cannot both be the same
  // in-game clan, and picking one automatically would be picking a side in a dispute.
  const taken = await db.query.clans.findFirst({
    where: and(
      sql`lower(${clans.inGameName}) = ${name.toLowerCase()}`,
      isNotNull(clans.ingameNameVerifiedAt),
      ne(clans.id, opts.clanId),
    ),
  });
  if (taken) {
    // OWNER TIER OUTRANKS A LOWER-RANK CLAIM. Any rank verifies (see below), which means a recruit
    // could stand up a site under their clan's name before the clan's leaders arrived, and first-claim-
    // wins would then lock the real owners out. So a verification a lower rank made is provisional
    // against the clan's own owner tier — but the pusher's rank is CLIENT-ATTESTED, so on its own it
    // proves nothing (a modified client could steal any such name and wipe its member seats). The
    // takeover needs CORROBORATION from the holder's own syncs, i.e. a second, independent client:
    // see takeoverCorroboration. A holder an owner-tier rank or staff verified, or whose owner tier
    // has since synced it, keeps today's refusal — a dispute between two leaderships is a human's.
    let refusalNote = `already verified by ${taken.slug}`;
    if (pusherOwnerTier) {
      const verdict = await takeoverCorroboration(taken.id, me!.rsnNormalized);
      if (verdict.ok) {
        const moved = await takeOverLowerRankName({
          fromClan: { id: taken.id, slug: taken.slug, name: taken.name },
          toClanId: opts.clanId,
          name,
          rank: me!.rank,
          accountId: opts.pusherAccountId,
        });
        if (moved) return await recordVerified(opts.clanId, name, me!.rank, opts.pusherAccountId, taken.slug);
      } else {
        refusalNote = `owner-tier claim (${me!.rank}) refused: ${verdict.reason}; already verified by ${taken.slug}`;
      }
    }

    // RECORDED, because a dispute that leaves no trace cannot be resolved. The refusal used to be a
    // 409 and nothing else: the clan being impersonated never learned anyone had tried, and the
    // operator asked to arbitrate had no way to see that a claim had been made, by whom, or when.
    //
    // Written against the clan that ATTEMPTED it — that is whose behaviour it describes — and it is
    // a platform-visible line because deciding between two clans is a platform job.
    await db
      .insert(clanAuditLog)
      .values({
        clanId: opts.clanId,
        eventType: 'ingame_name_claim_refused',
        newValue: JSON.stringify({
          inGameName: name,
          heldBy: taken.slug,
          accountId: opts.pusherAccountId,
          ownerTierClaim: pusherOwnerTier ? me!.rank : null,
        }),
        notes: refusalNote,
      })
      .catch(() => {});

    return { outcome: 'taken', byClanSlug: taken.slug };
  }

  if (!me) return { outcome: 'not-in-roster' };
  // ANY RANK. The first sync used to need an owner or deputy owner, which held every new clan
  // hostage to one person's game session (and failed outright when a clan renamed its owner rank).
  // Being in the roster, on a verified character, from an account the site already made admin, is
  // the claim; what made a squatted name dangerous — a sync demoting real members' seats in their
  // real clan — no longer exists (lib/guestAdmission memberSeatElsewhere), and the full unique
  // index still keeps one name to one clan. The rank is RECORDED with the verification, because a
  // lower-rank claim can yield to the clan's owner tier later (takeoverCorroboration).

  // Held — UNVERIFIED — by another clan. Typing a name proves nothing, so an unverified hold is not a
  // reservation forever: refusing every later claim let anyone park a famous clan's name in a settings
  // field before the real clan arrived. But the roster proof above is client-side too (see the top of
  // this file), so a holder gets a GRACE PERIOD to verify from its own game first — a genuine clan
  // that signed up yesterday must not lose its name to a modified client. Past it, the proven claim
  // wins and the old holder's name is released, logged on both clans. 0082 keeps one holder per name
  // (a roster sync gates on it), so the release must land before the write below. Its seats are left
  // alone: an unverified clan cannot sync a roster, so there are none of its making to undo.
  const heldUnverified = await db.query.clans.findFirst({
    where: and(sql`lower(trim(${clans.inGameName})) = ${name.toLowerCase()}`, ne(clans.id, opts.clanId)),
    columns: { id: true, slug: true },
  });
  if (heldUnverified) {
    if (!(await pastNameGrace(heldUnverified.id))) {
      await db
        .insert(clanAuditLog)
        .values({
          clanId: opts.clanId,
          eventType: 'ingame_name_claim_refused',
          newValue: JSON.stringify({ inGameName: name, heldBy: heldUnverified.slug, accountId: opts.pusherAccountId }),
          notes: `held unverified by ${heldUnverified.slug}, still inside its grace period`,
        })
        .catch(() => {});
      return { outcome: 'taken', byClanSlug: heldUnverified.slug };
    }
    const released = await db
      .update(clans)
      .set({ inGameName: null, ingameNameVerifiedAt: null, ingameNameClaimedByAccountId: null })
      .where(and(eq(clans.id, heldUnverified.id), isNull(clans.ingameNameVerifiedAt)))
      .returning({ id: clans.id });
    // It verified in the meantime: then it is a verified holder, refused like any other.
    if (released.length === 0) return { outcome: 'taken', byClanSlug: heldUnverified.slug };
    await db
      .insert(clanAuditLog)
      .values({
        clanId: heldUnverified.id,
        eventType: 'ingame_name_released',
        newValue: JSON.stringify({ inGameName: name, toClanId: opts.clanId, accountId: opts.pusherAccountId }),
        notes: 'unverified name taken over by a clan that proved membership in game',
      })
      .catch(() => {});
  }

  return recordVerified(opts.clanId, name, me.rank, opts.pusherAccountId, null);
}

/** Bind the name and write the verification row — WITH the rank tier that proved it. */
async function recordVerified(
  clanId: number,
  name: string,
  rank: string | null,
  accountId: number | null,
  takenFromSlug: string | null,
): Promise<ClaimResult> {
  await db
    .update(clans)
    .set({
      inGameName: name,
      ingameNameVerifiedAt: new Date().toISOString(),
      ingameNameClaimedByAccountId: accountId,
    })
    .where(eq(clans.id, clanId));

  const ownerTier = isOwnerTierRank(rank);
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'ingame_name_verified',
      newValue: JSON.stringify({ inGameName: name, rank, ownerTier, accountId, takenFrom: takenFromSlug }),
      notes: takenFromSlug
        ? `roster pushed by an owner-tier member (${rank}); name taken over from ${takenFromSlug}, which a lower rank had verified`
        : `roster pushed by a clan member (${rank ?? 'no rank'}${ownerTier ? ', owner tier' : ''})`,
    })
    .catch(() => {});

  return { outcome: 'verified', inGameName: name };
}

/** Logged when an owner-tier member first syncs a clan a lower rank verified. */
const OWNER_CONFIRMED_EVENT = 'ingame_name_owner_confirmed';

/**
 * An owner or deputy owner synced an ALREADY verified clan. If its verification is open to a
 * takeover (a recorded lower rank), record that the owner tier now stands behind it, which ends its
 * exposure to an owner-tier takeover from another Anvil clan. Writes once; later syncs do nothing.
 */
export async function confirmOwnerTier(clanId: number, rank: string | null, accountId: number | null): Promise<void> {
  if (!isOwnerTierRank(rank)) return;
  if (!(await holderVerification(clanId)).openToTakeover) return;
  await db.insert(clanAuditLog).values({
    clanId,
    eventType: OWNER_CONFIRMED_EVENT,
    newValue: JSON.stringify({ rank, ownerTier: true, accountId }),
    notes: `in-game name confirmed by an owner-tier member (${rank})`,
  });
}

/**
 * What the holder's own record says about its verification. FAILS CLOSED.
 *
 * `openToTakeover` only when the latest name event on the clan is an `ingame_name_verified` row,
 * from no staff actor, that EXPLICITLY records `ownerTier: false` with a non-owner rank string —
 * which only this file's recordVerified writes. Everything else is protected and goes to staff: no
 * row, a parse failure, a legacy row without the flag, an unrecognised rank, a staff verification,
 * an owner-tier confirmation, or a latest event that is a withdrawal (the record and the clan row
 * disagree — e.g. a best-effort write was lost).
 */
async function holderVerification(
  clanId: number,
): Promise<{ openToTakeover: boolean; verifierAccountId: number | null }> {
  const [row] = await db
    .select({
      eventType: clanAuditLog.eventType,
      newValue: clanAuditLog.newValue,
      actorUserId: clanAuditLog.actorUserId,
    })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, [
          'ingame_name_verified',
          OWNER_CONFIRMED_EVENT,
          'ingame_name_unverified',
          'ingame_name_released',
        ]),
      ),
    )
    .orderBy(desc(clanAuditLog.id))
    .limit(1);
  const closed = { openToTakeover: false, verifierAccountId: null };
  if (!row || row.eventType !== 'ingame_name_verified' || row.actorUserId != null) return closed;
  let v: { rank?: unknown; ownerTier?: unknown; accountId?: unknown };
  try {
    v = JSON.parse(row.newValue ?? '') as typeof v;
  } catch {
    return closed;
  }
  if (!v || v.ownerTier !== false || typeof v.rank !== 'string' || !v.rank.trim() || isOwnerTierRank(v.rank)) {
    return closed;
  }
  return { openToTakeover: true, verifierAccountId: typeof v.accountId === 'number' ? v.accountId : null };
}

/** How recently the holder's own sync must have seen a corroborating seat. */
const CORROBORATION_FRESH_MS = 14 * 24 * 60 * 60_000;

/**
 * The rank the holder's IN-GAME SYNC last attested for each of these seats — from the `joined` /
 * `rank_changed` rows only clan-sync writes (actor-less), never the seat's `rank` column, which the
 * admin roster endpoints can set by hand (api/admin/clan POST reactivation and [id] PATCH).
 */
async function syncAttestedRanks(clanId: number, seatIds: number[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  if (seatIds.length === 0) return out;
  const rows = await db
    .select({ seat: clanAuditLog.clanMemberId, newValue: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.clanMemberId, seatIds),
        inArray(clanAuditLog.eventType, ['joined', 'rank_changed']),
        isNull(clanAuditLog.actorUserId),
      ),
    )
    .orderBy(desc(clanAuditLog.id));
  for (const r of rows) {
    if (r.seat == null || out.has(r.seat)) continue;
    let rank: string | null = null;
    try {
      const v = JSON.parse(r.newValue ?? '') as { rank?: unknown };
      rank = typeof v?.rank === 'string' ? v.rank : null;
    } catch {
      rank = null;
    }
    out.set(r.seat, rank);
  }
  return out;
}

/**
 * May an owner-tier pusher take this holder's name? Only with CORROBORATION the server already holds
 * from the HOLDER'S OWN in-game syncs — two independent clients agreeing is the proof, since either
 * alone is client-attested:
 *   - the holder's record is open to it at all (holderVerification — fails closed),
 *   - the holder's roster has the pusher on a live MEMBER seat its sync wrote (source 'roster'),
 *     seen by a sync within CORROBORATION_FRESH_MS, whose sync-attested rank AND current rank are
 *     both owner tier (so a hand edit of the rank column can neither forge nor be needed), and
 *   - the holder's original verifier, when known, shows no owner-tier rank there by either measure.
 */
async function takeoverCorroboration(
  holderClanId: number,
  pusherRsnNormalized: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const holder = await holderVerification(holderClanId);
  if (!holder.openToTakeover) {
    return { ok: false, reason: 'the holder was not verified by a recorded lower rank (owner tier, staff, or unknown)' };
  }

  const roster = await db
    .select({
      id: clanRoster.id,
      accountId: clanRoster.accountId,
      rsnNormalized: clanRoster.rsnNormalized,
      rank: clanRoster.rank,
      kind: clanRoster.kind,
      source: clanRoster.source,
      lastSeenInClan: clanRoster.lastSeenInClan,
    })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, holderClanId), isNull(clanRoster.leftAt)));

  const pusherThere = roster.find((r) => r.rsnNormalized === pusherRsnNormalized);
  const verifierThere =
    holder.verifierAccountId != null ? roster.find((r) => r.accountId === holder.verifierAccountId) : undefined;
  const attested = await syncAttestedRanks(
    holderClanId,
    [pusherThere?.id, verifierThere?.id].filter((x): x is number => x != null),
  );

  const seen = pusherThere ? parseStamp(pusherThere.lastSeenInClan) : null;
  const pusherOk =
    pusherThere != null &&
    pusherThere.kind === 'member' &&
    pusherThere.source === 'roster' &&
    seen != null &&
    Date.now() - seen <= CORROBORATION_FRESH_MS &&
    isOwnerTierRank(pusherThere.rank) &&
    isOwnerTierRank(attested.get(pusherThere.id));
  if (!pusherOk) {
    return { ok: false, reason: "the holder's own recent sync does not show the pusher at an owner-tier rank" };
  }
  if (verifierThere && (isOwnerTierRank(verifierThere.rank) || isOwnerTierRank(attested.get(verifierThere.id)))) {
    return { ok: false, reason: "the holder's verifier is owner tier in its own roster" };
  }
  return { ok: true };
}

/**
 * Move a lower-rank verified name off its holder — what staff `unverify` does (name released, the
 * roster member seats its syncs made released to guest), done automatically and logged on both clans.
 * False when the holder changed underneath us (raced another sync); the caller then refuses as usual.
 */
async function takeOverLowerRankName(opts: {
  fromClan: { id: number; slug: string; name: string };
  toClanId: number;
  name: string;
  rank: string | null;
  accountId: number | null;
}): Promise<boolean> {
  // Guarded on the name still being the holder's and still verified, so two syncs racing cannot both
  // release it. 0082 keeps one holder per name, so this lands before the new clan's write.
  const released = await db
    .update(clans)
    .set({ inGameName: null, ingameNameVerifiedAt: null, ingameNameClaimedByAccountId: null })
    .where(
      and(
        eq(clans.id, opts.fromClan.id),
        isNotNull(clans.ingameNameVerifiedAt),
        sql`lower(trim(${clans.inGameName})) = ${opts.name.toLowerCase()}`,
      ),
    )
    .returning({ id: clans.id });
  if (released.length === 0) return false;

  await releaseRosterMemberships(
    opts.fromClan.id,
    null,
    'in-game name taken over by the clan owner tier; member seats from roster syncs released',
  );
  await db
    .insert(clanAuditLog)
    .values({
      clanId: opts.fromClan.id,
      eventType: 'ingame_name_unverified',
      newValue: JSON.stringify({
        inGameName: null,
        previous: opts.name,
        toClanId: opts.toClanId,
        byRank: opts.rank,
        accountId: opts.accountId,
        reason: 'owner-tier takeover',
      }),
      notes: `in-game name taken over: an owner-tier member (${opts.rank}) synced it from another Anvil clan, and this clan had been verified by a lower rank`,
    })
    .catch(() => {});

  // Best effort — a missed DM must never undo the move; the audit row is the record.
  await notifyTakenOver(opts.fromClan, opts.name).catch(() => {});
  return true;
}

/** Tell the old holder's owner, by Discord DM through their clan's bot, when there is one. */
async function notifyTakenOver(clan: { id: number; name: string }, inGameName: string): Promise<void> {
  const [owner] = await db
    .select({ discordId: users.discordId })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.role, 'owner')))
    .limit(1);
  if (!owner?.discordId) return;
  const bot = await getBotTokenOnly(clan.id).catch(() => null);
  if (!bot) return;
  await sendDm(bot.token, owner.discordId, {
    embeds: [
      {
        title: `${clan.name} lost the in-game clan name "${inGameName}"`,
        description:
          `An owner or deputy owner of **${inGameName}** synced the clan from a different Anvil site, so the name ` +
          `moved there. Your site had been linked to it by a lower-ranked member. Your members stay on your site as ` +
          `guests. If this is wrong, contact Anvil support.`,
        color: EMBED_COLOR.amber,
        footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
      },
    ],
  });
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

  // ONE TRANSACTION, not a best-effort audit write: the staff row is what protects this verification
  // from an owner-tier takeover (holderVerification). A lost row would leave an older lower-rank row
  // as the latest record, so the name and its protection land together or not at all.
  await db.transaction(async (tx) => {
    await tx
      .update(clans)
      .set({ inGameName: name, ingameNameVerifiedAt: new Date().toISOString() })
      .where(eq(clans.id, clanId));
    await tx.insert(clanAuditLog).values({
      clanId,
      eventType: 'ingame_name_verified',
      actorUserId: byUserId,
      newValue: JSON.stringify({ inGameName: name, staff: true }),
      notes: 'verified by platform staff',
    });
  });

  return { ok: true };
}

/**
 * Withdraw a badge — a dispute resolved the other way, or a claim that turned out to be false.
 *
 * Also RELEASES the memberships its roster syncs made (lib/homeClan). A sync never moves a membership
 * between clans, so a clan that was not who it said it was would otherwise keep every member it
 * synced, and the real clan's roster could only seat them as guests.
 */
export async function unverify(clanId: number, byUserId: number, reason?: string | null): Promise<void> {
  await db
    .update(clans)
    // The name itself is the reservation (0082 enforces uniqueness for verified and unverified
    // clans alike). Withdrawing a false/disputed claim must therefore release the name too.
    .set({ inGameName: null, ingameNameVerifiedAt: null, ingameNameClaimedByAccountId: null })
    .where(eq(clans.id, clanId));
  await releaseRosterMemberships(clanId, byUserId);

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'ingame_name_unverified',
      actorUserId: byUserId,
      newValue: JSON.stringify({ inGameName: null, reason: reason ?? null }),
      notes: 'badge withdrawn by platform staff',
    })
    .catch(() => {});
}
