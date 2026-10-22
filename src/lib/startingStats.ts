// Take a late joiner's starting stats the moment they are put on a running event.
//
// Before this, somebody added after the start had no start line until the next stats sweep (15 min,
// longer for a plugin pusher) and the roster said nothing about it. Every path that puts a
// participant on a team calls `captureStartingStatsSoon` after its write; the capture runs after the
// response, so an admin never waits on the hiscores.
//
// It is the sweep's own capture, for one player (lib/statsSweep applyFetch):
//   - the decision is lib/startingStatsRules shouldCaptureNow → needsBaselineRecapture, so nothing
//     before the start is ever trusted, and before the start nothing happens at all;
//   - the stored baseline is baselineWithOverlay(read, live overlay), the overlay first reconciled
//     against the read and stripped of stale keys exactly as the sweep does (not persisted here —
//     the sweep owns the account's overlay);
//   - a partial starting-shot baseline is completed from the read (completePartialBaseline);
//   - a read with LESS overall XP than the account last had is somebody else's name — refused.
//
// Who talks to Jagex follows lib/sweepOwner. Site-owned: one direct read, as the event snapshot
// route does. Forge-owned: the read is queued in hiscores_fetches at the top lane and we wait for
// Forge to answer it; the row is left for the drain, which applies it as usual. Either way a miss
// leaves the participant without a start line, and the next sweep — which treats them as due — tries
// again. Nothing here ever writes a start line the sweep would not have written.
//
// Weekly competitions get the same treatment (captureWeeklyStartingStatsSoon): a participant added
// mid-competition has their baselineValue taken through the sweep's own weekly apply
// (readMetricFromSnapshot → effectiveValue → applyWeeklyValue, plus the competition's player
// snapshot).

import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clanRoster, eventParticipants, events, hiscoresFetches, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { fetchSnapshotWithRetry, parseHiscoresBody, type HiscoresSnapshot, type SnapshotFetch } from '@/lib/hiscores';
import { toFetchResult } from '@/lib/forgeFetchResult';
import { declaredSweepOwner } from '@/lib/sweepOwner';
import { normalizeRsn } from '@/lib/auth';
import { parsePluginStats } from '@/lib/pluginStats';
import { parseStatKeyTimes } from '@/lib/liveStats';
import {
  baselineWithOverlay,
  completePartialBaseline,
  effectiveValue,
  needsBaselineRecapture,
  pruneStaleOverlay,
  reconcileLive,
} from '@/lib/statTracking';
import {
  eventIsRunning,
  joinedAfterStart,
  needsStartingStats,
  shouldCaptureNow,
  shouldCaptureWeeklyNow,
  startingStatsStatus,
  weeklyIsRunning,
  weeklyStartingStatsStatus,
  type StartingStatsAttempt,
  type StartingStatsCompetition,
  type StartingStatsEvent,
  type StartingStatsParticipant,
  type StartingStatsStatus,
} from '@/lib/startingStatsRules';
import { log } from '@/lib/logger';
import { parseStamp } from '@/lib/dbTime';
import { applyWeeklyValue, readMetricFromSnapshot, writePlayerSnapshot, type CompetitionType } from '@/lib/weekly';

/** Same window as the sweep's (lib/statsSweep STALE_OVERLAY_MS). */
const STALE_OVERLAY_MS = 6.5 * 60 * 60 * 1000;
/** Let the caller's remaining writes land first (an enrol followed by a team placement). */
const SETTLE_MS = 750;
/** Gap between direct reads in one batch — the sweep's own per-request gap. */
const DIRECT_GAP_MS = 400;
/** One call never reads more than this many; a bigger batch is the sweep's job. */
const MAX_PER_CALL = 25;
/** The queue's top lane (schema hiscoresFetches: 0 = a competition is waiting). */
const QUEUE_PRIORITY = 0;
/** How long to wait on Forge before leaving it to the sweep. Inside the roster's 2-minute poll. */
const FORGE_WAIT_MS = 100_000;
const FORGE_POLL_MS = 2_000;
/** Attempt results kept for the roster line; older ones are forgotten. */
const ATTEMPT_TTL_MS = 60 * 60_000;

