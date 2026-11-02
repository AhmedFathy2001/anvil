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
import { clanAuditLog, clans, clanStaff, users } from '@/db/schema';
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
    // wins would then lock the real owners out. So a verification made by a lower rank is provisional
    // against the clan's own owner tier: when an owner or deputy owner pushes the same in-game name
    // from a different Anvil clan, the name moves to them. A holder an owner-tier rank (or staff)
    // verified keeps today's refusal — that is a genuine dispute between two leaderships, a human's.
    if (pusherOwnerTier && !(await verifiedByOwnerTier(taken.id))) {
      const moved = await takeOverLowerRankName({
        fromClan: { id: taken.id, slug: taken.slug, name: taken.name },
        toClanId: opts.clanId,
        name,
        rank: me!.rank,
        accountId: opts.pusherAccountId,
      });
      if (moved) return await recordVerified(opts.clanId, name, me!.rank, opts.pusherAccountId, taken.slug);
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
        }),
        notes: `already verified by ${taken.slug}`,
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
  // lower-rank claim yields to the clan's owner tier later (verifiedByOwnerTier).

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
 * An owner or deputy owner synced an ALREADY verified clan. If a lower rank made that verification,
 * record that the owner tier has now stood behind it, which ends its exposure to an owner-tier
 * takeover from another Anvil clan. Writes once; every later sync finds the row and does nothing.
 */
export async function confirmOwnerTier(clanId: number, rank: string | null, accountId: number | null): Promise<void> {
  if (!isOwnerTierRank(rank)) return;
  if (await verifiedByOwnerTier(clanId)) return;
  await db.insert(clanAuditLog).values({
    clanId,
    eventType: OWNER_CONFIRMED_EVENT,
    newValue: JSON.stringify({ rank, ownerTier: true, accountId }),
    notes: `in-game name confirmed by an owner-tier member (${rank})`,
  });
}

/**
 * Was this clan's CURRENT verification made by an owner-tier rank, or by staff?
 *
 * Read from the clan's latest `ingame_name_verified` / owner-confirmed row. Only a roster verification that recorded a
 * non-owner rank counts as lower-rank; anything else — staff (an actor, no rank), a row from before
 * ranks were recorded, no row at all — is treated as owner tier, so an unknown history keeps the
 * conservative first-claim-wins refusal rather than handing the name away.
 */
async function verifiedByOwnerTier(clanId: number): Promise<boolean> {
  const rows = await db
    .select({
      eventType: clanAuditLog.eventType,
      newValue: clanAuditLog.newValue,
      actorUserId: clanAuditLog.actorUserId,
    })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, ['ingame_name_verified', OWNER_CONFIRMED_EVENT]),
      ),
    )
    .orderBy(desc(clanAuditLog.id))
    .limit(1);
  const row = rows[0];
  if (!row || row.actorUserId != null || row.eventType === OWNER_CONFIRMED_EVENT) return true;
  let v: { rank?: unknown } | null = null;
  try {
    v = row.newValue ? (JSON.parse(row.newValue) as { rank?: unknown }) : null;
  } catch {
    v = null;
  }
  if (!v || !('rank' in v)) return true;
  return isOwnerTierRank(typeof v.rank === 'string' ? v.rank : null);
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
