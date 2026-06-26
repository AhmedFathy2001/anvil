import { db } from '@/db';
import { clanMembers, pendingRenames, playerSnapshots, settings, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { log } from '@/lib/logger';

export interface HiscoresSnapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

// Setting key for the "include guests in weekly auto-enrollment" toggle.
// Default off — guests are typically not part of the clan-wide weekly comp.
// Admins can flip this from the settings UI for events where guests should be tracked.
const WEEKLY_TRACK_GUESTS_KEY = 'weekly_track_guests';

async function shouldTrackGuests(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, WEEKLY_TRACK_GUESTS_KEY) });
  return row?.value === 'true' || row?.value === '1';
}

/**
 * Enroll every active clan member into a competition. The pool comes from the
 * plugin-synced clan roster (`clan_members` with `left_at IS NULL`). Discord
 * login is NOT required — weekly comps are clan-wide by design.
 *
 * Guests (`is_guest = 1`) are excluded by default. Set the `weekly_track_guests`
 * setting to "true" to also enroll them, or use the per-event participants
 * endpoint to manually add specific guests for one comp.
 */
export async function enrollAllPlayers(competitionId: number) {
  const trackGuests = await shouldTrackGuests();
  // Skip unranked/banned/archived members — re-enrolling them just re-creates rows the
  // cron will immediately quarantine. They become eligible again when a re-probe job
  // (or manual mod action) flips status back to 'active'.
  const baseClause = and(isNull(clanMembers.leftAt), eq(clanMembers.status, 'active'));
  const whereClause = trackGuests
    ? baseClause
    : and(baseClause, eq(clanMembers.isGuest, 0));

  const activeMembers = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(whereClause);

  // Count only rows actually inserted (not conflicts that hit the unique index) so
  // callers can tell "did anyone new join this comp on this run". .returning() yields
  // an empty array when onConflictDoNothing suppresses the insert.
  let enrolled = 0;
  for (const m of activeMembers) {
    try {
      const inserted = await db
        .insert(weeklyParticipants)
        .values({
          competitionId,
          clanMemberId: m.id,
          rsn: m.rsn,
          rsnNormalized: normalizeRsn(m.rsn),
        })
        .onConflictDoNothing()
        .returning({ id: weeklyParticipants.id });
      if (inserted.length > 0) enrolled++;
    } catch {
      // Skip on conflict/error — keep counting what we could add
    }
  }
  return enrolled;
}

const HISCORES_TIMEOUT_MS = 8000;
const HISCORES_RETRY_DELAY_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${tag} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function fetchHiscoresOnce(rsn: string): Promise<HiscoresSnapshot> {
  // Strip any non-ASCII whitespace before handing to the lib — its validateRSN regex
  // rejects U+00A0 outright. Defense in depth; we also clean on write, but legacy
  // rows still in the table need this until they're backfilled.
  const cleanRsn = sanitizeRsn(rsn);
  return (await withTimeout(
    getStatsByGamemode(cleanRsn) as Promise<HiscoresSnapshot>,
    HISCORES_TIMEOUT_MS,
    `hiscores(${cleanRsn})`,
  ));
}

/**
 * Light-weight reachability probe — used by the cron's re-probe pass to lift
 * `unranked` members back to `active` when they reappear on hiscores. Reuses the
 * full snapshot fetch (osrs-json-hiscores doesn't expose a HEAD-like check) but
 * doesn't read any metric, so callers can ignore the parsed payload.
 */
export async function probeRsnReachable(rsn: string): Promise<'reachable' | 'unranked' | 'transient'> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await fetchHiscoresOnce(rsn);
      return 'reachable';
    } catch (err) {
      const classification = classifyError(err);
      if (classification === 'unranked') return 'unranked';
      if (attempt === 2) return 'transient';
      await new Promise((r) => setTimeout(r, HISCORES_RETRY_DELAY_MS));
    }
  }
  return 'transient';
}

/**
 * Tagged result for a hiscores fetch. WOM-style separation so the caller can react
 * differently to "the account isn't on hiscores" (terminal — flip status to unranked,
 * stop wasting future cron slots) vs "the call broke transiently" (retry next tick).
 *
 * `snapshot` is the full hiscores response — included on success so callers can
 * persist a player_snapshots row in the same trip (no second hiscores call needed).
 */
