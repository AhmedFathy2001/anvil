// The Site half of the Forge seam — draining `forge_player_events` and scoring what it finds.
//
// Anvil.Forge (the Go data plane) fetches hiscores, writes the raw result into the `accounts` columns
// this app already reads (statsLastSnapshot, statsOverallXp, the sweep-scheduling columns), and — when
// a snapshot MOVES — appends one line to the outbox. Forge INGESTS; it never EVALUATES. This module is
// the evaluator: it reuses the exact same scoring functions the TS sweep (`/api/cron/stats`) calls, so
// a boss KC or a competition metric is scored one way whether the fetch came from the Go sweep or the
// TS one. The two paths are mutually exclusive — a feature flag runs the sweep in Go OR in TS, never
// both — so this consumer is dormant until the cutover, and cannot double-score against the TS cron.
//
// EXACTLY-ONCE is not free, so the design leans on IDEMPOTENCE instead: the scoring writes are safe to
// repeat (weekly uses a monotonic GREATEST; milestones use onConflictDoNothing; the live-overlay
// reconcile is a fixed point). Only the daily-history rollup accumulates, and it is reporting, not
// scoring. So the consumer marks each event consumed AFTER it scores — at-least-once — and a crash
// mid-batch merely re-runs the idempotent scoring on the unmarked tail. A failing event stays
// unconsumed and retries next tick without blocking the events behind it (they were already marked).
//
// Bingo stat-tile COMPLETION is batched and cross-member — a team tile sums every member's gain plus
// benched players' frozen contributions, then checks the team total — so it cannot be settled from one
// account's snapshot. Each snapshot.changed writes the account's participant snapshots (start-anchored
// baseline + current); then, once per batch, lib/bingoEval#evaluateBingoEvent replays the completion
// over the stored snapshots per touched EVENT. Same rules as the sweep's Phase 3, one shared engine.

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanAuditLog,
  clanMemberships,
  clanRoster,
  events,
  eventParticipants,
  forgePlayerEvents,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { reconcileLive, pruneStaleOverlay, effectiveValue, needsBaselineRecapture, baselineWithOverlay } from '@/lib/statTracking';
import { evaluateBingoEvent } from '@/lib/bingoEval';
import { parsePluginStats } from '@/lib/pluginStats';
import { parseStatKeyTimes } from '@/lib/liveStats';
import { computeDeltas, detectMilestones, recordDailyStats, recordMilestones, type StatDeltas } from '@/lib/statHistory';
import { applyWeeklyValue, readMetricFromSnapshot, writePlayerSnapshot, applyRenameToActiveWeeklyParticipants, type CompetitionType } from '@/lib/weekly';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { levelFromXp } from '@/lib/xp';
import { log } from '@/lib/logger';

// Same window the TS sweep uses: a live-overlay key not refreshed within ~6.5h is a bogus/doubled
// push stuck above hiscores (OSRS force-logs-out by 6h), so drop it and trust hiscores.
const STALE_OVERLAY_MS = 6.5 * 60 * 60 * 1000;

// ── Payload shapes (see Anvil.Forge/docs/BOUNDARY.md) ──────────────────────────────────────────────
interface SnapshotChangedPayload {
  capturedAt?: string;
  overallXp?: number;
  deltas?: StatDeltas;
  snapshot: HiscoresSnapshot;
  // Forge documents {capturedAt, overallXp, deltas, snapshot}. `previous` is honoured if a future
  // Forge includes it; absent, it is reconstructed exactly from snapshot − deltas below.
  previous?: HiscoresSnapshot | null;
}
interface RsnChangedPayload {
  from?: string;
  to?: string;
}

export interface ConsumeResult {
  consumed: number;
  snapshots: number;
  renames: number;
  unranked: number;
  weeklyUpdated: number;
  milestones: number;
  /** Stat tiles newly completed by the per-event bingo pass. */
  tilesCompleted: number;
  errors: number;
  /** Active events an account in this batch has a seat in — evaluated for completions after the batch. */
  touchedEvents: number[];
}

/**
 * Rebuild the previous snapshot from the current one and the per-metric deltas.
 *
 * `recordDailyStats` and `detectMilestones` both need the full BEFORE snapshot — they recompute
 * EHP/EHB and threshold crossings off it, not just the deltas. Forge overwrote `statsLastSnapshot`
 * with the new snapshot before emitting, so the account row no longer holds the before. But deltas is
 * `computeDeltas(before, after)` — the exact per-skill xp and per-boss score gains — so subtracting it
 * from the after reproduces the before for every field these functions read. Metrics not in deltas did
 * not move, so before == after for them. Empty deltas → before == after → zero gains, which is the
 * correct first-sighting behaviour (nothing to credit, no threshold crossed).
 */
