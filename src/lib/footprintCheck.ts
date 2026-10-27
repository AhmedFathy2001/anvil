// Runs the hiscores footprint checks (lib/footprint) over running boards and ones that just ended.
//
// Costs no hiscores budget: it reads what the sweep already fetched — each account's last poll
// (account_stat_snapshots) against the event baseline — and only trusts a poll taken after the
// plugin went quiet, which the sweep makes once a session ends (lib/pollLadder). Flags, never blocks.

import { and, eq, gt, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  accounts, accountStatSnapshots, eventDaySnapshots, eventParticipants, events, integritySignals, submissions, tiles,
} from '@/db/schema';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { parseStamp } from '@/lib/dbTime';
import { hiscoresKeyForMonster } from '@/lib/killSource';
import { log } from '@/lib/logger';
import { parseJsonArray } from '@/lib/tileKinds';
import {
  FOOTPRINT_SHORT_FLAG, SETTLE_MS, checkKcLine, checkLaps, firstServiceKills, kcLineClaims, kcOf, lapXpFloor,
  longHours, maxGain, type Verdict,
} from '@/lib/footprint';

const CHECK_EVERY_MS = 30 * 60_000;
/** Final logouts land on the hiscores after the end; keep checking for a while. */
const AFTER_END_MS = 3 * 86_400_000;
const lastRun = new Map<number, number>();

/** Check every board that is due. Never throws. */
export async function runFootprintChecks(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each check stays inside its event.
  const live = await db
    .select({ id: events.id, startDate: events.startDate, endDate: events.endDate })
    .from(events)
    .where(and(
      eq(events.startNotified, 1),
      or(isNull(events.endDate), gt(events.endDate, new Date(nowMs - AFTER_END_MS).toISOString())),
    ));
  for (const ev of live) {
    if (nowMs - (lastRun.get(ev.id) ?? 0) < CHECK_EVERY_MS) continue;
    lastRun.set(ev.id, nowMs);
    try {
      await checkEvent(ev.id, parseStamp(ev.startDate));
    } catch (err) {
      log.warn('footprint.failed', { eventId: ev.id, err: String(err) });
    }
  }
}

function snap(json: string | null | undefined): HiscoresSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as HiscoresSnapshot;
  } catch {
    return null;
  }
}

const RANK: Record<Verdict, number> = { unchecked: 0, ok: 1, short: 2 };
const worse = (a: Verdict, b: Verdict): Verdict => (RANK[b] > RANK[a] ? b : a);

