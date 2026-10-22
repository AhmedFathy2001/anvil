// The pure half of the late-joiner starting-stats capture (lib/startingStats).
//
// A player put onto a RUNNING event used to wait for the next stats sweep for their starting line,
// and nothing on the roster said so. These rules decide two things, with no database behind them so
// they are tested directly (tests/starting-stats.test.ts):
//
//   shouldCaptureNow     — is this participant worth a hiscores read right now?
//   startingStatsStatus  — what the roster says about them ("Capturing starting stats…" and so on).
//
// The start line itself is still lib/statTracking's: a baseline taken before the event started is
// never trusted (needsBaselineRecapture), and a partial starting-shot baseline is not finished until
// a hiscores read fills it. Before the start nothing here does anything — baselines are only ever
// taken at or after the whistle, on purpose.

import { isPartialBaselineJson, needsBaselineRecapture } from '@/lib/statTracking';
import { parseStamp } from '@/lib/dbTime';

export interface StartingStatsEvent {
  startDate: string | null;
  endDate: string | null;
  forceEndedAt?: string | null;
}

export interface StartingStatsParticipant {
  teamId: number | null;
  frozenAt: string | null;
  statsSnapshot: string | null;
  snapshotAt: string | null;
  pickedAt: string | null;
}

/** A capture attempt this process made for the participant: when it finished, and whether it landed. */
export interface StartingStatsAttempt {
  ok: boolean;
  at: number;
}

export type StartingStatsStatus =
  | { state: 'pending' }
  | { state: 'failed' }
  | { state: 'taken'; at: string };

/** How the roster polls while somebody is still pending: every 5s, for at most two minutes. */
export const STARTING_STATS_POLL_MS = 5_000;
export const STARTING_STATS_POLL_WINDOW_MS = 2 * 60_000;

/**
 * A starting line taken this long after the start is reported as "taken late" even when we can't
 * tell the player was added late (an account swap, a reset): it is the honest answer either way.
 * Players on the board at the whistle are captured within a sweep or two, well inside this.
 */
const LATE_SNAPSHOT_MS = 30 * 60_000;

/** Started (a start is set and has passed) and not over. An undated event is left to the sweep. */
export function eventIsRunning(event: StartingStatsEvent, nowMs: number): boolean {
  if (event.forceEndedAt) return false;
  const start = parseStamp(event.startDate);
  if (start == null || start > nowMs) return false;
  const end = parseStamp(event.endDate);
  if (end != null && end < nowMs) return false;
  return true;
}

/** No usable start line: none at all, one from before the start, or a partial one still unfilled. */
export function needsStartingStats(event: StartingStatsEvent, p: StartingStatsParticipant): boolean {
  return needsBaselineRecapture(p.statsSnapshot, p.snapshotAt, event.startDate) || isPartialBaselineJson(p.statsSnapshot);
}

/**
 * Worth a hiscores read right now. Mirrors the sweep's own filter: on a team (a pool player scores
 * nothing yet), not benched (benched players are pinned to frozenStats), and still missing a start
 * line — on an event that is running.
 */
export function shouldCaptureNow(event: StartingStatsEvent, p: StartingStatsParticipant, nowMs: number): boolean {
  if (!eventIsRunning(event, nowMs)) return false;
  if (p.teamId == null || p.frozenAt) return false;
  return needsStartingStats(event, p);
}

/** Placed on their team after the event started — the case the roster line is for. */
export function joinedAfterStart(event: StartingStatsEvent, p: StartingStatsParticipant): boolean {
  const start = parseStamp(event.startDate);
  if (start == null) return false;
  const picked = parseStamp(p.pickedAt);
  if (picked != null && picked > start) return true;
  const snap = parseStamp(p.snapshotAt);
  return snap != null && snap - start > LATE_SNAPSHOT_MS;
}

/**
 * The roster line for one participant, or null for "say nothing":
 *
 *   pending — no start line yet, and nothing has failed (a capture is running, or about to)
 *   failed  — the last capture this process tried could not read their hiscores
 *   taken   — they have one; only reported for late joiners (or ones this process just captured),
 *             so the roster isn't noisy
 *
 * Nothing before the start, for pool players or for benched players.
 */
export function startingStatsStatus(
  event: StartingStatsEvent,
  p: StartingStatsParticipant,
  nowMs: number,
  lastAttempt?: StartingStatsAttempt | null,
): StartingStatsStatus | null {
  if (!eventIsRunning(event, nowMs)) return null;
  if (p.teamId == null || p.frozenAt) return null;
  if (needsStartingStats(event, p)) {
    return lastAttempt && !lastAttempt.ok ? { state: 'failed' } : { state: 'pending' };
  }
  // Late if we can tell from the row, or because this process is what just captured them.
  if (!p.snapshotAt || !(joinedAfterStart(event, p) || lastAttempt?.ok)) return null;
  return { state: 'taken', at: p.snapshotAt };
}

// ── Weekly competitions (SOTW / BOTW) ────────────────────────────────────────────────────────────
// A weekly start line is one number (weekly_participants.baselineValue), first captured by the sweep
// once the competition is active. Somebody added mid-competition gets theirs straight away instead.

export interface StartingStatsCompetition {
  status: string;
  startDate: string;
  endDate: string | null;
}

/** Active, started and not yet over. */
export function weeklyIsRunning(comp: StartingStatsCompetition, nowMs: number): boolean {
  if (comp.status !== 'active') return false;
  const start = parseStamp(comp.startDate);
  if (start == null || start > nowMs) return false;
  const end = parseStamp(comp.endDate);
  return end == null || end >= nowMs;
}

export function shouldCaptureWeeklyNow(
  comp: StartingStatsCompetition,
  p: { baselineValue: number | null },
  nowMs: number,
): boolean {
  return weeklyIsRunning(comp, nowMs) && p.baselineValue === null;
}

/**
 * The weekly row's line. A weekly row keeps no capture time, so "taken" is only reported when this
 * process is what just took it — exactly the late-add case, and quiet for everyone else.
 */
export function weeklyStartingStatsStatus(
  comp: StartingStatsCompetition,
  p: { baselineValue: number | null },
  nowMs: number,
  lastAttempt?: StartingStatsAttempt | null,
): StartingStatsStatus | null {
  if (!weeklyIsRunning(comp, nowMs)) return null;
  if (p.baselineValue === null) return lastAttempt && !lastAttempt.ok ? { state: 'failed' } : { state: 'pending' };
  if (lastAttempt?.ok) return { state: 'taken', at: new Date(lastAttempt.at).toISOString() };
  return null;
}