// In this process's memory: which captures are running, and how the last one for each row went.
// Only the roster line reads these — the start line itself is always the database's.
const inFlight = new Set<string>();
const attempts = new Map<string, StartingStatsAttempt>();
const eventKey = (id: number) => `e:${id}`;
const weeklyKey = (id: number) => `w:${id}`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function remember(key: string, ok: boolean) {
  const now = Date.now();
  attempts.set(key, { ok, at: now });
  if (attempts.size > 500) {
    for (const [k, a] of attempts) if (now - a.at > ATTEMPT_TTL_MS) attempts.delete(k);
  }
}

/** The last attempt for this row, or null while one is running (the roster then shows pending). */
function lastAttempt(key: string): StartingStatsAttempt | null {
  if (inFlight.has(key)) return null;
  const a = attempts.get(key);
  if (!a || Date.now() - a.at > ATTEMPT_TTL_MS) return null;
  return a;
}

/** The roster line for each event participant, keyed by id — what pages hand their roster component. */
export function startingStatsFor<P extends StartingStatsParticipant & { id: number }>(
  event: StartingStatsEvent,
  rows: P[],
  nowMs: number = Date.now(),
): Record<number, StartingStatsStatus> {
  const out: Record<number, StartingStatsStatus> = {};
  for (const r of rows) {
    const s = startingStatsStatus(event, r, nowMs, lastAttempt(eventKey(r.id)));
    if (s) out[r.id] = s;
  }
  return out;
}

/** The same for a weekly competition's participants. */
export function weeklyStartingStatsFor<P extends { id: number; baselineValue: number | null }>(
  comp: StartingStatsCompetition,
  rows: P[],
  nowMs: number = Date.now(),
): Record<number, StartingStatsStatus> {
  const out: Record<number, StartingStatsStatus> = {};
  for (const r of rows) {
    const s = weeklyStartingStatsStatus(comp, r, nowMs, lastAttempt(weeklyKey(r.id)));
    if (s) out[r.id] = s;
  }
  return out;
}

/** Run `fn` after the response, logging rather than throwing. */
function soon(tag: string, ctx: Record<string, unknown>, fn: () => Promise<unknown>): void {
  void (async () => {
    await delay(SETTLE_MS);
    await fn();
  })().catch((e) => log.warn(tag, { ...ctx, error: (e as Error).message }));
}

/**
 * Fire-and-forget: capture starting stats for these participants after the response. Safe to call
 * from any write that might have put somebody on a team — it does nothing before the start, for
 * anyone who already has a start line, and for anyone not on a team.
 *
 * With no ids it looks for late placements on the event (placed after the start, still without a
 * start line), for bulk paths that don't hand back who they moved.
 */
export function captureStartingStatsSoon(eventId: number, participantIds?: number[]): void {
  if (participantIds && participantIds.length === 0) return;
  // A fresh try: the roster reads "capturing" again rather than the last failure.
  for (const id of participantIds ?? []) attempts.delete(eventKey(id));
  soon('starting-stats.failed', { eventId }, () => captureStartingStats(eventId, participantIds));
}

/** Fire-and-forget: the weekly twin — participants added to an active SOTW/BOTW. */
export function captureWeeklyStartingStatsSoon(competitionId: number, participantIds: number[]): void {
  if (participantIds.length === 0) return;
  for (const id of participantIds) attempts.delete(weeklyKey(id));
  soon('starting-stats.weekly-failed', { competitionId }, () => captureWeeklyStartingStats(competitionId, participantIds));
}

type Tally = { captured: number; failed: number; skipped: number };

/**
 * Run one capture per row. Site-owned reads go one at a time with the sweep's gap; Forge-owned ones
 * are all queued at once and waited on together, since Forge paces them itself.
 */
