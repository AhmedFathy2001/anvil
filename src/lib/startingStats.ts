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
// route does. Forge-owned: the read is queued in hiscores_fetches in the late-joiner lane
// (LATE_JOINER_PRIORITY, ahead of competition work, capped by Forge) and we wait for Forge to answer
// it; the row is left for the drain, which applies it as usual. Either way a miss leaves the
// participant without a start line, and the next sweep — which treats them as due — tries again.
// A failed read is persisted (a marker row in hiscores_fetches, or weekly lastUpdated) so the roster's
// "couldn't read" line survives a restart. Nothing here ever writes a start line the sweep would not have written.
//
// Weekly competitions get the same treatment (captureWeeklyStartingStatsSoon): a participant added
// mid-competition has their baselineValue taken through the sweep's own weekly apply
// (readMetricFromSnapshot → effectiveValue → applyWeeklyValue, plus the competition's player
// snapshot).

import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
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
/**
 * The late-joiner lane: ahead of competition work (0), filler (1) and probes (2). Forge takes at
 * most a fifth of each claim from it (Anvil.Forge store.JumpShare), so a burst of adds can slow the
 * competition lane but not stop it. An older Forge orders it first too, without that cap — which is
 * why the Site also keeps the lane short (LATE_LANE_MAX_PENDING).
 */
export const LATE_JOINER_PRIORITY = -1;
/** Requests already waiting in the late lane beyond which new ones go in the competition lane. */
const LATE_LANE_MAX_PENDING = 10;
/** How long to wait on Forge before leaving it to the sweep. Inside the roster's 2-minute poll. */
const FORGE_WAIT_MS = 100_000;
const FORGE_POLL_MS = 2_000;
/** A marker row recording a failed late-add read (see recordFailedRead). */
const FAILED_READ_MARK = 'starting-stats';
const FAILED_READ_KEEP_MS = 24 * 60 * 60_000;
/** How long "taken just now" is remembered for the roster's taken line. */
const JUST_CAPTURED_TTL_MS = 60 * 60_000;

// In this process's memory, and only as a fast path for the roster line — the start line, and
// whether the last read for somebody failed, are both the database's (hiscores_fetches,
// weekly_participants.last_updated), so a restart loses nothing that matters.
const inFlight = new Set<string>();
/** Captures actually running — so two triggers for one row never read twice. */
const running = new Set<string>();
const justCaptured = new Map<string, number>();
const eventKey = (id: number) => `e:${id}`;
const weeklyKey = (id: number) => `w:${id}`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rememberCaptured(key: string) {
  const now = Date.now();
  justCaptured.set(key, now);
  if (justCaptured.size > 500) {
    for (const [k, at] of justCaptured) if (now - at > JUST_CAPTURED_TTL_MS) justCaptured.delete(k);
  }
}

function capturedAt(key: string): string | null {
  const at = justCaptured.get(key);
  return at != null && Date.now() - at <= JUST_CAPTURED_TTL_MS ? new Date(at).toISOString() : null;
}

/**
 * For each name: is a read waiting in the queue, and did the latest finished read fail? Both from
 * hiscores_fetches — Forge's own outcome rows, plus the marker a late-add capture writes when its
 * read fails (recordFailedRead) — so the "couldn't read" line survives a restart.
 */
async function readSignals(rsnKeys: string[]): Promise<Map<string, { pending: boolean; failedAt: string | null }>> {
  const out = new Map<string, { pending: boolean; failedAt: string | null }>();
  const keys = [...new Set(rsnKeys.filter(Boolean))];
  if (keys.length === 0) return out;
  const rows = await db
    .select({ rsnKey: hiscoresFetches.rsnKey, outcome: hiscoresFetches.outcome, fetchedAt: hiscoresFetches.fetchedAt })
    .from(hiscoresFetches)
    .where(and(inArray(hiscoresFetches.rsnKey, keys), eq(hiscoresFetches.mode, 'main')))
    .orderBy(desc(hiscoresFetches.fetchedAt));
  for (const key of keys) out.set(key, { pending: false, failedAt: null });
  const settled = new Set<string>();
  for (const r of rows) {
    const sig = out.get(r.rsnKey)!;
    if (r.fetchedAt == null) {
      sig.pending = true;
      continue;
    }
    if (settled.has(r.rsnKey)) continue; // only the latest finished read speaks
    settled.add(r.rsnKey);
    if (r.outcome !== 'ok') sig.failedAt = new Date(r.fetchedAt).toISOString();
  }
  return out;
}

/** The roster line for each event participant, keyed by id — what pages hand their roster component. */
export async function startingStatsFor<
  P extends StartingStatsParticipant & { id: number; name: string; clanMemberId?: number | null },