export type FetchResult =
  | { kind: 'value'; value: number; snapshot: HiscoresSnapshot }
  | { kind: 'unranked' }            // 404 from hiscores OR validator rejected the RSN string outright
  | { kind: 'transient' };          // network / timeout / parse error — try again later

function classifyError(err: unknown): 'unranked' | 'transient' {
  const msg = err instanceof Error ? err.message : String(err);
  // osrs-json-hiscores throws "Player not found" on 404 and "RSN contains invalid character"
  // / "RSN must be between..." for client-side validator rejections. All of those mean
  // "do not keep polling this RSN" — flip to unranked and have a human / re-probe fix it.
  if (/not found|invalid character|must be between|must be a string/i.test(msg)) return 'unranked';
  return 'transient';
}

/**
 * Fetch a participant's stat value from OSRS Hiscores. Bounded with a timeout and one
 * retry — distinguishes terminal (`unranked`) from transient failures so the cron can
 * stop chasing dead RSNs.
 */
export async function fetchParticipantStat(
  rsn: string,
  type: 'skill' | 'boss',
  metric: string,
): Promise<FetchResult> {
  let stats: HiscoresSnapshot | null = null;
  let lastClassification: 'unranked' | 'transient' = 'transient';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      stats = await fetchHiscoresOnce(rsn);
      break;
    } catch (err) {
      lastClassification = classifyError(err);
      // Don't retry an unranked / invalid RSN — the second attempt will fail identically
      // because nothing about the input or hiscores presence changes inside 1.5 s.
      if (lastClassification === 'unranked') {
        log.warn('hiscores.unranked', { rsn });
        return { kind: 'unranked' };
      }
      if (attempt === 2) {
        log.warn('hiscores.fail', { rsn, attempt }, err);
        return { kind: 'transient' };
      }
      await new Promise((r) => setTimeout(r, HISCORES_RETRY_DELAY_MS));
    }
  }
  if (!stats) return { kind: 'transient' };

  if (type === 'skill') {
    const xp = stats.skills?.[metric]?.xp;
    if (typeof xp !== 'number') return { kind: 'transient' };
    return { kind: 'value', value: xp, snapshot: stats };
  }
  const boss = stats.bosses?.[metric];
  // boss.score < 0 means the player is on hiscores but unranked for this boss — that's
  // a real "0 KC" value, not a fetch failure.
  if (!boss || boss.score < 0) return { kind: 'value', value: 0, snapshot: stats };
  return { kind: 'value', value: boss.score, snapshot: stats };
}

/**
 * Persist a player_snapshots row. Best-effort — callers don't fail the surrounding
 * fetch loop when this errors (logging happens here). `overallXp` is denormalized
 * out of the JSON payload for cheap ORDER BY / "did anything change" queries.
 */
export async function writePlayerSnapshot(
  clanMemberId: number,
  snapshot: HiscoresSnapshot,
): Promise<void> {
  const overallXp = snapshot.skills?.overall?.xp;
  try {
    await db.insert(playerSnapshots).values({
      clanMemberId,
      payload: JSON.stringify(snapshot),
      overallXp: typeof overallXp === 'number' ? overallXp : null,
    });
  } catch (err) {
    log.warn('player-snapshots.write-fail', { clanMemberId }, err);
  }
}

export interface LeaderboardEntry {
  rsn: string;
  baselineValue: number | null;
  currentValue: number | null;
  gained: number;
}

/**
 * Propagate an in-game rename into active weekly_participants. Without this, an old RSN
 * stays enrolled (and the hiscores lookup 404s forever), while the next plugin enroll under
 * the new RSN inserts a second row — leaving the clan_member tracked twice with neither
 * row accumulating progress.
 *
 * If both old and new rows exist in a comp, the new row wins; any baseline from the old
 * row is transferred only when the new row hasn't fetched yet. The old row is then deleted.
 * If only the old row exists, we rename it in place.
 */
