// "This is my account" — a login asking for a character somebody else has claimed on Anvil.
//
// An ANVIL ownership dispute, not account security: who on Anvil the character's history belongs to.
// Nothing moves silently, and nothing the plugin sends counts as proof — X-Account-Hash is
// client-supplied, so it never starts, advances or settles a claim, and a transfer never writes it.
//
//   1. VERIFY. The claimant starts a claim and must pass the same XP-gain check account verification
//      uses (verification_attempts: gain VERIFY_MIN_DELTA XP in a named skill within 30 minutes, read
//      off the hiscores). Until then nobody is told and nothing changes.
//   2. TELL. Once proved, the claim goes to whoever can decide it:
//        - the owner's claim is unverified / provisional, and the owner was told in-site (a
//          user_notices row on their login): 'objection' — unless they object within OBJECTION_DAYS,
//          it moves;
//        - the owner verified it: 'approval' — only their yes moves it;
//        - the owner has no login to tell: 'staff' — a wrong-owner report for Anvil staff.
//      An owner's "no" also goes to staff (both sides have proof by then).
//   3. MOVE. Release + claim with the existing primitives (lib/accountRelease, lib/accountClaim): the
//      seats and every result recorded under the character stay; only who owns it changes.
//
// Until it moves the claimant's plugin still can't act for the character (lib/pluginForeign). The
// claimant never learns who the owner is. Every step is in the platform audit log (clan_audit_log,
// clan null); both sides get in-site notices, and a Discord DM where a bot can reach them.

import { randomInt } from 'crypto';
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import {
  accountOwnershipClaims,
  accounts,
  clanAuditLog,
  clanRoster,
  userNotices,
  users,
  verificationAttempts,
} from '@/db/schema';
import { claimAccountForPerson } from '@/lib/accountClaim';
import { releaseCharacter } from '@/lib/accountRelease';
import { fileCharacterReport } from '@/lib/characterReports';
import { fetchHiscoresSnapshot, snapshotXpMap, type HiscoresSnapshot } from '@/lib/hiscores';
import { log } from '@/lib/logger';
import { accountForCharacter, type PlayedCharacter } from '@/lib/pluginAccount';
import { findRosterSeats, loginOf, personOf, personOfOrCreate } from '@/lib/roster';

export const OBJECTION_DAYS = 7;
/** New claims one login may start in a day, across all characters. */
export const CLAIMS_PER_DAY = 3;
/** After a "no" (or a staff referral), the same person can't simply start again. */
export const RECLAIM_COOLDOWN_DAYS = 30;
/** The XP check, as account verification runs it (api/auth/verify-stat-delta). */
export const VERIFY_WINDOW_MS = 30 * 60 * 1000;
export const VERIFY_MIN_DELTA = 1000;

const DAY_MS = 86_400_000;

const TRAINABLE_SKILLS = [
  'attack', 'strength', 'defence', 'hitpoints', 'ranged', 'prayer', 'magic',
  'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting',
  'smithing', 'mining', 'herblore', 'agility', 'thieving', 'runecraft',
  'hunter', 'construction',
];

export type ClaimMode = 'objection' | 'approval' | 'staff';
export type ClaimStatus =
  | 'verifying' | 'open' | 'approved' | 'transferring' | 'transferred' | 'objected' | 'declined' | 'staff' | 'withdrawn' | 'lapsed' | 'expired';
/** In flight: the partial unique index allows one of these per character. */
const LIVE: ClaimStatus[] = ['verifying', 'open', 'approved', 'transferring'];
/** A transfer that started this long ago and never finished (a crashed worker) is retried. */
const TRANSFER_STALE_MS = 10 * 60_000;
/** A no, or staff's to decide: the same person waits before asking again. */
const REFUSED: ClaimStatus[] = ['objected', 'declined', 'staff'];

type ClaimRow = typeof accountOwnershipClaims.$inferSelect;

/** Swappable so a test can feed the hiscores and see what would be DMed, without the network. */
export const claimDeps = {
  hiscores: (rsn: string): Promise<HiscoresSnapshot | null> => fetchHiscoresSnapshot(rsn),
  dm: (userId: number, msg: { title: string; description: string }): Promise<boolean> => discordDm(userId, msg),
};

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const skillName = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