async function runCaptures<R extends { id: number }>(
  rows: R[],
  keyOf: (id: number) => string,
  capture: (row: R, owner: 'site' | 'forge') => Promise<boolean>,
  logCtx: Record<string, unknown>,
): Promise<Tally> {
  const tally: Tally = { captured: 0, failed: 0, skipped: 0 };
  const owner = declaredSweepOwner();
  const due = rows.filter((r) => !inFlight.has(keyOf(r.id))).slice(0, MAX_PER_CALL);
  tally.skipped = rows.length - due.length;
  const one = async (row: R) => {
    const key = keyOf(row.id);
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      const ok = await capture(row, owner);
      remember(key, ok);
      if (ok) tally.captured++;
      else tally.failed++;
    } catch (e) {
      remember(key, false);
      tally.failed++;
      log.warn('starting-stats.capture-failed', { ...logCtx, rowId: row.id, error: (e as Error).message });
    } finally {
      inFlight.delete(key);
    }
  };
  if (owner === 'forge') {
    await Promise.all(due.map(one));
  } else {
    for (const [i, row] of due.entries()) {
      if (i > 0) await delay(DIRECT_GAP_MS);
      await one(row);
    }
  }
  if (due.length > 0) log.info('starting-stats.captured', { ...logCtx, owner, ...tally });
  return tally;
}

export async function captureStartingStats(eventId: number, participantIds?: number[]): Promise<Tally> {
  // clan-scope: global -- an id the calling route or lib already scoped; this runs after its response.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const nowMs = Date.now();
  if (!event || !eventIsRunning(event, nowMs)) return { captured: 0, failed: 0, skipped: 0 };

  const rows = await db
    .select()
    .from(eventParticipants)
    .where(
      participantIds
        ? and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.id, participantIds))
        : eq(eventParticipants.eventId, eventId),
    );
  const due = rows
    .filter((r) => shouldCaptureNow(event, r, nowMs))
    .filter((r) => participantIds != null || joinedAfterStart(event, r));
  return runCaptures(due, eventKey, (row, owner) => captureOne(event, row, owner), { eventId });
}

export async function captureWeeklyStartingStats(competitionId: number, participantIds: number[]): Promise<Tally> {
  // clan-scope: global -- an id the calling route already scoped (competitionForRequest).
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, competitionId) });
  const nowMs = Date.now();
  if (!comp || !weeklyIsRunning(comp, nowMs)) return { captured: 0, failed: 0, skipped: 0 };
  const rows = await db
    .select()
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, competitionId), inArray(weeklyParticipants.id, participantIds)));
  const due = rows.filter((r) => shouldCaptureWeeklyNow(comp, r, nowMs));
  return runCaptures(due, weeklyKey, (row, owner) => captureWeeklyOne(comp, row, owner), { competitionId });
}

type ParticipantRow = typeof eventParticipants.$inferSelect;
type EventRow = typeof events.$inferSelect;
type WeeklyRow = typeof weeklyParticipants.$inferSelect;
type CompRow = typeof weeklyCompetitions.$inferSelect;

interface SeatRead {
  snapshot: HiscoresSnapshot;
  /** When the read was taken — the start line's time. */
  at: string;
  accountId: number | null;
  /** The live overlay as the sweep would use it against this read. */
  overlay: Record<string, number>;
}

/**
 * One hiscores read for a seat, the way the sweep does it: by the seat's canonical RSN (a per-event
 * display name left stale by a rename would 404), refused when it's somebody else's name, with the
 * live overlay reconciled against it. Null on any miss — the sweep will try again.
 */
