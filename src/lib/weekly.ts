import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { accounts, clanMemberships, clanRoster, pendingRenames, playerSnapshots, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { fetchHiscoresOnce, fetchSnapshotWithRetry, type HiscoresSnapshot } from '@/lib/hiscores';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { checkRateSpike, describeRateSpike } from '@/lib/gainsValidation';
import { computeEhpEhb } from '@/lib/efficiency';
import { EFFICIENCY_SCALE } from '@/lib/constants';
import { log } from '@/lib/logger';

// Re-exported for callers that still reference the type via '@/lib/weekly'.
export type { HiscoresSnapshot };

// Legacy clan-wide "include guests" toggle. Enrollment no longer reads it — each competition
// carries its own `includeGuests` flag (set on the create form, default on) — but it still seeds
// that form's initial state for clans that set it, so an admin who deliberately excluded guests
// doesn't get them back by surprise on the next comp they create.
const WEEKLY_TRACK_GUESTS_KEY = 'weekly_track_guests';

export async function defaultIncludeGuests(clanId: number): Promise<boolean> {
  const value = await getSetting(clanId, WEEKLY_TRACK_GUESTS_KEY);
  // Only an explicit "off" opts out; unset means include, which is the new default.
  return !(value === 'false' || value === '0');
}

/**
 * Enroll every active clan member into a competition. The pool comes from the
 * plugin-synced clan roster (`clan_members` with `left_at IS NULL`). Discord
 * login is NOT required — weekly comps are clan-wide by design, so nobody has
 * to opt in: the roster IS the entry list.
 *
 * Guests (`is_guest = 1`) come along when the competition's own `includeGuests`
 * flag is set, which is the default for new comps. Turn it off at creation for
 * a members-only comp; either way an admin can still add or remove individuals
 * through the participants endpoint.
 */
export async function enrollAllPlayers(competitionId: number) {
  const comp = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.id, competitionId),
    columns: { includeGuests: true },
  });
  // A comp that vanished between scheduling and this call has nobody to enroll.
  if (!comp) return 0;
  const trackGuests = comp.includeGuests === 1;
  // Skip unranked/banned/archived members — re-enrolling them just re-creates rows the
  // cron will immediately quarantine. They become eligible again when a re-probe job
  // (or manual mod action) flips status back to 'active'.
  const baseClause = and(isNull(clanRoster.leftAt), eq(clanRoster.status, 'active'));
  const whereClause = trackGuests
    ? baseClause
    : and(baseClause, eq(clanRoster.kind, 'member'));

  const activeMembers = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn })
    .from(clanRoster)
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

/**
 * Light-weight reachability probe — used by the cron's re-probe pass to lift
 * `unranked` members back to `active` when they reappear on hiscores. Reuses the
 * shared snapshot fetch (osrs-json-hiscores doesn't expose a HEAD-like check) but
 * doesn't read any metric, so callers can ignore the parsed payload.
 */
export async function probeRsnReachable(rsn: string): Promise<'reachable' | 'unranked' | 'transient'> {
  const result = await fetchSnapshotWithRetry(rsn);
  return result.kind === 'value' ? 'reachable' : result.kind;
}

/**
 * Tagged result for a weekly metric read. WOM-style separation so the caller can react
 * differently to "the account isn't on hiscores" (terminal — flip status to unranked,
 * stop wasting future cron slots) vs "the call broke transiently" (retry next tick).
 *
 * `snapshot` is the full hiscores response — included on success so callers can
 * persist a player_snapshots row in the same trip (no second hiscores call needed).
 */
/** What a weekly competition ranks by. 'efficiency' pairs with metric 'ehp' | 'ehb'. */
export type CompetitionType = 'skill' | 'boss' | 'efficiency';

export type FetchResult =
  | { kind: 'value'; value: number; snapshot: HiscoresSnapshot }
  | { kind: 'unranked' }            // 404 from hiscores OR validator rejected the RSN string outright
  | { kind: 'transient' };          // network / timeout / parse error — try again later

/**
 * Extract a single competition metric out of an already-fetched hiscores snapshot. Split from the
 * fetch so the unified stat sweep — which fetches each member's snapshot ONCE for both bingo tiles
 * and every weekly metric — can reuse it without a second network call.
 */