/** What the claimant is told about their claim — never who the owner is. */
export function claimantLine(
  c: { mode: string | null; status: string; deadlineAt: string | null; target?: string | null },
  rsn: string,
): string {
  switch (c.status) {
    case 'verifying':
      return c.target
        ? `To prove ${rsn} is yours, gain ${VERIFY_MIN_DELTA.toLocaleString('en-US')} ${skillName(c.target)} XP on it, log out so the hiscores update, then press Check — within 30 minutes. Nobody is told until you have.`
        : `Prove ${rsn} is yours with the XP check, then press Check.`;
    case 'open':
      return c.mode === 'objection'
        ? `You proved ${rsn}. The current owner has until ${fmtDay(c.deadlineAt)} to object; if they don't, it moves to you.`
        : `You proved ${rsn}. The current owner verified it too, so it moves only if they approve.`;
    case 'approved':
    case 'transferring':
      return `Your claim on ${rsn} went through. It moves to you as soon as the event it's playing in ends.`;
    case 'transferred':
      return `${rsn} is yours now.`;
    case 'staff':
    case 'objected':
    case 'declined':
      return `Anvil staff are looking at your claim on ${rsn}; they'll move it to you if it's yours.`;
    case 'withdrawn':
      return `You withdrew your claim on ${rsn}.`;
    case 'expired':
      return `The XP check for ${rsn} ran out of time. Start again when you're ready.`;
    default:
      return `Your claim on ${rsn} closed: the character changed hands another way.`;
  }
}

async function audit(eventType: string, actorUserId: number | null, value: Record<string, unknown>) {
  // clan-scope: global -- who owns a character is the platform's record, not any clan's.
  await db
    .insert(clanAuditLog)
    .values({ clanId: null, eventType, actorUserId, newValue: JSON.stringify(value) })
    .catch(() => {});
}

/** An in-site notice for a login (the record that they were told), plus a best-effort DM. */
async function notice(userId: number, kind: string, refId: number, msg: { title: string; description: string }): Promise<number | null> {
  const [row] = await db
    .insert(userNotices)
    .values({ userId, kind, refId, title: msg.title, body: msg.description, createdAt: new Date().toISOString() })
    .returning({ id: userNotices.id })
    .catch(() => [] as { id: number }[]);
  claimDeps.dm(userId, msg).catch(() => false);
  return row?.id ?? null;
}

export type StartOutcome =
  | { ok: true; created: boolean; claimId: number; status: ClaimStatus; message: string }
  | {
      ok: false;
      /** `cooldown`: already refused / with staff. */
      reason: 'not-other' | 'taken' | 'cooldown' | 'rate-limited' | 'hiscores';
      error: string;
    };

/**
 * Start (or show) "This is my account" for the character this login is playing. Only the NAME is
 * used: the account is looked up by name, and nothing about the request's hash affects what follows.
 */