async function readSeat(
  name: string,
  clanMemberId: number | null,
  accountIdHint: number | null,
  owner: 'site' | 'forge',
  logCtx: Record<string, unknown>,
): Promise<SeatRead | null> {
  let fetchRsn = name;
  let liveMap: Record<string, number> = {};
  let liveKeyTimes: Record<string, string> = {};
  let lastSnapshot: string | null = null;
  let accountId = accountIdHint;
  if (clanMemberId != null) {
    // clan-scope: global -- the seat is the one this competition's own participant row points at.
    const [seat] = await db
      .select({
        rsn: clanRoster.rsn,
        accountId: clanRoster.accountId,
        liveStats: clanRoster.liveStats,
        liveStatKeyTimes: clanRoster.liveStatKeyTimes,
        statsLastSnapshot: clanRoster.statsLastSnapshot,
      })
      .from(clanRoster)
      .where(eq(clanRoster.id, clanMemberId))
      .limit(1);
    if (seat) {
      fetchRsn = seat.rsn;
      accountId = accountId ?? seat.accountId;
      liveMap = parsePluginStats(seat.liveStats);
      liveKeyTimes = parseStatKeyTimes(seat.liveStatKeyTimes);
      lastSnapshot = seat.statsLastSnapshot;
    }
  }

  const read = owner === 'forge' ? await readViaForge(fetchRsn, accountId) : await readDirect(fetchRsn);
  if (read.result.kind !== 'value') return null;
  const snapshot = read.result.snapshot;

  // Somebody else's hiscores: overall XP never goes down (lib/statsSweep applyFetch).
  if (lastSnapshot) {
    let lastXp = 0;
    try {
      lastXp = Math.max(0, (JSON.parse(lastSnapshot) as HiscoresSnapshot).skills?.overall?.xp ?? 0);
    } catch {
      lastXp = 0;
    }
    const nowXp = Math.max(0, snapshot.skills?.overall?.xp ?? 0);
    if (lastXp > 0 && nowXp > 0 && nowXp < lastXp) {
      log.warn('starting-stats.name-taken', { ...logCtx, rsn: fetchRsn, lastXp, nowXp });
      return null;
    }
  }

  // Keys hiscores caught up to, and keys not refreshed in ~6h, dropped — as the sweep does.
  const rec = reconcileLive(liveMap, snapshot);
  const overlay = pruneStaleOverlay(rec.pruned, liveKeyTimes, Date.parse(read.at), STALE_OVERLAY_MS).pruned;
  return { snapshot, at: read.at, accountId, overlay };
}

/** One event participant. True when they come out of it with a usable start line. */
async function captureOne(event: EventRow, row: ParticipantRow, owner: 'site' | 'forge'): Promise<boolean> {
  const read = await readSeat(row.name, row.clanMemberId, row.accountId, owner, { eventId: event.id, participantId: row.id });
  if (!read) return false;
  const { snapshot, at: ts, overlay } = read;
  const snapshotJson = JSON.stringify(snapshot);

  // Re-read: the sweep (or a second click) may have got there while we waited on the hiscores.
  const fresh = await db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, row.id) });
  if (!fresh || fresh.teamId == null || fresh.frozenAt) return false;
  // Only ever a read taken at or after the start — always true here, but it is THE rule, so check it.
  const startMs = parseStamp(event.startDate);
  if (startMs == null || Date.parse(ts) < startMs) return false;

  // Write only if the row still holds the start line we decided on — never clobber a newer one.
  const unchanged = fresh.snapshotAt == null
    ? and(eq(eventParticipants.id, fresh.id), isNull(eventParticipants.snapshotAt))
    : and(eq(eventParticipants.id, fresh.id), eq(eventParticipants.snapshotAt, fresh.snapshotAt));

  if (needsBaselineRecapture(fresh.statsSnapshot, fresh.snapshotAt, event.startDate)) {
    // The sweep's capture: the read with the live overlay folded in, so a session already running
    // when they were added doesn't count its earlier part.
    await db
      .update(eventParticipants)
      .set({
        statsSnapshot: baselineWithOverlay(snapshotJson, overlay),
        snapshotAt: ts,
        cachedStats: snapshotJson,
        lastStatsFetch: ts,
      })
      .where(unchanged);
    return hasStartLine(event, fresh.id);
  }

  // A partial starting-shot baseline: fill the keys it never saw from this post-start read.
  let baseline: HiscoresSnapshot | null = null;
  try {
    baseline = fresh.statsSnapshot ? (JSON.parse(fresh.statsSnapshot) as HiscoresSnapshot) : null;
  } catch {
    baseline = null;
  }
  if (baseline?.partial) {
    await db
      .update(eventParticipants)
      .set({ statsSnapshot: JSON.stringify(completePartialBaseline(baseline, snapshot)), cachedStats: snapshotJson, lastStatsFetch: ts })
      .where(unchanged);
  }
  return hasStartLine(event, fresh.id);
}