function reconstructPrevious(snapshot: HiscoresSnapshot, deltas: StatDeltas | undefined): HiscoresSnapshot {
  if (!deltas || (!deltas.skills && !deltas.bosses)) return snapshot;
  const prev: HiscoresSnapshot = structuredClone(snapshot);
  let overallDrop = 0;
  for (const [key, gain] of Object.entries(deltas.skills ?? {})) {
    const s = prev.skills?.[key];
    if (s) {
      s.xp = Math.max(0, (s.xp ?? 0) - gain);
      // Recompute the level from the rolled-back xp — otherwise it stays at the snapshot's level and
      // detectMilestones misses a 99 crossed this tick (it reads level, not xp, for that milestone).
      s.level = levelFromXp(s.xp);
      overallDrop += gain;
    }
  }
  // computeDeltas never emits 'overall' (it is a column, not a delta), so back it out by the summed
  // skill gains — total xp gain is exactly the sum of per-skill xp gains.
  if (prev.skills?.overall) prev.skills.overall.xp = Math.max(0, (prev.skills.overall.xp ?? 0) - overallDrop);
  for (const [key, gain] of Object.entries(deltas.bosses ?? {})) {
    const b = prev.bosses?.[key];
    if (b) b.score = Math.max(0, (b.score ?? 0) - gain);
  }
  return prev;
}

function previousFor(payload: SnapshotChangedPayload): HiscoresSnapshot {
  return payload.previous ?? reconstructPrevious(payload.snapshot, payload.deltas);
}

/** The active roster seats an account holds right now — the join key for its weekly + bingo rows. */
async function activeSeatIds(accountId: number): Promise<number[]> {
  const seats = await db
    .select({ id: clanMemberships.id })
    // clan-scope: global -- one account's seats span clans by design; this is a person-scoped read of
    // a single account's own memberships, the join key for its weekly + bingo rows in every clan.
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), isNull(clanMemberships.leftAt)));
  return seats.map((s) => s.id);
}

/**
 * `snapshot.changed` — the account gained something. Reconcile its live overlay, roll up the day's
 * history, record any milestones, and move every weekly value it feeds. Returns the active events it
 * participates in (for the deferred bingo completion pass) and the per-run counters.
 */