export async function startOwnershipClaim(input: { userId: number; character: PlayedCharacter; nowIso?: string }): Promise<StartOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  // By name only: a client-supplied hash must not choose which account is being claimed.
  const account = await accountForCharacter({ ...input.character, accountHash: null });
  const me = await personOf(input.userId);
  if (!account || account.claimedAt == null || (me != null && account.playerId === me)) {
    return { ok: false, reason: 'not-other', error: 'This character isn’t linked to anyone else.' };
  }
  const claimant = me ?? (await personOfOrCreate(input.userId));

  // clan-scope: global -- one character's claims.
  const live = await db.query.accountOwnershipClaims.findFirst({
    where: and(eq(accountOwnershipClaims.accountId, account.id), inArray(accountOwnershipClaims.status, LIVE)),
  });
  if (live && live.claimantPlayerId !== claimant) {
    return { ok: false, reason: 'taken', error: 'Somebody already asked for this character — Anvil is waiting on that first.' };
  }
  if (live && live.status !== 'verifying') {
    return { ok: true, created: false, claimId: live.id, status: live.status as ClaimStatus, message: claimantLine(live, account.rsn) };
  }
  if (live) {
    // Still verifying: the same check, unless its window ran out (then a fresh one below).
    const attempt = live.verificationAttemptId
      ? await db.query.verificationAttempts.findFirst({ where: eq(verificationAttempts.id, live.verificationAttemptId) })
      : null;
    if (attempt && !attempt.completedAt && attempt.expiresAt > nowIso) {
      return { ok: true, created: false, claimId: live.id, status: 'verifying', message: claimantLine({ ...live, target: targetOf(attempt) }, account.rsn) };
    }
    await expire(live, nowIso);
  }

  const since = new Date(Date.parse(nowIso) - RECLAIM_COOLDOWN_DAYS * DAY_MS).toISOString();
  const refusedBefore = await db.query.accountOwnershipClaims.findFirst({
    where: and(
      eq(accountOwnershipClaims.accountId, account.id),
      eq(accountOwnershipClaims.claimantPlayerId, claimant),
      inArray(accountOwnershipClaims.status, REFUSED),
      gte(accountOwnershipClaims.decidedAt, since),
    ),
    columns: { id: true },
  });
  if (refusedBefore) {
    return { ok: false, reason: 'cooldown', error: 'Your claim on this character is with Anvil staff.' };
  }

  const dayAgo = new Date(Date.parse(nowIso) - DAY_MS).toISOString();
  const recent = await db
    .select({ id: accountOwnershipClaims.id })
    .from(accountOwnershipClaims)
    .where(and(eq(accountOwnershipClaims.claimantUserId, input.userId), gte(accountOwnershipClaims.createdAt, dayAgo)));
  if (recent.length >= CLAIMS_PER_DAY) {
    return { ok: false, reason: 'rate-limited', error: 'That’s a lot of claims for one day — try again tomorrow.' };
  }

  // The XP check's baseline, off the hiscores.
  const snapshot = await claimDeps.hiscores(account.rsn).catch(() => null);
  const xp = snapshot ? snapshotXpMap(snapshot) : {};
  const candidates = TRAINABLE_SKILLS.filter((k) => (xp[k] ?? 0) > 0);
  if (candidates.length === 0) {
    return { ok: false, reason: 'hiscores', error: 'Couldn’t read this character’s hiscores — it has to be ranked. Try again in a bit.' };
  }
  const target = candidates[randomInt(candidates.length)];
  const [attempt] = await db
    .insert(verificationAttempts)
    .values({
      userId: input.userId,
      rsn: account.rsn,
      rsnNormalized: account.rsnNormalized,
      baselineSnapshot: JSON.stringify({ _target: target, ...xp }),
      minDelta: VERIFY_MIN_DELTA,
      expiresAt: new Date(Date.parse(nowIso) + VERIFY_WINDOW_MS).toISOString(),
    })
    .returning();
  const [row] = await db
    .insert(accountOwnershipClaims)
    .values({
      accountId: account.id,
      claimantUserId: input.userId,
      claimantPlayerId: claimant,
      ownerPlayerId: account.playerId!,
      status: 'verifying',
      verificationAttemptId: attempt.id,
      createdAt: nowIso,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    return { ok: false, reason: 'taken', error: 'Somebody already asked for this character — Anvil is waiting on that first.' };
  }
  await audit('ownership_claim_started', input.userId, { claimId: row.id, accountId: account.id, rsn: account.rsn });
  return { ok: true, created: true, claimId: row.id, status: 'verifying', message: claimantLine({ ...row, target }, account.rsn) };
}

function targetOf(attempt: { baselineSnapshot: string }): string | null {
  try {
    const t = JSON.parse(attempt.baselineSnapshot)._target;
    return typeof t === 'string' ? t : null;
  } catch {
    return null;
  }
}

/**
 * Close a claim whose check ran out. Only one still verifying AND not yet verified: a Check that won
 * stamps `verifiedAt` before it completes the attempt and routes the claim, so a Check (or the sweep)
 * that arrives in between sees a finished attempt but must not expire a claim that was just proved —
 * that race left a proved claim 'expired' when two Checks landed together.
 */
async function expire(claim: ClaimRow, nowIso: string) {
  await db
    .update(accountOwnershipClaims)
    .set({ status: 'expired', decidedAt: nowIso })
    .where(
      and(
        eq(accountOwnershipClaims.id, claim.id),
        eq(accountOwnershipClaims.status, 'verifying'),
        isNull(accountOwnershipClaims.verifiedAt),
      ),
    );
}

export type CheckOutcome =
  | { ok: true; status: ClaimStatus; message: string; gained?: number }
  | { ok: false; error: string; status?: number };

/**
 * "Check": has the claimant gained the XP yet? On success the claim goes to whoever decides it (the
 * owner, or staff) — the first moment anybody is told.
 */