async function hasStartLine(event: EventRow, participantId: number): Promise<boolean> {
  const r = await db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, participantId) });
  return r != null && !needsStartingStats(event, r);
}

/** One weekly participant, through the sweep's weekly apply. */
async function captureWeeklyOne(comp: CompRow, row: WeeklyRow, owner: 'site' | 'forge'): Promise<boolean> {
  const read = await readSeat(row.rsn, row.clanMemberId, null, owner, { competitionId: comp.id, participantId: row.id });
  if (!read) return false;
  const type = comp.type as CompetitionType;
  const m = readMetricFromSnapshot(read.snapshot, type, comp.metric);
  if (m.kind !== 'value') return false;
  // Effective = max(hiscores, live): the first capture absorbs a session in progress.
  const value = effectiveValue(m.value, read.overlay, comp.metric);
  const fresh = await db.query.weeklyParticipants.findFirst({ where: eq(weeklyParticipants.id, row.id) });
  if (!fresh) return false;
  if (fresh.baselineValue !== null) return true; // the sweep got there first
  const outcome = await applyWeeklyValue({
    participantId: fresh.id,
    type,
    metric: comp.metric,
    value,
    baselineValue: fresh.baselineValue,
    currentValue: fresh.currentValue,
    lastUpdated: fresh.lastUpdated,
    allowFirstCapture: true,
    competitionStartIso: comp.startDate,
    now: read.at,
  });
  if (read.accountId != null) await writePlayerSnapshot(read.accountId, comp.id, read.snapshot);
  return outcome.outcome === 'first-captured' || outcome.outcome === 'updated';
}

async function readDirect(rsn: string): Promise<{ result: SnapshotFetch; at: string }> {
  const result = await fetchSnapshotWithRetry(rsn);
  return { result, at: new Date().toISOString() };
}

/**
 * Queue one read for Forge at the top lane and wait for its answer. Re-queueing a name already
 * waiting is a no-op (the pending unique index), so we only lift it into the top lane. The row is
 * read, never consumed: the next drain applies it to everything else that wanted this account.
 */
async function readViaForge(rsn: string, accountId: number | null): Promise<{ result: SnapshotFetch; at: string }> {
  const rsnKey = normalizeRsn(rsn);
  const askedAt = new Date();
  if (!rsnKey) return { result: { kind: 'transient' }, at: askedAt.toISOString() };
  await db
    .insert(hiscoresFetches)
    .values({ rsn, rsnKey, accountId, priority: QUEUE_PRIORITY, mode: 'main' })
    .onConflictDoNothing();
  await db
    .update(hiscoresFetches)
    .set({ priority: QUEUE_PRIORITY })
    .where(
      and(
        isNull(hiscoresFetches.fetchedAt),
        eq(hiscoresFetches.mode, 'main'),
        eq(hiscoresFetches.rsnKey, rsnKey),
        sql`${hiscoresFetches.priority} > ${QUEUE_PRIORITY}`,
      ),
    );

  const deadline = Date.now() + FORGE_WAIT_MS;
  while (Date.now() < deadline) {
    await delay(FORGE_POLL_MS);
    const [row] = await db
      .select({ outcome: hiscoresFetches.outcome, body: hiscoresFetches.body, fetchedAt: hiscoresFetches.fetchedAt })
      .from(hiscoresFetches)
      .where(
        and(
          eq(hiscoresFetches.rsnKey, rsnKey),
          eq(hiscoresFetches.mode, 'main'),
          gte(hiscoresFetches.fetchedAt, askedAt),
        ),
      )
      .orderBy(desc(hiscoresFetches.fetchedAt))
      .limit(1);
    if (row?.fetchedAt) {
      return { result: toFetchResult<HiscoresSnapshot>(row, parseHiscoresBody), at: new Date(row.fetchedAt).toISOString() };
    }
  }
  return { result: { kind: 'transient' }, at: new Date().toISOString() };
}