export function readMetricFromSnapshot(
  snapshot: HiscoresSnapshot,
  type: CompetitionType,
  metric: string,
): FetchResult {
  // Efficiency comps read a DERIVED value: the whole snapshot condensed to hours by our own engine
  // (lib/efficiency.ts), not a single field. Stored in milli-hours so the integer columns and the
  // atomic-MAX update keep working — see EFFICIENCY_SCALE.
  if (type === 'efficiency') {
    if (!snapshot.skills || !snapshot.bosses) return { kind: 'transient' };
    const { ehp, ehb } = computeEhpEhb(snapshot);
    const hours = metric === 'ehb' ? ehb : ehp;
    if (!Number.isFinite(hours)) return { kind: 'transient' };
    return { kind: 'value', value: Math.round(hours * EFFICIENCY_SCALE), snapshot };
  }
  if (type === 'skill') {
    const xp = snapshot.skills?.[metric]?.xp;
    if (typeof xp !== 'number') return { kind: 'transient' };
    return { kind: 'value', value: xp, snapshot };
  }
  const boss = snapshot.bosses?.[metric];
  // A missing key means our parser doesn't know this boss AT ALL (hiscores lists every
  // activity for a ranked player, unranked ones with score -1) — writing 0 here is what
  // froze whole competitions at baseline 0 when Maggot King predated the parser's boss
  // list. Treat it as a failed read so no value (and no baseline) is ever written.
  if (!boss) {
    log.warn('weekly.metric-unknown', { metric });
    return { kind: 'transient' };
  }
  // boss.score < 0 means the player is on hiscores but unranked for this boss — that's
  // a real "0 KC" value, not a fetch failure.
  if (boss.score < 0) return { kind: 'value', value: 0, snapshot };
  return { kind: 'value', value: boss.score, snapshot };
}

/**
 * Fetch a participant's stat value from OSRS Hiscores. Bounded with a timeout and one
 * retry — distinguishes terminal (`unranked`) from transient failures so the cron can
 * stop chasing dead RSNs. Thin wrapper: one shared fetch, then extract the metric.
 */
export async function fetchParticipantStat(
  rsn: string,
  type: CompetitionType,
  metric: string,
): Promise<FetchResult> {
  const result = await fetchSnapshotWithRetry(rsn);
  if (result.kind !== 'value') return result;
  return readMetricFromSnapshot(result.snapshot, type, metric);
}

export interface WeeklyValueUpdate {
  participantId: number;
  type: CompetitionType;
  metric: string;
  /** Freshly observed ABSOLUTE value: effective max(hiscores, live) from the sweep, or the pushed live value. */
  value: number;
  baselineValue: number | null;
  currentValue: number | null;
  lastUpdated: string | null;
  /**
   * true (sweep) captures a first baseline when none exists — set to `value`, which the sweep passes as
   * max(hiscores, live) so a mid-session logout flush is absorbed into the baseline (gain starts at 0).
   * false (live push) skips a baseline-less row entirely: the first big push before any hiscores read
   * must NOT become the baseline (it would zero out the whole session), so the sweep sets it instead.
   */
  allowFirstCapture: boolean;
  /** Competition start — the elapsed-time anchor for the implausible-gain check (cumulative gain
   *  over comp time, not the sweep interval). Null skips the check. */
  competitionStartIso?: string | null;
  now?: string;
}

export type WeeklyValueOutcome =
  | 'first-captured'
  | 'updated'
  | 'negative-ignored'
  | 'skipped-no-baseline';

/**
 * Apply one freshly-observed absolute stat value to a weekly participant. The single definition of
 * "credit a weekly gain", shared by the unified hiscores sweep AND the real-time plugin live-push, so
 * both move SOTW/BOTW identically: negative-gain guard (never overwrite a higher value with a lower —
 * post-rename takeover), stale-baseline spike flag (flag, never clamp), and a monotonic currentValue
 * written with an atomic MAX so a concurrent sweep/push can't lose an update. Does NOT write
 * player_snapshots — the sweep does that separately when it holds the full snapshot.
 */
export async function applyWeeklyValue(u: WeeklyValueUpdate): Promise<{ outcome: WeeklyValueOutcome; flagged: boolean }> {
  const nowIso = u.now ?? new Date().toISOString();

  if (u.baselineValue === null) {
    // No baseline yet. The sweep captures baseline = current = value (max(hiscores, live)); the live
    // push refuses (would zero the session) and defers to the sweep.
    if (!u.allowFirstCapture) return { outcome: 'skipped-no-baseline', flagged: false };
    await db
      .update(weeklyParticipants)
      .set({ baselineValue: u.value, currentValue: u.value, lastUpdated: nowIso })
      .where(eq(weeklyParticipants.id, u.participantId));
    return { outcome: 'first-captured', flagged: false };
  }

  // Negative-gains guard: a lower fetched value than stored almost always means a different account
  // now holds this RSN (post-rename takeover) — bump lastUpdated to advance the queue, keep prior progress.
  if (u.currentValue !== null && u.value < u.currentValue) {
    await db.update(weeklyParticipants).set({ lastUpdated: nowIso }).where(eq(weeklyParticipants.id, u.participantId));
    return { outcome: 'negative-ignored', flagged: false };
  }

  const updates: Record<string, unknown> = {
    // Atomic monotonic max — race-safe when a sweep and a live push write between each other's read/write.
    // GREATEST, not max(): max() is an AGGREGATE in Postgres and would not take two scalars.
    currentValue: sql`greatest(coalesce(${weeklyParticipants.currentValue}, 0), ${u.value})`,
    lastUpdated: nowIso,
  };

  // Flag an implausible CUMULATIVE gain — one that couldn't be earned in the elapsed comp time (a
  // stale baseline that swept pre-event XP into the gain). Measured over the comp, NOT the sweep
  // interval, so an honest logout flush isn't false-flagged. Flag — never clamp — so an admin
  // corrects the baseline by hand. Only set, never clear here.
  let flagged = false;
  if (u.baselineValue !== null) {
    const spike = checkRateSpike({
      type: u.type,
      metric: u.metric,
      gained: u.value - u.baselineValue,
      sinceIso: u.competitionStartIso ?? null,
      toIso: nowIso,
    });
    if (spike.flagged) {
      updates.flagged = 1;
      updates.flagReason = describeRateSpike(u.type, spike);
      flagged = true;
    }
  }
  await db.update(weeklyParticipants).set(updates).where(eq(weeklyParticipants.id, u.participantId));
  return { outcome: 'updated', flagged };
}