export async function checkOwnershipClaim(input: { claimId: number; userId: number; nowIso?: string }): Promise<CheckOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const me = await personOf(input.userId);
  const claim = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, input.claimId) });
  if (!claim || me == null || claim.claimantPlayerId !== me) return { ok: false, error: 'Not found', status: 404 };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId) });
  if (!account) return { ok: false, error: 'Not found', status: 404 };
  if (claim.status !== 'verifying') return { ok: true, status: claim.status as ClaimStatus, message: claimantLine(claim, account.rsn) };

  const attempt = claim.verificationAttemptId
    ? await db.query.verificationAttempts.findFirst({ where: eq(verificationAttempts.id, claim.verificationAttemptId) })
    : null;
  if (!attempt || attempt.completedAt || attempt.expiresAt <= nowIso) {
    if (attempt && !attempt.completedAt) {
      await db.update(verificationAttempts).set({ completedAt: nowIso, succeeded: 0, failureReason: 'expired' }).where(eq(verificationAttempts.id, attempt.id));
    }
    await expire(claim, nowIso);
    // Report the claim as it ended up: a Check that lost the race to one that proved it finds the
    // attempt finished and the claim verified (and routed, or about to be) — not expired.
    const fresh = (await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, claim.id) })) ?? claim;
    return { ok: true, status: fresh.status as ClaimStatus, message: claimantLine(fresh, account.rsn) };
  }
  const target = targetOf(attempt);
  let baseline: Record<string, unknown> = {};
  try {
    baseline = JSON.parse(attempt.baselineSnapshot);
  } catch {
    /* treated as no gain */
  }
  const snapshot = await claimDeps.hiscores(attempt.rsn).catch(() => null);
  const now = snapshot ? snapshotXpMap(snapshot) : null;
  const before = target ? baseline[target] : undefined;
  const gained = now && target && typeof before === 'number' && typeof now[target] === 'number' ? now[target] - before : 0;
  if (gained < attempt.minDelta) {
    return {
      ok: true,
      status: 'verifying',
      gained: Math.max(0, gained),
      message: snapshot
        ? `${Math.max(0, gained).toLocaleString('en-US')} of ${attempt.minDelta.toLocaleString('en-US')} ${skillName(target ?? '')} XP so far. ` + claimantLine({ ...claim, target }, account.rsn)
        : 'The hiscores didn’t answer — try Check again in a minute.',
    };
  }

  // ONE winner. Two Checks at once (the panel and the site, or a double click) both see the gain;
  // only the request whose conditional update comes back routes the claim and tells anybody.
  const [won] = await db
    .update(accountOwnershipClaims)
    .set({ verifiedAt: nowIso })
    .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'verifying'), isNull(accountOwnershipClaims.verifiedAt)))
    .returning();
  if (won) {
    await db
      .update(verificationAttempts)
      .set({ completedAt: nowIso, succeeded: 1, failureReason: null })
      .where(and(eq(verificationAttempts.id, attempt.id), isNull(verificationAttempts.completedAt)));
    await audit('ownership_claim_verified', input.userId, { claimId: claim.id, accountId: claim.accountId, method: 'stat_delta', skill: target, gained });
    await routeVerifiedClaim(won, account, nowIso);
  }
  const fresh = (await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, claim.id) }))!;
  return { ok: true, status: fresh.status as ClaimStatus, message: claimantLine(fresh, account.rsn) };
}

/** A proved claim goes to whoever can decide it. */
async function routeVerifiedClaim(claim: ClaimRow, account: typeof accounts.$inferSelect, nowIso: string): Promise<ClaimStatus> {
  if (account.claimedAt == null || account.playerId !== claim.ownerPlayerId) {
    await lapse(claim, nowIso, 'owner-changed');
    return 'lapsed';
  }
  const ownerLogin = await loginOf(claim.ownerPlayerId);
  // The owner verified it with a real check (not a provisional or first-use link): only their yes.
  const ownerVerified =
    account.verifiedAt != null && account.provisional !== 1 && account.verificationMethod !== 'plugin_first_use';
  const claimant = await db.query.users.findFirst({ where: eq(users.id, claim.claimantUserId), columns: { displayName: true, discordUsername: true } });
  const who = claimant?.displayName || claimant?.discordUsername || 'Another Anvil player';

  // Nobody to tell: staff decide. A window nobody can see is not a chance to object.
  const noticeId =
    ownerLogin == null
      ? null
      : await notice(ownerLogin, 'ownership_claim', claim.id, {
          title: `${who} says ${account.rsn} is their character`,
          description: ownerVerified
            ? `${who} proved control of **${account.rsn}** with Anvil's XP check. You verified it too, so it moves only if you approve. Answer in Settings → Ownership claims.`
            : `${who} proved control of **${account.rsn}** with Anvil's XP check; your link to it was never verified. ` +
              `If you don't object by **${fmtDay(new Date(Date.parse(nowIso) + OBJECTION_DAYS * DAY_MS).toISOString())}**, it moves to them ` +
              `(everything it earned stays where it was recorded). Answer in Settings → Ownership claims.`,
        });
  if (noticeId == null) return toStaff(claim, account, nowIso, 'the current owner has no Anvil login to tell');

  const mode: ClaimMode = ownerVerified ? 'approval' : 'objection';
  const opened = await db
    .update(accountOwnershipClaims)
    .set({
      status: 'open',
      mode,
      ownerNoticeId: noticeId,
      deadlineAt: mode === 'objection' ? new Date(Date.parse(nowIso) + OBJECTION_DAYS * DAY_MS).toISOString() : null,
    })
    .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'verifying')))
    .returning({ id: accountOwnershipClaims.id });
  if (opened.length === 0) return 'lapsed';
  await audit('ownership_claim_opened', claim.claimantUserId, { claimId: claim.id, accountId: account.id, mode, ownerNoticeId: noticeId });
  return 'open';
}