export async function applyRenameToActiveWeeklyParticipants(
  clanMemberId: number,
  oldRsn: string,
  newRsn: string,
): Promise<void> {
  const oldNorm = normalizeRsn(oldRsn);
  const newNorm = normalizeRsn(newRsn);
  if (oldNorm === newNorm) return;

  const activeComps = await db
    .select({ id: weeklyCompetitions.id })
    .from(weeklyCompetitions)
    .where(eq(weeklyCompetitions.status, 'active'));

  for (const comp of activeComps) {
    const oldRow = await db.query.weeklyParticipants.findFirst({
      where: and(
        eq(weeklyParticipants.competitionId, comp.id),
        eq(weeklyParticipants.rsnNormalized, oldNorm),
      ),
    });
    if (!oldRow) continue;

    const newRow = await db.query.weeklyParticipants.findFirst({
      where: and(
        eq(weeklyParticipants.competitionId, comp.id),
        eq(weeklyParticipants.rsnNormalized, newNorm),
      ),
    });

    if (newRow) {
      if (newRow.baselineValue === null && oldRow.baselineValue !== null) {
        await db
          .update(weeklyParticipants)
          .set({
            baselineValue: oldRow.baselineValue,
            currentValue: oldRow.currentValue,
            lastUpdated: oldRow.lastUpdated,
            clanMemberId,
          })
          .where(eq(weeklyParticipants.id, newRow.id));
      } else if (newRow.clanMemberId !== clanMemberId) {
        await db
          .update(weeklyParticipants)
          .set({ clanMemberId })
          .where(eq(weeklyParticipants.id, newRow.id));
      }
      await db.delete(weeklyParticipants).where(eq(weeklyParticipants.id, oldRow.id));
    } else {
      await db
        .update(weeklyParticipants)
        .set({ rsn: newRsn, rsnNormalized: newNorm, clanMemberId })
        .where(eq(weeklyParticipants.id, oldRow.id));
    }
  }
}

// =============================================================================
// Rename request flow (WOM-style)
// =============================================================================
//
// User submits "I renamed in-game" → we capture an old-name snapshot at submit
// time and queue the request. The hourly cron's reviewer pass picks a few off
// the queue, fetches the new name, runs the negative-gains heuristic, and
// auto-approves or denies. Approval propagates the rename into clan_members
// and any active weekly_participants via applyRenameToActiveWeeklyParticipants.
//
// This covers the gap where the RuneLite plugin's accountHash-based detection
// never fires (user renamed and didn't re-open the plugin) — without it, the
// clan_members row 404s every cron tick forever and the user silently falls
// off leaderboards.

export interface SubmitRenameInput {
  clanMemberId: number;
  newRsn: string;
  submittedByUserId: number | null;
}

export type SubmitRenameResult =
  | { ok: true; id: number }
  | { ok: false; reason: string };

export async function submitRenameRequest(input: SubmitRenameInput): Promise<SubmitRenameResult> {
  const newRsn = sanitizeRsn(input.newRsn);
  if (!newRsn) return { ok: false, reason: 'new RSN is required' };
  if (newRsn.length > 12) return { ok: false, reason: 'RSN must be 12 characters or fewer' };

  const cm = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.id, input.clanMemberId),
  });
  if (!cm) return { ok: false, reason: 'clan member not found' };

  const newRsnNormalized = normalizeRsn(newRsn);
  if (newRsnNormalized === cm.rsnNormalized) {
    return { ok: false, reason: 'new RSN matches the current one — nothing to change' };
  }

  // Refuse duplicate pending row for the same (member, new-name) — the existing
  // submission will move through the reviewer on its own.
  const duplicate = await db.query.pendingRenames.findFirst({
    where: and(
      eq(pendingRenames.clanMemberId, input.clanMemberId),
      eq(pendingRenames.newRsnNormalized, newRsnNormalized),
      eq(pendingRenames.status, 'pending'),
    ),
  });
  if (duplicate) return { ok: false, reason: 'a pending request for this rename already exists' };

  // Snapshot the OLD name's hiscores at submission time. If the old name 404s
  // already (rename happened a while back), we still accept the submission —
  // the reviewer just won't have a gains-check baseline and will fall back to
  // the lighter heuristic (new name reachable + no conflicting clan_member).
  let oldSnapshotJson = '{}';
  try {
    const stats = await fetchHiscoresOnce(cm.rsn);
    oldSnapshotJson = JSON.stringify(stats);
  } catch {
    // intentional — see comment above
  }

  const inserted = await db
    .insert(pendingRenames)
    .values({
      clanMemberId: input.clanMemberId,
      oldRsn: cm.rsn,
      newRsn,
      oldRsnNormalized: cm.rsnNormalized,
      newRsnNormalized,
      oldSnapshot: oldSnapshotJson,
      submittedByUserId: input.submittedByUserId,
    })
    .returning({ id: pendingRenames.id });

  return { ok: true, id: inserted[0].id };
}

