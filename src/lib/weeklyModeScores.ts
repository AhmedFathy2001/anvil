import { and, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clanRoster, hiscoresFetches, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { countsWorld, firstTable, HARDCORE_TABLE, MAIN } from '@/lib/competitionGame';
import { metricKeys } from '@/lib/constants';
import { log } from '@/lib/logger';
import { modeHiscoresTable, type ModeFetchMode } from '@/lib/modeHiscores';
import { applyWeeklyValue } from '@/lib/weekly';
import { recordHuntRowStats } from '@/lib/huntRowStats';
import { competitionStat, effectiveMetricParts, effectiveMetricValue, liveMetricValue } from '@/lib/weeklyMetric';
import { weeklyStatus } from '@/lib/weeklyStage';
import { HCW_PROBE_EVERY_MS, modeReadWanted, planModeRead, type ModeRead, type WeeklyModeRow } from '@/lib/weeklyModePlan';

export type { ModeRead, WeeklyModeRow } from '@/lib/weeklyModePlan';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Competitions scored off a game mode's hiscores (weekly_competitions.counts_on, lib/competitionGame).
//
// The main game's sweep (lib/statsSweep) reads the main table and leaves these alone: a competition on
// one mode is read here for every entrant, and a "main game + Hardcore Worlds" one for each Hardcore
// Worlds character. The reads ride the same Forge queue as the boards' mode reads
// (lib/modeHiscoresQueue drainModeFetches), which hands this file its finished results and takes the
// reads it wants queued, so one read serves every board and competition that character is on.
//
// WHO IS A HARDCORE WORLDS CHARACTER. Anvil stores no such flag: a Hardcore Worlds character is its own
// account, and it isn't on the main hiscores. In a mixed competition an entrant the main read never
// found (no starting line yet) is looked for on the Hardcore Worlds table; found there, it is pinned
// to it (weekly_participants.hiscores_table) for the rest of the competition.
//
// A DEATH. A Hardcore Worlds character that dies is reset or converted to the main game, and either
// way leaves the Hardcore Worlds hiscores. Pinned there with a starting line, then not found: it keeps
// what it gained and is stopped (stopped_at). Never moved to the main table mid-race, which would
// count its whole main-game total as one week's gain.
//
// BUDGET. A pinned entrant is read at most hourly, once at the start straight away. A mixed
// competition's not-yet-found entrant is looked for on Hardcore Worlds at most every six hours.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Every entrant of a live competition that counts a mode, still in the race. */
export async function liveWeeklyModeRows(): Promise<WeeklyModeRow[]> {
  // clan-scope: global -- the sweep runs across every clan by design, like the main game's.
  const rows = await db
    .select({
      participantId: weeklyParticipants.id,
      competitionId: weeklyCompetitions.id,
      countsOn: weeklyCompetitions.countsOn,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
      hunt: weeklyCompetitions.hunt,
      startDate: weeklyCompetitions.startDate,
      rsn: weeklyParticipants.rsn,
      hiscoresTable: weeklyParticipants.hiscoresTable,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      lastUpdated: weeklyParticipants.lastUpdated,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyParticipants.competitionId))
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(
      and(
        eq(weeklyCompetitions.status, 'active'),
        ne(weeklyCompetitions.countsOn, MAIN),
        eq(weeklyParticipants.optedOut, false),
        isNull(weeklyParticipants.stoppedAt),
        or(isNull(weeklyParticipants.clanMemberId), eq(clanRoster.status, 'active'), eq(clanRoster.status, 'unranked')),
      ),
    );
  const out: WeeklyModeRow[] = [];
  for (const r of rows) {
    // What it reads off the hiscores (an item hunt only its shown stat, if it has one).
    const stat = competitionStat({ type: r.type, metric: r.metric, hunt: r.hunt });
    if (!stat) continue;
    out.push({ ...r, type: stat.type, metric: stat.metric });
  }
  return out;
}

/** Fold the finished mode-table reads into the competitions that want them. Returns how many moved. */
export async function applyWeeklyModeReads(reads: ReadonlyMap<string, ModeRead>, now: Date = new Date()): Promise<number> {
  if (reads.size === 0) return 0;
  const rows = await liveWeeklyModeRows();
  const ts = now.toISOString();
  let moved = 0;
  for (const row of rows) {
    const plan = planModeRead(row, reads, normalizeRsn(row.rsn));
    if (plan.action === 'none') continue;
    if (plan.action === 'stop') {
      await db.update(weeklyParticipants).set({ stoppedAt: ts }).where(and(eq(weeklyParticipants.id, row.participantId), isNull(weeklyParticipants.stoppedAt)));
      log.info('weekly-mode.stopped', { participantId: row.participantId, competitionId: row.competitionId });
      moved++;
      continue;
    }
    const type = row.type as Parameters<typeof effectiveMetricValue>[1];
    const m = effectiveMetricValue(plan.snapshot, type, row.metric, {});
    if (m.kind !== 'value') continue;
    if (plan.pin) {
      // Pinned only while it still has no starting line: a concurrent main read that found it wins.
      const pinned = await db
        .update(weeklyParticipants)
        .set({ hiscoresTable: plan.table })
        .where(and(eq(weeklyParticipants.id, row.participantId), isNull(weeklyParticipants.hiscoresTable), isNull(weeklyParticipants.baselineValue)))
        .returning({ id: weeklyParticipants.id });
      if (pinned.length === 0 && row.hiscoresTable == null && plan.table === HARDCORE_TABLE) continue;
    }
    const outcome = await applyWeeklyValue({
      parts: effectiveMetricParts(plan.snapshot, type, row.metric, {}),
      participantId: row.participantId,
      type,
      metric: row.metric,
      value: m.value,
      baselineValue: row.baselineValue,
      currentValue: row.currentValue,
      lastUpdated: row.lastUpdated,
      allowFirstCapture: true,
      competitionStartIso: row.startDate,
      now: ts,
    });
    if (outcome.outcome === 'updated' || outcome.outcome === 'first-captured') moved++;
    // An item hunt's per-row stats, off the same mode-table read (lib/huntRowStats).
    if (row.hunt) await recordHuntRowStats(row.participantId, { type: 'hunt', hunt: row.hunt }, plan.snapshot);
  }
  return moved;
}

/** The mode-table reads competitions want queued now, one per (name, table). */
export async function weeklyModeDue(nowMs: number): Promise<{ rsn: string; rsnKey: string; mode: ModeFetchMode; priority: number }[]> {
  const rows = await liveWeeklyModeRows();
  if (rows.length === 0) return [];
  // When each candidate's Hardcore Worlds table was last asked for (queued or read), so the probe is
  // not repeated every drain for a main-game player the main read is still getting round to.
  const keys = [...new Set(rows.filter((r) => r.hiscoresTable == null && firstTable(r.countsOn) == null).map((r) => normalizeRsn(r.rsn)).filter(Boolean))];
  const probed = new Map<string, number>();
  if (keys.length > 0) {
    const asked = await db
      .select({ rsnKey: hiscoresFetches.rsnKey, at: sql<string>`max(${hiscoresFetches.requestedAt})` })
      .from(hiscoresFetches)
      .where(and(eq(hiscoresFetches.mode, HARDCORE_TABLE), inArray(hiscoresFetches.rsnKey, keys), gt(hiscoresFetches.requestedAt, new Date(nowMs - HCW_PROBE_EVERY_MS))))
      .groupBy(hiscoresFetches.rsnKey);
    for (const a of asked) probed.set(a.rsnKey, new Date(a.at).getTime());
  }
  const due = new Map<string, { rsn: string; rsnKey: string; mode: ModeFetchMode; priority: number }>();
  for (const row of rows) {
    const rsnKey = normalizeRsn(row.rsn);
    if (!rsnKey) continue;
    const want = modeReadWanted(row, nowMs, probed.get(rsnKey) ?? null);
    if (!want) continue;
    const k = `${rsnKey}|${want.table}`;
    const prev = due.get(k);
    if (!prev || want.priority < prev.priority) due.set(k, { rsn: row.rsn, rsnKey, mode: want.table, priority: want.priority });
  }
  return [...due.values()];
}

/**
 * A plugin's live push from a mode world (lib/worldModeRequest): moves the competitions that count
 * that mode, for this character's seat when it is scored on that mode's table (pinned, or a
 * competition on that mode alone). Never a first capture: the starting line comes off the table, as
 * the main game's does. Returns how many seats moved.
 */
export async function creditWeeklyModePush(args: {
  clanId: number;
  clanMemberId: number;
  modeKey: string;
  pushed: Record<string, number>;
  nowIso: string;
}): Promise<number> {
  const table = modeHiscoresTable(args.modeKey);
  if (!table || Object.keys(args.pushed).length === 0) return 0;
  // clan-scope: this clan -- the live competitions of the clan the plugin is connected to, and only this seat in them.
  // The same bars as a main-game push (api/plugin/stats): the seat is an ACTIVE roster member (an
  // unranked or banned seat is the sweep's business), and the competition is running right now, not
  // just marked active by a cron that hasn't caught up with its end.
  const seats = await db
    .select({ p: weeklyParticipants, c: weeklyCompetitions })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyParticipants.competitionId))
    .innerJoin(clanRoster, eq(clanRoster.id, weeklyParticipants.clanMemberId))
    .where(
      and(
        eq(weeklyCompetitions.clanId, args.clanId),
        eq(weeklyCompetitions.status, 'active'),
        ne(weeklyCompetitions.countsOn, MAIN),
        eq(weeklyParticipants.clanMemberId, args.clanMemberId),
        eq(clanRoster.status, 'active'),
        eq(weeklyParticipants.optedOut, false),
        isNull(weeklyParticipants.stoppedAt),
      ),
    );
  const nowMs = Date.parse(args.nowIso);
  let moved = 0;
  for (const { p, c } of seats) {
    if (weeklyStatus(c, nowMs) !== 'active') continue;
    if (!countsWorld(c.countsOn, args.modeKey)) continue;
    if ((p.hiscoresTable ?? firstTable(c.countsOn)) !== table) continue;
    const stat = competitionStat(c);
    if (!stat) continue;
    const value = liveMetricValue(stat.type, stat.metric, args.pushed);
    if (value == null) continue;
    const keys = stat.type === 'efficiency' ? [] : metricKeys(stat.metric);
    const out = await applyWeeklyValue({
      parts: keys.length > 1 ? Object.fromEntries(keys.map((k) => [k, args.pushed[k]])) : null,
      participantId: p.id,
      type: stat.type,
      metric: stat.metric,
      value,
      baselineValue: p.baselineValue,
      currentValue: p.currentValue,
      lastUpdated: p.lastUpdated,
      allowFirstCapture: false,
      competitionStartIso: c.startDate,
      now: args.nowIso,
    });
    if (out.outcome === 'updated') moved++;
  }
  return moved;
}