/** Hand it to Anvil staff: a wrong-owner report, with the claimant and how they proved it. */
async function toStaff(
  claim: ClaimRow,
  account: { id: number; rsn: string },
  nowIso: string,
  why: string,
  status: ClaimStatus = 'staff',
): Promise<ClaimStatus> {
  const { id: reportId } = await fileCharacterReport({
    accountId: account.id,
    clanId: null,
    reportedByUserId: claim.claimantUserId,
    claimantPlayerId: claim.claimantPlayerId,
    kind: 'wrong_owner',
    body: `Ownership claim #${claim.id}: this login proved control of ${account.rsn} with the XP check; ${why}.`,
  });
  const moved = await db
    .update(accountOwnershipClaims)
    .set({ status, mode: status === 'staff' ? 'staff' : claim.mode, staffReportId: reportId, decidedAt: claim.decidedAt ?? nowIso })
    // From routing ('verifying'), or the status the owner's "no" just set — never over anything else.
    .where(and(eq(accountOwnershipClaims.id, claim.id), inArray(accountOwnershipClaims.status, ['verifying', status])))
    .returning({ id: accountOwnershipClaims.id });
  if (moved.length === 0) return (await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, claim.id) }))!.status as ClaimStatus;
  await audit('ownership_claim_to_staff', null, { claimId: claim.id, accountId: account.id, reportId, why });
  await notice(claim.claimantUserId, 'ownership_claim', claim.id, {
    title: `Your claim on ${account.rsn} is with Anvil staff`,
    description: claimantLine({ ...claim, status: 'staff' }, account.rsn),
  });
  return status;
}

export type RespondOutcome = { ok: true; status: ClaimStatus } | { ok: false; error: string; status?: number };

/** The owner's answer: approve (it moves) or decline / object (it stays, and staff weigh it). */
export async function respondToClaim(input: {
  claimId: number;
  userId: number;
  playerId: number;
  action: 'approve' | 'decline';
  nowIso?: string;
}): Promise<RespondOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const claim = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, input.claimId) });
  if (!claim || claim.ownerPlayerId !== input.playerId) return { ok: false, error: 'Not found', status: 404 };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId) });
  // Still theirs to answer for: the character hasn't changed hands some other way.
  if (!account || account.claimedAt == null || account.playerId !== input.playerId) return { ok: false, error: 'Not found', status: 404 };
  // A claim that hasn't been proved yet isn't the owner's to see or answer.
  if (claim.status === 'verifying') return { ok: false, error: 'Not found', status: 404 };
  if (claim.status !== 'open') return { ok: false, error: 'This claim is already settled.', status: 409 };

  if (input.action === 'decline') {
    const status: ClaimStatus = claim.mode === 'approval' ? 'declined' : 'objected';
    const done = await db
      .update(accountOwnershipClaims)
      .set({ status, decidedAt: nowIso, decidedByUserId: input.userId })
      .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open')))
      .returning();
    if (done.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
    await audit(`ownership_claim_${status}`, input.userId, { claimId: claim.id, accountId: claim.accountId, rsn: account.rsn });
    // Both sides have proof now: Anvil staff decide.
    await toStaff(done[0], account, nowIso, `the current owner ${status === 'declined' ? 'declined' : 'objected'}`, status);
    return { ok: true, status };
  }

  const approved = await db
    .update(accountOwnershipClaims)
    .set({ status: 'approved', decidedAt: nowIso, decidedByUserId: input.userId })
    .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open')))
    .returning();
  if (approved.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
  await audit('ownership_claim_approved', input.userId, { claimId: claim.id, accountId: claim.accountId, rsn: account.rsn });
  return { ok: true, status: await transferClaim(approved[0], nowIso, 'owner-approved') };
}

/** The claimant changes their mind. */
export async function withdrawClaim(input: { claimId: number; userId: number; nowIso?: string }): Promise<RespondOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const me = await personOf(input.userId);
  const claim = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, input.claimId) });
  if (!claim || me == null || claim.claimantPlayerId !== me) return { ok: false, error: 'Not found', status: 404 };
  const done = await db
    .update(accountOwnershipClaims)
    .set({ status: 'withdrawn', decidedAt: nowIso, decidedByUserId: input.userId })
    // Not once a worker is moving it ('transferring'): that finishes, or unlocks back to 'approved'.
    .where(and(eq(accountOwnershipClaims.id, claim.id), inArray(accountOwnershipClaims.status, ['verifying', 'open', 'approved'])))
    .returning({ id: accountOwnershipClaims.id });
  if (done.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
  await audit('ownership_claim_withdrawn', input.userId, { claimId: claim.id, accountId: claim.accountId });
  return { ok: true, status: 'withdrawn' };
}