interface HiscoresSkillEntry {
  rank: number;
  level: number;
  xp: number;
}

/**
 * Per-skill negative-gain check. If any skill XP on the new name is *lower* than
 * what we captured for the old name at submission time, a different account has
 * almost certainly taken the old name — block the rename.
 *
 * Tolerates skills that exist in one snapshot but not the other (hiscores
 * occasionally drops sub-rank-2M players from listings, mostly slayer/farming
 * at very low levels).
 */
function detectNegativeGains(
  oldSnapshot: HiscoresSnapshot | Record<string, never>,
  newStats: HiscoresSnapshot,
): boolean {
  const oldSkills = (oldSnapshot as HiscoresSnapshot).skills;
  if (!oldSkills || typeof oldSkills !== 'object') return false;
  for (const [name, raw] of Object.entries(oldSkills)) {
    const oldXp = (raw as HiscoresSkillEntry)?.xp;
    const newXp = newStats.skills?.[name]?.xp;
    if (typeof oldXp !== 'number' || typeof newXp !== 'number') continue;
    if (newXp < oldXp) return true;
  }
  return false;
}

async function markResolved(prId: number, status: 'approved' | 'denied', resolution: string): Promise<void> {
  await db
    .update(pendingRenames)
    .set({ status, resolution, reviewedAt: new Date().toISOString() })
    .where(eq(pendingRenames.id, prId));
}

interface PendingRow {
  id: number;
  clanMemberId: number;
  oldRsn: string;
  newRsn: string;
  oldRsnNormalized: string;
  newRsnNormalized: string;
  oldSnapshot: string;
}

async function approveRename(pr: PendingRow): Promise<{ ok: true } | { ok: false; reason: string }> {
  // If another clan_member already holds the new normalized RSN, we can only
  // proceed safely when it's clearly stale (left, unranked, or archived). An
  // active different member with the same target name is a swap that needs
  // human attention.
  const conflict = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.rsnNormalized, pr.newRsnNormalized),
      ne(clanMembers.id, pr.clanMemberId),
    ),
  });
  if (conflict) {
    const stale = conflict.leftAt != null || conflict.status !== 'active';
    if (!stale) {
      return { ok: false, reason: 'target RSN held by another active clan member' };
    }
    // Soft-archive the stale row so the unique index on rsn_normalized frees up.
    await db
      .update(clanMembers)
      .set({
        leftAt: conflict.leftAt ?? new Date().toISOString(),
        status: 'archived',
        statusLastChecked: new Date().toISOString(),
      })
      .where(eq(clanMembers.id, conflict.id));
  }

  const cm = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, pr.clanMemberId) });
  if (!cm) return { ok: false, reason: 'clan member no longer exists' };

  // Append the OLD rsn to previousRsns if it isn't already there.
  let previousRsns: string[] = [];
  if (cm.previousRsns) {
    try {
      const parsed = JSON.parse(cm.previousRsns);
      if (Array.isArray(parsed)) previousRsns = parsed;
    } catch {
      // ignore malformed legacy JSON
    }
  }
  if (cm.rsn && cm.rsn !== pr.newRsn && !previousRsns.includes(cm.rsn)) {
    previousRsns.push(cm.rsn);
  }

  await db
    .update(clanMembers)
    .set({
      rsn: pr.newRsn,
      rsnNormalized: pr.newRsnNormalized,
      previousRsns: JSON.stringify(previousRsns),
      // If we'd quarantined this member because the old name 404'd, the rename
      // brings them back to 'active'. Otherwise preserve the existing status.
      status: cm.status === 'unranked' ? 'active' : cm.status,
      statusLastChecked: new Date().toISOString(),
    })
    .where(eq(clanMembers.id, pr.clanMemberId));

  await applyRenameToActiveWeeklyParticipants(pr.clanMemberId, pr.oldRsn, pr.newRsn);

  return { ok: true };
}