async function applySnapshotChanged(
  accountId: number,
  payload: SnapshotChangedPayload,
  nowIso: string,
): Promise<{ weeklyUpdated: number; milestones: number; touchedEvents: number[] }> {
  const snapshot = payload.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    log.warn('forge-consume.snapshot-missing', { accountId });
    return { weeklyUpdated: 0, milestones: 0, touchedEvents: [] };
  }
  const previous = previousFor(payload);

  // ── Live overlay: drop keys hiscores has caught up to, and any stale bogus-push residue. ─────────
  const acc = await db
    .select({ liveStats: accounts.liveStats, liveStatKeyTimes: accounts.liveStatKeyTimes })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .then((r) => r[0]);
  let liveMap: Record<string, number> = parsePluginStats(acc?.liveStats);
  if (acc) {
    const rec = reconcileLive(liveMap, snapshot);
    const stale = pruneStaleOverlay(rec.pruned, parseStatKeyTimes(acc.liveStatKeyTimes), Date.parse(nowIso), STALE_OVERLAY_MS);
    liveMap = stale.pruned;
    if (rec.changed || stale.changed) {
      await db
        .update(accounts)
        .set({ liveStats: Object.keys(liveMap).length ? JSON.stringify(liveMap) : null })
        .where(eq(accounts.id, accountId));
    }
  }

  // ── Daily history + milestones (reporting; a failure here must not cost the scoring below). ──────
  try {
    await recordDailyStats({ accountId, snapshot, previous, now: new Date(nowIso) });
  } catch (e) {
    log.warn('forge-consume.history-failed', { accountId, error: (e as Error).message });
  }
  let milestones = 0;
  try {
    const found = detectMilestones(previous, snapshot, computeDeltas(previous, snapshot));
    if (found.length > 0) milestones = await recordMilestones(accountId, found);
  } catch (e) {
    log.warn('forge-consume.milestones-failed', { accountId, error: (e as Error).message });
  }

  const seatIds = await activeSeatIds(accountId);
  if (seatIds.length === 0) return { weeklyUpdated: 0, milestones, touchedEvents: [] };

  // ── Weekly: fold the one snapshot into every active competition this account's seats are in. ─────
  let weeklyUpdated = 0;
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const weekly = await db
    .select({
      id: weeklyParticipants.id,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      lastUpdated: weeklyParticipants.lastUpdated,
      compId: weeklyCompetitions.id,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
      startDate: weeklyCompetitions.startDate,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
    // Mirror the TS sweep's participant filter: skip seats the roster no longer counts as active
    // (renamed / banned). clanMemberId is non-null here, so the null branch never applies.
    .innerJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(
      and(
        inArray(weeklyParticipants.clanMemberId, seatIds),
        eq(weeklyCompetitions.status, 'active'),
        eq(clanRoster.status, 'active'),
      ),
    );
  for (const w of weekly) {
    const m = readMetricFromSnapshot(snapshot, w.type as CompetitionType, w.metric);
    if (m.kind !== 'value') continue;
    // Effective = max(hiscores, live). On first capture this becomes the baseline, absorbing a
    // mid-session logout flush so the gain starts at 0.
    const value = effectiveValue(m.value, liveMap, w.metric);
    const outcome = await applyWeeklyValue({
      participantId: w.id,
      type: w.type as CompetitionType,
      metric: w.metric,
      value,
      baselineValue: w.baselineValue,
      currentValue: w.currentValue,
      lastUpdated: w.lastUpdated,
      allowFirstCapture: true,
      competitionStartIso: w.startDate,
      now: nowIso,
    });
    if (outcome.outcome === 'updated' || outcome.outcome === 'first-captured') weeklyUpdated++;
    // Competition-scoped snapshot (frozen baseline + per-tick current), bounded at 2 rows/account/comp.
    await writePlayerSnapshot(accountId, w.compId, snapshot);
  }

  // ── Bingo: refresh this account's participant snapshots and report the events touched. Mirrors the
  // sweep's Phase 2 bookkeeping — write the current snapshot, and (first sighting or a baseline taken
  // before the start) the START-ANCHORED, overlay-absorbed baseline that keeps pre-event gains out
  // (lib/statTracking). Benched players are pinned; leave them. The per-event completion pass runs
  // after the whole batch, in consumeForgeEvents.
  const snapshotJson = JSON.stringify(snapshot);
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const parts = await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      teamId: eventParticipants.teamId,
      statsSnapshot: eventParticipants.statsSnapshot,
      snapshotAt: eventParticipants.snapshotAt,
      frozenAt: eventParticipants.frozenAt,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(inArray(eventParticipants.clanMemberId, seatIds));
  const touched = new Set<number>();
  for (const p of parts) {
    if (p.forceEndedAt) continue;
    if (p.startDate && p.startDate > nowIso) continue; // not started (the gate is the hard backstop)
    if (p.endDate && p.endDate < nowIso) continue; // ended
    if (!p.teamId || p.frozenAt) continue; // no team, or benched (gain pinned to frozenStats)
    if (needsBaselineRecapture(p.statsSnapshot, p.snapshotAt, p.startDate)) {
      await db
        .update(eventParticipants)
        .set({ statsSnapshot: baselineWithOverlay(snapshotJson, liveMap), snapshotAt: nowIso, cachedStats: snapshotJson, lastStatsFetch: nowIso })
        .where(eq(eventParticipants.id, p.id));
    } else {
      await db
        .update(eventParticipants)
        .set({ cachedStats: snapshotJson, lastStatsFetch: nowIso })
        .where(eq(eventParticipants.id, p.id));
    }
    touched.add(p.eventId);
  }

  return { weeklyUpdated, milestones, touchedEvents: [...touched] };
}

/**
 * `rsn.changed` — apply an in-game rename at the ACCOUNT level. The outbox event is keyed by account
 * (the global OSRS identity), so this updates the account's display RSN + alias history once and then
 * propagates the clan-side bookkeeping (audit row, weekly participant rename) across every seat the
 * account holds. Mirrors auth.ts's per-seat applyRenameOnPlay, lifted to the account. Best-effort.
 */
async function applyRsnChanged(accountId: number, payload: RsnChangedPayload): Promise<void> {
  const newRsn = sanitizeRsn(payload.to ?? '');
  if (!newRsn) return;
  const newNorm = normalizeRsn(newRsn);

  const acc = await db
    .select({ rsn: accounts.rsn, rsnNormalized: accounts.rsnNormalized, previousRsns: accounts.previousRsns, status: accounts.status })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .then((r) => r[0]);
  if (!acc || acc.rsnNormalized === newNorm) return; // gone, or already applied

  // Uniqueness guard: if another account already holds the new name, defer to the mod-gated
  // suspected-renames → merge flow rather than collide two identities.
  const clash = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.rsnNormalized, newNorm))
    .then((r) => r[0]);
  if (clash && clash.id !== accountId) return;

  const oldRsn = payload.from && sanitizeRsn(payload.from) ? sanitizeRsn(payload.from) : acc.rsn;

  let previous: string[] = [];
  if (acc.previousRsns) {
    try {
      const parsed = JSON.parse(acc.previousRsns);
      if (Array.isArray(parsed)) previous = parsed.filter((p): p is string => typeof p === 'string');
    } catch {
      /* malformed alias history — start fresh rather than fail the rename */
    }
  }
  if (acc.rsn && !previous.some((p) => normalizeRsn(p) === normalizeRsn(acc.rsn))) previous.push(acc.rsn);

  await db
    .update(accounts)
    .set({
      rsn: newRsn,
      rsnNormalized: newNorm,
      previousRsns: JSON.stringify(previous),
      // A detected rename proves the old-name 404 was a rename, not a ban — re-activate the account.
      status: acc.status === 'unranked' ? 'active' : acc.status,
    })
    .where(eq(accounts.id, accountId));

  const seatIds = await activeSeatIds(accountId);
  for (const seatId of seatIds) {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: seatId,
        eventType: 'renamed',
        oldValue: JSON.stringify({ rsn: oldRsn }),
        newValue: JSON.stringify({ rsn: newRsn }),
        notes: 'Detected by the Forge hiscores sweep',
        actorUserId: null,
      })
      .catch(() => {});
    await applyRenameToActiveWeeklyParticipants(seatId, oldRsn, newRsn).catch(() => {});
  }
}