/**
 * Move the character from the owner to the claimant: release (the owner's proof goes with them,
 * their login stops auto-linking it) then claim for the claimant by the XP check they passed. The
 * account hash is never written from the claim. A live event holding the character defers it
 * ('approved', retried by the settle sweep).
 */
async function transferClaim(approvedClaim: ClaimRow, nowIso: string, via: 'owner-approved' | 'no-objection'): Promise<ClaimStatus> {
  // THE LOCK. Only an 'approved' claim moves, and only the request whose conditional update comes
  // back does the moving — the owner's Approve and the sweep can't both release and re-claim.
  const [claim] = await db
    .update(accountOwnershipClaims)
    .set({ status: 'transferring', transferStartedAt: nowIso })
    .where(and(eq(accountOwnershipClaims.id, approvedClaim.id), eq(accountOwnershipClaims.status, 'approved')))
    .returning();
  if (!claim) {
    const now = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, approvedClaim.id) });
    return (now?.status ?? 'lapsed') as ClaimStatus;
  }
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId) });
  if (!account || account.claimedAt == null || account.playerId !== claim.ownerPlayerId || claim.verifiedAt == null) {
    await lapse(claim, nowIso, 'owner-changed');
    return 'lapsed';
  }
  const ownerLogin = await loginOf(claim.ownerPlayerId);
  const released = await releaseCharacter({
    userId: ownerLogin,
    playerId: claim.ownerPlayerId,
    accountId: account.id,
    nowIso,
    via: 'ownership-claim',
  });
  if (!released.ok) {
    if (released.reason === 'live-event') {
      // Unlock: the sweep tries again once the event is over.
      await db
        .update(accountOwnershipClaims)
        .set({ status: 'approved', transferStartedAt: null })
        .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'transferring')));
      return 'approved';
    }
    await lapse(claim, nowIso, 'owner-changed');
    return 'lapsed';
  }

  const moved = await claimAccountForPerson({
    playerId: claim.claimantPlayerId,
    rsn: account.rsn,
    rsnNormalized: account.rsnNormalized,
    // What the claimant actually proved. Provisional when only an unanswered window let it through,
    // so a moderator still confirms it on the review queue — as for any XP-check claim.
    method: 'stat_delta',
    verified: true,
    provisional: via === 'no-objection',
    actorUserId: claim.claimantUserId,
  });
  if (!moved.ok) {
    // Somebody else's plugin took it in the moment it was free. Never silent: it's in the log.
    await lapse(claim, nowIso, 'taken-on-release');
    return 'lapsed';
  }
  await db
    .update(accountOwnershipClaims)
    .set({ status: 'transferred', decidedAt: claim.decidedAt ?? nowIso })
    .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'transferring')));
  await audit('ownership_claim_transferred', via === 'owner-approved' ? claim.decidedByUserId : null, {
    claimId: claim.id,
    accountId: account.id,
    rsn: account.rsn,
    fromPlayerId: claim.ownerPlayerId,
    toPlayerId: claim.claimantPlayerId,
    mode: claim.mode,
    via,
  });
  await notice(claim.claimantUserId, 'ownership_claim', claim.id, {
    title: `${account.rsn} is yours now`,
    description: claimantLine({ ...claim, status: 'transferred' }, account.rsn),
  });
  if (ownerLogin != null) {
    await notice(ownerLogin, 'ownership_claim', claim.id, {
      title: `${account.rsn} moved to the player who claimed it`,
      description:
        via === 'owner-approved'
          ? `You approved the claim, so ${account.rsn} is no longer on your Anvil account. Everything it earned stays where it was recorded.`
          : `Nobody objected within ${OBJECTION_DAYS} days, so ${account.rsn} moved to the Anvil player who proved control of it. Everything it earned stays where it was recorded. If this is wrong, contact Anvil staff.`,
    });
  }
  return 'transferred';
}

async function lapse(claim: ClaimRow, nowIso: string, why: string) {
  const done = await db
    .update(accountOwnershipClaims)
    .set({ status: 'lapsed', decidedAt: claim.decidedAt ?? nowIso })
    // Only from a state still in flight: a claim somebody else just settled stays settled.
    .where(and(eq(accountOwnershipClaims.id, claim.id), inArray(accountOwnershipClaims.status, LIVE)))
    .returning({ id: accountOwnershipClaims.id });
  if (done.length === 0) return;
  await audit('ownership_claim_lapsed', null, { claimId: claim.id, accountId: claim.accountId, why });
}