/**
 * Auto-reviewer pass. Called once per cron tick with a small batch cap so we
 * stay within the function budget. Each pending row consumes up to 2 hiscores
 * calls (probe + full fetch for the gains check).
 */
export async function reviewPendingRenames(
  maxPerTick = 5,
): Promise<{ reviewed: number; approved: number; denied: number; deferred: number }> {
  const pending = await db
    .select()
    .from(pendingRenames)
    .where(eq(pendingRenames.status, 'pending'))
    .orderBy(asc(pendingRenames.createdAt))
    .limit(maxPerTick);

  let approved = 0;
  let denied = 0;
  let deferred = 0;

  for (const pr of pending) {
    const probe = await probeRsnReachable(pr.newRsn);
    if (probe === 'unranked') {
      await markResolved(pr.id, 'denied', 'New name not found on hiscores');
      denied++;
      continue;
    }
    if (probe === 'transient') {
      deferred++;
      continue;
    }

    let oldSnapshot: HiscoresSnapshot | Record<string, never> = {};
    try {
      const parsed = JSON.parse(pr.oldSnapshot);
      if (parsed && typeof parsed === 'object') oldSnapshot = parsed;
    } catch {
      // leave as empty — heuristic will simply be lighter for this submission
    }

    const hasOldStats =
      'skills' in oldSnapshot && oldSnapshot.skills && Object.keys(oldSnapshot.skills).length > 0;

    if (hasOldStats) {
      let newStats: HiscoresSnapshot;
      try {
        newStats = await fetchHiscoresOnce(pr.newRsn);
      } catch (err) {
        log.warn('pending-renames.fetch-new-fail', { id: pr.id, newRsn: pr.newRsn }, err);
        deferred++;
        continue;
      }
      if (detectNegativeGains(oldSnapshot, newStats)) {
        await markResolved(pr.id, 'denied', 'Negative gains detected — different account likely holds this name');
        denied++;
        continue;
      }
    }

    const result = await approveRename(pr);
    if (result.ok) {
      await markResolved(
        pr.id,
        'approved',
        hasOldStats ? 'Auto-approved: no negative gains, new name reachable' : 'Auto-approved: new name reachable (no old snapshot available)',
      );
      approved++;
    } else {
      await markResolved(pr.id, 'denied', `Approval blocked: ${result.reason}`);
      denied++;
    }
  }

  return { reviewed: pending.length, approved, denied, deferred };
}

/**
 * SQL predicate for "this participant still counts": no clan link (a manually-added guest),
 * or their clan_member hasn't left, or an admin set keepIfLeft to force-include them. Shared by
 * every leaderboard/headcount surface so the plugin, website, and public pages agree on who's in.
 */
export const countsTowardLeaderboard = () =>
  or(
    isNull(weeklyParticipants.clanMemberId),
    isNull(clanMembers.leftAt),
    eq(weeklyParticipants.keepIfLeft, 1),
  );

/**
 * Participants whose standings should count for a competition — everyone enrolled minus those
 * whose clan_member has left the CC (unless overridden). Drives the leaderboard and the headcount.
 */
export async function getEffectiveParticipants(competitionId: number) {
  return db
    .select({
      id: weeklyParticipants.id,
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
    })
    .from(weeklyParticipants)
    .leftJoin(clanMembers, eq(weeklyParticipants.clanMemberId, clanMembers.id))
    .where(and(eq(weeklyParticipants.competitionId, competitionId), countsTowardLeaderboard()));
}

/**
 * Compute a sorted leaderboard from participants.
 */
export function computeLeaderboard(
  participants: { rsn: string; baselineValue: number | null; currentValue: number | null }[],
): LeaderboardEntry[] {
  return participants
    .map((p) => ({
      rsn: p.rsn,
      baselineValue: p.baselineValue,
      currentValue: p.currentValue,
      gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
    }))
    .sort((a, b) => b.gained - a.gained);
}