>(event: StartingStatsEvent, rows: P[], nowMs: number = Date.now()): Promise<Record<number, StartingStatsStatus>> {
  const out: Record<number, StartingStatsStatus> = {};
  if (!eventIsRunning(event, nowMs)) return out;
  // Only rows still missing a start line need the queue's view; everyone else is decided by the row.
  const missing = rows.filter((r) => r.teamId != null && !r.frozenAt && needsStartingStats(event, r));
  const seatIds = [...new Set(missing.map((r) => r.clanMemberId).filter((id): id is number => id != null))];
  const seatRsn = new Map<number, string>();
  if (seatIds.length > 0) {
    // clan-scope: global -- seats this event's own participant rows point at.
    const seats = await db.select({ id: clanRoster.id, rsn: clanRoster.rsn }).from(clanRoster).where(inArray(clanRoster.id, seatIds));
    for (const s of seats) seatRsn.set(s.id, s.rsn);
  }
  const keysOf = (r: P) => {
    const seat = r.clanMemberId != null ? seatRsn.get(r.clanMemberId) : undefined;
    return [normalizeRsn(r.name), ...(seat ? [normalizeRsn(seat)] : [])];
  };
  const signals = missing.length > 0 ? await readSignals(missing.flatMap(keysOf)) : new Map();
  const missingIds = new Set(missing.map((r) => r.id));

  for (const r of rows) {
    let pending = inFlight.has(eventKey(r.id));
    let failedAt: string | null = null;
    if (missingIds.has(r.id)) {
      for (const k of keysOf(r)) {
        const sig = signals.get(k);
        if (!sig) continue;
        pending ||= sig.pending;
        if (sig.failedAt && (!failedAt || sig.failedAt > failedAt)) failedAt = sig.failedAt;
      }
    }
    const s = startingStatsStatus(event, r, nowMs, {
      inFlight: pending,
      lastFailedReadAt: failedAt,
      justCapturedAt: capturedAt(eventKey(r.id)),
    });
    if (s) out[r.id] = s;
  }
  return out;
}

/** The same for a weekly competition's participants. */
export function weeklyStartingStatsFor<P extends { id: number; baselineValue: number | null; lastUpdated: string | null }>(
  comp: StartingStatsCompetition,
  rows: P[],
  nowMs: number = Date.now(),
): Record<number, StartingStatsStatus> {
  const out: Record<number, StartingStatsStatus> = {};
  for (const r of rows) {
    const s = weeklyStartingStatsStatus(comp, r, nowMs, {
      inFlight: inFlight.has(weeklyKey(r.id)),
      justCapturedAt: capturedAt(weeklyKey(r.id)),
    });
    if (s) out[r.id] = s;
  }
  return out;
}