/**
 * The sweep (lifecycle tick): an XP check that ran out expires; an objection window the owner was
 * told about and that ran out with no objection moves the character; an approved claim waiting on a
 * live event tries again; a claim whose character changed hands some other way closes.
 */
export async function settleOwnershipClaims(nowMs = Date.now()): Promise<number> {
  const nowIso = new Date(nowMs).toISOString();
  // clan-scope: global -- ownership claims are the platform's, across every clan.
  const due = await db.select().from(accountOwnershipClaims).where(inArray(accountOwnershipClaims.status, LIVE)).limit(200);
  let moved = 0;
  for (const claim of due) {
    try {
      if (claim.status === 'verifying') {
        if (Date.parse(claim.createdAt) + VERIFY_WINDOW_MS + 60_000 < nowMs) await expire(claim, nowIso);
        continue;
      }
      if (claim.status === 'transferring') {
        // A worker that died mid-move: unlock it for the next tick (the move itself is re-checked).
        if (claim.transferStartedAt && Date.parse(claim.transferStartedAt) + TRANSFER_STALE_MS < nowMs) {
          await db
            .update(accountOwnershipClaims)
            .set({ status: 'approved', transferStartedAt: null })
            .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'transferring'), eq(accountOwnershipClaims.transferStartedAt, claim.transferStartedAt)));
        }
        continue;
      }
      if (claim.status === 'open') {
        const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId), columns: { playerId: true, claimedAt: true } });
        if (!account || account.claimedAt == null || account.playerId !== claim.ownerPlayerId) {
          await lapse(claim, nowIso, 'owner-changed');
          continue;
        }
        // Only an objection window that the owner was really told about runs out on its own.
        if (claim.mode !== 'objection' || claim.ownerNoticeId == null || !claim.deadlineAt || claim.deadlineAt > nowIso) continue;
        const [ripe] = await db
          .update(accountOwnershipClaims)
          .set({ status: 'approved', decidedAt: nowIso })
          .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open'), lte(accountOwnershipClaims.deadlineAt, nowIso)))
          .returning();
        if (!ripe) continue;
        await audit('ownership_claim_unopposed', null, { claimId: claim.id, accountId: claim.accountId });
        if ((await transferClaim(ripe, nowIso, 'no-objection')) === 'transferred') moved++;
      } else if ((await transferClaim(claim, nowIso, claim.decidedByUserId != null ? 'owner-approved' : 'no-objection')) === 'transferred') {
        moved++;
      }
    } catch (err) {
      log.warn('ownership-claim.settle-failed', { claimId: claim.id, err: String(err) });
    }
  }
  return moved;
}

// ── Reads ──────────────────────────────────────────────────────────────────────────────────────

export type OwnerClaimView = {
  id: number;
  accountId: number;
  rsn: string;
  mode: ClaimMode;
  status: ClaimStatus;
  createdAt: string;
  deadlineAt: string | null;
  /** The claimant's display name: the owner may know who is asking. */
  claimantName: string;
};

/** Proved claims waiting on this person as the owner (open; approved-and-waiting too). */
export async function claimsOnMyCharacters(playerId: number): Promise<OwnerClaimView[]> {
  const rows = await db
    .select({
      id: accountOwnershipClaims.id,
      accountId: accountOwnershipClaims.accountId,
      rsn: accounts.rsn,
      mode: accountOwnershipClaims.mode,
      status: accountOwnershipClaims.status,
      createdAt: accountOwnershipClaims.createdAt,
      deadlineAt: accountOwnershipClaims.deadlineAt,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
    })
    .from(accountOwnershipClaims)
    .innerJoin(accounts, eq(accounts.id, accountOwnershipClaims.accountId))
    .innerJoin(users, eq(users.id, accountOwnershipClaims.claimantUserId))
    .where(
      and(
        eq(accountOwnershipClaims.ownerPlayerId, playerId),
        eq(accounts.playerId, playerId),
        inArray(accountOwnershipClaims.status, ['open', 'approved', 'transferring']),
      ),
    )
    .orderBy(desc(accountOwnershipClaims.createdAt));
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    rsn: r.rsn,
    mode: r.mode as ClaimMode,
    status: r.status as ClaimStatus,
    createdAt: r.createdAt,
    deadlineAt: r.deadlineAt,
    claimantName: r.displayName || r.discordUsername || 'another Anvil player',
  }));
}

export type ClaimantClaimView = {
  id: number;
  rsn: string;
  mode: ClaimMode | null;
  status: ClaimStatus;
  createdAt: string;
  deadlineAt: string | null;
  line: string;
};