/**
 * `account.unranked` — hiscores 404'd the RSN. Park the account so the rename-review / re-probe
 * surface picks it up; never clobber a Jagex ban or an archive. Forge owns the polling schedule now,
 * so this is only the status flag the Site's own surfaces read, not a re-queue.
 */
async function applyUnranked(accountId: number): Promise<void> {
  await db
    .update(accounts)
    .set({ status: 'unranked' })
    .where(and(eq(accounts.id, accountId), eq(accounts.status, 'active')));
}

/**
 * Drain the unconsumed tail of the outbox and score it. Single-consumer by deployment (the control
 * plane's cron dispatcher does not fire a job concurrently), so no row-level claim is needed; the
 * at-least-once + idempotent-scoring design (see the file header) covers a crash mid-batch.
 */
export async function consumeForgeEvents({ limit = 500 }: { limit?: number } = {}): Promise<ConsumeResult> {
  const batch = await db
    .select()
    .from(forgePlayerEvents)
    .where(isNull(forgePlayerEvents.consumedAt))
    .orderBy(asc(forgePlayerEvents.id))
    .limit(limit);

  const result: ConsumeResult = { consumed: 0, snapshots: 0, renames: 0, unranked: 0, weeklyUpdated: 0, milestones: 0, tilesCompleted: 0, errors: 0, touchedEvents: [] };
  const touched = new Set<number>();

  for (const ev of batch) {
    const nowIso = new Date().toISOString();
    try {
      if (ev.kind === 'snapshot.changed') {
        const r = await applySnapshotChanged(ev.accountId, ev.payload as SnapshotChangedPayload, nowIso);
        result.snapshots++;
        result.weeklyUpdated += r.weeklyUpdated;
        result.milestones += r.milestones;
        for (const id of r.touchedEvents) touched.add(id);
      } else if (ev.kind === 'rsn.changed') {
        await applyRsnChanged(ev.accountId, ev.payload as RsnChangedPayload);
        result.renames++;
      } else if (ev.kind === 'account.unranked') {
        await applyUnranked(ev.accountId);
        result.unranked++;
      } else {
        log.warn('forge-consume.unknown-kind', { id: ev.id, kind: ev.kind });
      }
      // Mark consumed only AFTER scoring succeeds — at-least-once. Per-event so partial progress
      // survives a crash and a poison event retries without blocking the ones behind it.
      await db.update(forgePlayerEvents).set({ consumedAt: sql`now()` }).where(eq(forgePlayerEvents.id, ev.id));
      result.consumed++;
    } catch (e) {
      result.errors++;
      log.warn('forge-consume.event-failed', { id: ev.id, kind: ev.kind, error: (e as Error).message });
      // Leave consumed_at NULL → retried next tick. Idempotent scoring makes the retry safe.
    }
  }

  result.touchedEvents = [...touched];

  // ── Bingo stat-tile completion — one pass per touched event, over the snapshots just written above.
  // Runs once per event (not per account) so a team total is evaluated whole. Best-effort per event: a
  // failure here has already been scored into weekly/history above and the completion re-evaluates next
  // tick from the same stored snapshots (idempotent — the completions unique index dedups).
  for (const eventId of result.touchedEvents) {
    try {
      const r = await evaluateBingoEvent(eventId);
      result.tilesCompleted += r.tilesCompleted.length;
    } catch (e) {
      log.warn('forge-consume.bingo-failed', { eventId, error: (e as Error).message });
    }
  }

  return result;
}