/**
 * Persist a player's stats for one competition. We keep exactly two rows per
 * (member, competition):
 *   - 'baseline': inserted once on the member's first tick in the competition, then frozen.
 *   - 'current':  upserted every tick — overwritten with the latest stats until the event ends.
 *
 * This bounds player_snapshots at 2 rows per member per competition (the unbounded
 * append-per-tick model is what ballooned the table to 260k rows / 1.2GB). Best-effort:
 * callers don't fail the surrounding fetch loop when this errors. `overallXp` is denormalized
 * out of the JSON payload for cheap ORDER BY and the rename detector's "latest XP" probe.
 */
export async function writePlayerSnapshot(
  accountId: number,
  weeklyCompetitionId: number,
  snapshot: HiscoresSnapshot,
): Promise<void> {
  const rawOverall = snapshot.skills?.overall?.xp;
  const overallXp = typeof rawOverall === 'number' ? rawOverall : null;
  const payload = JSON.stringify(snapshot);
  try {
    // Baseline: write once, never touch again (ON CONFLICT DO NOTHING freezes it).
    await db
      .insert(playerSnapshots)
      .values({ accountId, weeklyCompetitionId, kind: 'baseline', payload, overallXp })
      .onConflictDoNothing();

    // Current: one row per (member, competition), overwritten each tick. The setWhere guard
    // skips the write entirely when the stats are byte-identical to what's already stored, so
    // an idle player costs nothing.
    await db
      .insert(playerSnapshots)
      .values({ accountId, weeklyCompetitionId, kind: 'current', payload, overallXp })
      .onConflictDoUpdate({
        target: [playerSnapshots.accountId, playerSnapshots.weeklyCompetitionId, playerSnapshots.kind],
        set: { payload, overallXp, capturedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')` },
        setWhere: ne(playerSnapshots.payload, payload),
      });
  } catch (err) {
    log.warn('player-snapshots.write-fail', { accountId, weeklyCompetitionId }, err);
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

  const cm = await findRosterSeat(eq(clanRoster.id, input.clanMemberId));
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
  const conflict = await findRosterSeat(and(
      eq(clanRoster.rsnNormalized, pr.newRsnNormalized),
      ne(clanRoster.id, pr.clanMemberId),
    ));
  if (conflict) {
    const stale = conflict.leftAt != null || conflict.status !== 'active';
    if (!stale) {
      return { ok: false, reason: 'target RSN held by another active clan member' };
    }
    // Soft-archive the stale row so the unique index on rsn_normalized frees up.
    await db
      .update(clanMemberships)
      .set({ leftAt: conflict.leftAt ?? new Date().toISOString() })
      .where(eq(clanMemberships.id, conflict.id));
    await updateAccountOfSeat(conflict.id, {
      status: 'archived',
      statusLastChecked: new Date().toISOString(),
    });
  }

  const cm = await findRosterSeat(eq(clanRoster.id, pr.clanMemberId));
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
    .update(accounts)
    .set({
      rsn: pr.newRsn,
      rsnNormalized: pr.newRsnNormalized,
      previousRsns: JSON.stringify(previousRsns),
      // If we'd quarantined this member because the old name 404'd, the rename
      // brings them back to 'active'. Otherwise preserve the existing status.
      status: cm.status === 'unranked' ? 'active' : cm.status,
      statusLastChecked: new Date().toISOString(),
    })
    .where(eq(clanMemberships.id, pr.clanMemberId));

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
    isNull(clanRoster.leftAt),
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
      // Carried so a board can join a participant to their daily history and mark a stale baseline.
      // computeLeaderboard ignores the extra columns.
      clanMemberId: weeklyParticipants.clanMemberId,
      flagged: weeklyParticipants.flagged,
      flagReason: weeklyParticipants.flagReason,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(weeklyParticipants.competitionId, competitionId), countsTowardLeaderboard()));
}

/**
 * Compute a sorted leaderboard from participants.
 *
 * Ties break by name. A boss week's top is regularly a tie — 4, 4, 1, 1 — and with only the gain to
 * sort on, two identical numbers keep whatever order the rows arrived in, so the same board can
 * name a different leader on the next load. Alphabetical isn't fairer than any other rule, but it
 * is the same every time, which is what a leaderboard has to be.
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
    .sort((a, b) => b.gained - a.gained || a.rsn.localeCompare(b.rsn));
}