async function claimantView(row: ClaimRow, rsn: string): Promise<ClaimantClaimView> {
  let target: string | null = null;
  if (row.status === 'verifying' && row.verificationAttemptId) {
    const attempt = await db.query.verificationAttempts.findFirst({ where: eq(verificationAttempts.id, row.verificationAttemptId) });
    target = attempt ? targetOf(attempt) : null;
  }
  return {
    id: row.id,
    rsn,
    mode: row.mode as ClaimMode | null,
    status: row.status as ClaimStatus,
    createdAt: row.createdAt,
    deadlineAt: row.deadlineAt,
    line: claimantLine({ ...row, target }, rsn),
  };
}

/** This login's person's own claims, newest first — never naming an owner. */
export async function myOwnershipClaims(userId: number, limit = 20): Promise<ClaimantClaimView[]> {
  const me = await personOf(userId);
  if (me == null) return [];
  const rows = await db
    .select({ claim: accountOwnershipClaims, rsn: accounts.rsn })
    .from(accountOwnershipClaims)
    .innerJoin(accounts, eq(accounts.id, accountOwnershipClaims.accountId))
    .where(eq(accountOwnershipClaims.claimantPlayerId, me))
    .orderBy(desc(accountOwnershipClaims.createdAt))
    .limit(limit);
  return Promise.all(rows.map((r) => claimantView(r.claim, r.rsn)));
}

/** For the plugin panel: this login's latest claim on the character it is playing (by name), if any. */
export async function myClaimOn(userId: number, character: PlayedCharacter): Promise<ClaimantClaimView | null> {
  const me = await personOf(userId);
  if (me == null) return null;
  const account = await accountForCharacter({ ...character, accountHash: null });
  if (!account) return null;
  const row = await db.query.accountOwnershipClaims.findFirst({
    where: and(eq(accountOwnershipClaims.accountId, account.id), eq(accountOwnershipClaims.claimantPlayerId, me)),
    orderBy: desc(accountOwnershipClaims.createdAt),
  });
  return row ? claimantView(row, account.rsn) : null;
}

/** This login's in-site notices, newest first; marks them read. */
export async function noticesFor(userId: number, limit = 20) {
  const rows = await db.select().from(userNotices).where(eq(userNotices.userId, userId)).orderBy(desc(userNotices.id)).limit(limit);
  const unread = rows.filter((r) => r.readAt == null).map((r) => r.id);
  if (unread.length) await db.update(userNotices).set({ readAt: new Date().toISOString() }).where(inArray(userNotices.id, unread));
  return rows;
}

/** Unread notices: the settings nav badge. */
export async function unreadNoticeCount(userId: number): Promise<number> {
  return (await db.select({ id: userNotices.id }).from(userNotices).where(and(eq(userNotices.userId, userId), isNull(userNotices.readAt)))).length;
}

// ── Discord ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Discord DM to a login, through Anvil's own bot or else the bot of a clan they sit in (a bot can
 * only DM someone it shares a server with). Best effort; the in-site notice is the record.
 */
async function discordDm(userId: number, msg: { title: string; description: string }): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { discordId: true, playerId: true } });
  const { isRealDiscordId } = await import('@/lib/anvilDiscordRoles');
  if (!isRealDiscordId(user?.discordId)) return false;
  const { getBotTokenOnly, sharedBotToken } = await import('@/lib/discord-roles');
  const { sendDm } = await import('@/lib/onboardingNudge');
  const { ANVIL_LOGO_URL, EMBED_COLOR, POWERED_BY } = await import('@/lib/discordEmbeds');
  const { absoluteUrl } = await import('@/lib/seo');
  const tokens = new Set<string>();
  const shared = sharedBotToken();
  if (shared) tokens.add(shared);
  if (user!.playerId != null) {
    // clan-scope: global -- the person's own seats, to find a bot that shares a server with them.
    const seats = await findRosterSeats(and(eq(clanRoster.playerId, user!.playerId), isNull(clanRoster.leftAt)));
    for (const clanId of [...new Set(seats.map((s) => s.clanId))].slice(0, 3)) {
      const bot = await getBotTokenOnly(clanId).catch(() => null);
      if (bot) tokens.add(bot.token);
    }
  }
  const body = {
    embeds: [
      {
        title: msg.title,
        description: msg.description,
        url: absoluteUrl('/settings/claims'),
        color: EMBED_COLOR.amber,
        footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
      },
    ],
  };
  for (const token of tokens) {
    if (await sendDm(token, user!.discordId!, body).catch(() => false)) return true;
  }
  return false;
}