/** Run `fn` after the response, logging rather than throwing. The rows read as pending meanwhile. */
function soon(keys: string[], tag: string, ctx: Record<string, unknown>, fn: () => Promise<unknown>): void {
  for (const k of keys) inFlight.add(k);
  void (async () => {
    try {
      await delay(SETTLE_MS);
      await fn();
    } finally {
      for (const k of keys) inFlight.delete(k);
    }
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
  soon((participantIds ?? []).map(eventKey), 'starting-stats.failed', { eventId }, () => captureStartingStats(eventId, participantIds));
}

/** Fire-and-forget: the weekly twin — participants added to an active SOTW/BOTW. */
export function captureWeeklyStartingStatsSoon(competitionId: number, participantIds: number[]): void {
  if (participantIds.length === 0) return;
  soon(participantIds.map(weeklyKey), 'starting-stats.weekly-failed', { competitionId }, () =>
    captureWeeklyStartingStats(competitionId, participantIds),
  );
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
  const due = rows.filter((r) => !running.has(keyOf(r.id))).slice(0, MAX_PER_CALL);
  tally.skipped = rows.length - due.length;
  const one = async (row: R) => {
    const key = keyOf(row.id);
    if (running.has(key)) return;
    running.add(key);
    inFlight.add(key);
    try {
      const ok = await capture(row, owner);
      if (ok) {
        rememberCaptured(key);
        tally.captured++;
      } else tally.failed++;
    } catch (e) {
      tally.failed++;
      log.warn('starting-stats.capture-failed', { ...logCtx, rowId: row.id, error: (e as Error).message });
    } finally {
      running.delete(key);
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
  kind: 'read';
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
 * live overlay reconciled against it.
 *
 *   read    — a usable read
 *   failed  — the hiscores answered and it isn't usable (404, error, somebody else's name). Recorded
 *             in hiscores_fetches so the roster can say so after a restart; the sweep tries again.
 *   waiting — Forge hasn't answered yet; the request is still queued, so the roster stays pending.
 */
async function readSeat(
  name: string,
  clanMemberId: number | null,
  accountIdHint: number | null,
  owner: 'site' | 'forge',
  logCtx: Record<string, unknown>,
): Promise<SeatRead | { kind: 'failed' } | { kind: 'waiting' }> {
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
  if (!read.answered) return { kind: 'waiting' };
  if (read.result.kind !== 'value') {
    // Forge's own row already says how it went; a direct read leaves no trace unless we write one.
    if (owner === 'site') await recordFailedRead(fetchRsn, accountId, read.result.kind);
    return { kind: 'failed' };
  }
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
      await recordFailedRead(fetchRsn, accountId, 'transient');
      return { kind: 'failed' };
    }
  }

  // Keys hiscores caught up to, and keys not refreshed in ~6h, dropped — as the sweep does.
  const rec = reconcileLive(liveMap, snapshot);
  const overlay = pruneStaleOverlay(rec.pruned, liveKeyTimes, Date.parse(read.at), STALE_OVERLAY_MS).pruned;
  return { kind: 'read', snapshot, at: read.at, accountId, overlay };
}

/**
 * A finished, already-consumed hiscores_fetches row saying this name's read failed. It is never
 * claimed (fetched_at is set) nor drained (consumed_at is set), and the drain's 24h housekeeping
 * removes it with the rest; old marks are also cleared here, for a Site-owned box with no drain.
 */
async function recordFailedRead(rsn: string, accountId: number | null, outcome: 'unranked' | 'transient'): Promise<void> {
  const rsnKey = normalizeRsn(rsn);
  if (!rsnKey) return;
  const now = new Date();
  await db.insert(hiscoresFetches).values({
    rsn,
    rsnKey,
    accountId,
    mode: 'main',
    priority: LATE_JOINER_PRIORITY,
    requestedAt: now,
    claimedAt: now,
    fetchedAt: now,
    consumedAt: now,
    outcome,
    error: FAILED_READ_MARK,
  });
  await db
    .delete(hiscoresFetches)
    .where(
      and(
        eq(hiscoresFetches.error, FAILED_READ_MARK),
        lt(hiscoresFetches.consumedAt, new Date(now.getTime() - FAILED_READ_KEEP_MS)),
      ),
    );
}

/** One event participant. True when they come out of it with a usable start line. */
async function captureOne(event: EventRow, row: ParticipantRow, owner: 'site' | 'forge'): Promise<boolean> {
  const read = await readSeat(row.name, row.clanMemberId, row.accountId, owner, { eventId: event.id, participantId: row.id });
  if (read.kind !== 'read') return false;
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
  // A miss stamps lastUpdated, exactly as the sweep does on one — which is also what lets the roster
  // say "couldn't read" after a restart (weeklyStartingStatsStatus).
  const stampMiss = () =>
    db
      .update(weeklyParticipants)
      .set({ lastUpdated: new Date().toISOString() })
      .where(and(eq(weeklyParticipants.id, row.id), isNull(weeklyParticipants.baselineValue)));
  if (read.kind === 'waiting') return false;
  if (read.kind === 'failed') {
    await stampMiss();
    return false;
  }
  const type = comp.type as CompetitionType;
  const m = readMetricFromSnapshot(read.snapshot, type, comp.metric);
  if (m.kind !== 'value') {
    await stampMiss();
    return false;
  }
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

type Read = { result: SnapshotFetch; at: string; answered: boolean };

async function readDirect(rsn: string): Promise<Read> {
  const result = await fetchSnapshotWithRetry(rsn);
  return { result, at: new Date().toISOString(), answered: true };
}

/**
 * Queue one read for Forge in the late-joiner lane and wait for its answer. Re-queueing a name
 * already waiting is a no-op (the pending unique index), so we only lift it into the lane. The row
 * is read, never consumed: the next drain applies it to everything else that wanted this account.
 *
 * The lane is kept short here as well as in Forge: with LATE_LANE_MAX_PENDING already waiting, a new
 * request goes in the competition lane instead — so even a Forge that predates the lane's cap can't
 * be made to spend its whole budget on late adds.
 */
async function readViaForge(rsn: string, accountId: number | null): Promise<Read> {
  const rsnKey = normalizeRsn(rsn);
  const askedAt = new Date();
  if (!rsnKey) return { result: { kind: 'transient' }, at: askedAt.toISOString(), answered: true };
  const [waiting] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(hiscoresFetches)
    .where(and(isNull(hiscoresFetches.fetchedAt), lt(hiscoresFetches.priority, 0)));
  const priority = (waiting?.n ?? 0) >= LATE_LANE_MAX_PENDING ? 0 : LATE_JOINER_PRIORITY;
  await db
    .insert(hiscoresFetches)
    .values({ rsn, rsnKey, accountId, priority, mode: 'main' })
    .onConflictDoNothing();
  await db
    .update(hiscoresFetches)
    .set({ priority })
    .where(
      and(
        isNull(hiscoresFetches.fetchedAt),
        eq(hiscoresFetches.mode, 'main'),
        eq(hiscoresFetches.rsnKey, rsnKey),
        sql`${hiscoresFetches.priority} > ${priority}`,
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
      return {
        result: toFetchResult<HiscoresSnapshot>(row, parseHiscoresBody),
        at: new Date(row.fetchedAt).toISOString(),
        answered: true,
      };
    }
  }
  return { result: { kind: 'transient' }, at: new Date().toISOString(), answered: false };
}