async function checkEvent(eventId: number, startMs: number | null): Promise<void> {
  const players = await db
    .select({
      id: eventParticipants.id,
      baseline: eventParticipants.statsSnapshot,
      baselineAt: eventParticipants.snapshotAt,
      current: accountStatSnapshots.snapshot,
      polledAt: accounts.statsPolledAt,
      pushedAt: accounts.liveStatsAt,
    })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.statsSnapshot)));
  if (players.length === 0) return;

  const boardTiles = await db
    .select({ id: tiles.id, tileType: tiles.tileType, targetNpcs: tiles.targetNpcs, timedActivity: tiles.timedActivity })
    .from(tiles)
    .where(eq(tiles.eventId, eventId));
  const tileById = new Map(boardTiles.map((t) => [t.id, t]));

  // Plugin-sent credits only: a staff/manual credit is a person's decision, not a claim to audit.
  const subs = boardTiles.length === 0 ? [] : await db
    .select({
      id: submissions.id, tileId: submissions.tileId, playerId: submissions.playerId,
      amount: submissions.amount, createdAt: submissions.createdAt,
      proofFacts: submissions.proofFacts, flaggedReason: submissions.flaggedReason, footprint: submissions.footprint,
    })
    .from(submissions)
    .where(and(inArray(submissions.tileId, boardTiles.map((t) => t.id)), eq(submissions.source, 'plugin')));

  const days = await db
    .select({ dayIndex: eventDaySnapshots.dayIndex, takenAt: eventDaySnapshots.takenAt, data: eventDaySnapshots.data })
    .from(eventDaySnapshots)
    .where(eq(eventDaySnapshots.eventId, eventId))
    .orderBy(eventDaySnapshots.dayIndex);

  for (const p of players) {
    const baseline = snap(p.baseline);
    const current = snap(p.current);
    if (!baseline) continue;
    await raiseSignals(eventId, p.id, baseline, current, startMs, days);

    const polledMs = parseStamp(p.polledAt);
    const baselineMs = parseStamp(p.baselineAt);
    const pushedMs = parseStamp(p.pushedAt);
    if (!current || polledMs == null || (pushedMs != null && polledMs < pushedMs + SETTLE_MS)) continue;

    const mine = subs
      // The client that CLAIMED it (playerId): the KC lives on that account even when the credit was
      // handed to a teammate (lib/creditIntegrity reads it the same way).
      .filter((s) => s.playerId === p.id && s.footprint !== 'dismissed')
      .filter((s) => (parseStamp(s.createdAt) ?? Infinity) <= polledMs - 60_000)
      .sort((a, b) => (parseStamp(a.createdAt) ?? 0) - (parseStamp(b.createdAt) ?? 0));
    const verdict = new Map<number, Verdict>(mine.map((s) => [s.id, 'unchecked']));
    const mark = (id: number, v: Verdict) => verdict.set(id, worse(verdict.get(id) ?? 'unchecked', v));

    // A KC the proof printed must be one the hiscores reached, after the start.
    for (const s of mine) {
      const lines = (snap(s.proofFacts) as { lines?: { text: string }[] } | null)?.lines;
      if (!Array.isArray(lines)) continue;
      // The "not before the start" half holds only for a kill after the baseline was read — a late
      // joiner's baseline postdates their first event kills.
      const capturedAt = (snap(s.proofFacts) as { capturedAt?: number } | null)?.capturedAt;
      const floor = baselineMs != null && typeof capturedAt === 'number' && capturedAt > baselineMs ? baseline : null;
      for (const c of kcLineClaims(lines)) mark(s.id, checkKcLine(c, floor, current));
    }

    // Counted tiles: credits in order; the ones inside the hiscores gain are confirmed. A shortfall on
    // these is lib/creditIntegrity's to raise (with its noise margin, on the event Overview), not ours.
    for (const [tileId, rows] of groupBy(mine, (s) => s.tileId)) {
      const tile = tileById.get(tileId);
      if (!tile) continue;
      const targets = parseJsonArray<string>(tile.targetNpcs);
      if (tile.tileType === 'lap') {
        const total = rows.reduce((n, s) => n + s.amount, 0);
        const v = checkLaps(total, lapXpFloor(targets), baseline, current);
        // Plausibility is about the total, so one flag on the newest credit is the look it needs.
        if (v === 'short') mark(rows[rows.length - 1].id, 'short');
        else if (v === 'ok') rows.forEach((s) => mark(s.id, 'ok'));
        continue;
      }
      const counted = tile.tileType === 'kill' ? targets
        : tile.tileType === 'timed' || tile.tileType === 'deathless' ? [tile.timedActivity ?? targets[0] ?? '']
        : null;
      if (!counted || counted.length === 0) continue;
      const keys = counted.map((n) => hiscoresKeyForMonster(n));
      if (keys.some((k) => !k)) continue; // a mob off the hiscores — nothing to compare against
      // Two names for one tracked count must not count its gain twice.
      const gains = [...new Set(keys as string[])].map((k) => maxGain(baseline, current, k));
      if (gains.some((g) => g == null)) continue;
      const gain = (gains as number[]).reduce((a, b) => a + b, 0);
      let used = 0;
      for (const s of rows) {
        used += tile.tileType === 'kill' ? s.amount : 1;
        if (used <= gain) mark(s.id, 'ok');
      }
    }

    for (const s of mine) {
      const v = verdict.get(s.id)!;
      if (v === 'unchecked' || v === s.footprint) continue;
      const flaggedReason = v === 'short'
        ? s.flaggedReason ?? FOOTPRINT_SHORT_FLAG
        : s.flaggedReason === FOOTPRINT_SHORT_FLAG ? null : s.flaggedReason; // a later read caught up
      await db.update(submissions).set({ footprint: v, flaggedReason }).where(eq(submissions.id, s.id));
    }
  }
}

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

async function raiseSignals(
  eventId: number,
  participantId: number,
  baseline: HiscoresSnapshot,
  current: HiscoresSnapshot | null,
  startMs: number | null,
  days: { dayIndex: number; takenAt: string; data: string }[],
): Promise<void> {
  const found: { kind: string; detail: object }[] = [];
  for (const key of firstServiceKills(baseline, current)) {
    found.push({ kind: `first_service_kill:${key}`, detail: { key, kc: kcOf(current, key) } });
  }
  // Day by day off the digest's rows, starting from the baseline at the start.
  let prev: HiscoresSnapshot | null = baseline.partial ? null : baseline;
  let prevMs = startMs;
  for (const d of days) {
    const stats = snap((snap(d.data) as { players?: Record<string, { stats?: string | null }> } | null)?.players?.[participantId]?.stats);
    const atMs = parseStamp(d.takenAt);
    if (stats && prev && prevMs != null && atMs != null) {
      const hours = longHours(prev, stats, (atMs - prevMs) / 3_600_000);
      if (hours != null) {
        found.push({ kind: `long_hours:day${d.dayIndex}`, detail: { hours: Math.round(hours * 10) / 10, windowHours: Math.round((atMs - prevMs) / 360_000) / 10 } });
      }
    }
    if (stats) {
      prev = stats;
      prevMs = atMs;
    }
  }
  if (found.length === 0) return;
  await db
    .insert(integritySignals)
    .values(found.map((f) => ({ eventId, participantId, kind: f.kind, detail: JSON.stringify(f.detail) })))
    .onConflictDoNothing();
}
