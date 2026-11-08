import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { eventDaySnapshots, weeklyCompetitions, weeklyDayRanks } from '@/db/schema';
import { log } from '@/lib/logger';
import { rankMove, teamRanksFromDay } from '@/lib/standingsWindow';

export { rankMove, teamRanksFromDay };
import { computeLeaderboard, getEffectiveParticipants } from '@/lib/weekly';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

// Rank movement since the day began ("▲3 today"): the rank now against the rank at the start of the
// day. A board's baseline is its last daily snapshot (event_day_snapshots, one per event day, written
// by the digest anyway): the teams' scores ranked again with the standings' own tie rule. A weekly's
// is weekly_day_ranks, one row per competition per UTC day, written once by the lifecycle tick.
// No baseline yet (day one, an open-ended event) means no movement, never a guess.

/** The teams' ranks as the board's current event day began; null before the first day ends. */
export async function teamBaselineRanks(eventId: number): Promise<Map<number, number> | null> {
  const [row] = await db
    .select({ data: eventDaySnapshots.data })
    .from(eventDaySnapshots)
    .where(eq(eventDaySnapshots.eventId, eventId))
    .orderBy(desc(eventDaySnapshots.dayIndex))
    .limit(1);
  if (!row) return null;
  try {
    return teamRanksFromDay(JSON.parse(row.data));
  } catch {
    return null;
  }
}

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A weekly's board ranked the way the weekly route ranks it: one row per name, gain then name. */
export async function weeklyBoard(competitionId: number) {
  const participants = await getEffectiveParticipants(competitionId);
  // A rename/re-enrol can leave two rows for one player: keep the one with the most progress.
  const byRsn = new Map<string, (typeof participants)[number]>();
  for (const p of participants) {
    const key = weeklyRsnKey(p.rsn);
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) byRsn.set(key, p);
  }
  return computeLeaderboard([...byRsn.values()]);
}

/** `{ rsnKey: rank }` of a ranked weekly board. */
export const weeklyRanks = (board: { rsn: string }[]): Record<string, number> =>
  Object.fromEntries(board.map((e, i) => [weeklyRsnKey(e.rsn), i + 1]));

/** Today's (UTC) starting ranks of a weekly, by rsn key; null until the tick has written them. */
export async function weeklyBaselineRanks(competitionId: number, nowMs = Date.now()): Promise<Map<string, number> | null> {
  const [row] = await db
    .select({ ranks: weeklyDayRanks.ranks })
    .from(weeklyDayRanks)
    .where(and(eq(weeklyDayRanks.competitionId, competitionId), eq(weeklyDayRanks.day, utcDay(nowMs))))
    .limit(1);
  if (!row) return null;
  try {
    return new Map(Object.entries(JSON.parse(row.ranks) as Record<string, number>));
  } catch {
    return null;
  }
}

/**
 * Once per UTC day per running weekly: write its ranks as they stand (the first tick after midnight).
 * One indexed read per tick for all of them, and one insert per competition per day. Never throws.
 */
export async function runWeeklyDayRanks(nowMs = Date.now()): Promise<void> {
  try {
    const day = utcDay(nowMs);
    // clan-scope: global -- the lifecycle cron walks every clan's running weeklies.
    const active = await db.select({ id: weeklyCompetitions.id }).from(weeklyCompetitions).where(eq(weeklyCompetitions.status, 'active'));
    if (!active.length) return;
    const done = await db
      .select({ id: weeklyDayRanks.competitionId })
      .from(weeklyDayRanks)
      .where(and(eq(weeklyDayRanks.day, day), inArray(weeklyDayRanks.competitionId, active.map((c) => c.id))));
    const have = new Set(done.map((d) => d.id));
    for (const c of active) {
      if (have.has(c.id)) continue;
      const ranks = weeklyRanks(await weeklyBoard(c.id));
      await db.insert(weeklyDayRanks).values({ competitionId: c.id, day, takenAt: new Date(nowMs).toISOString(), ranks: JSON.stringify(ranks) }).onConflictDoNothing();
    }
  } catch (err) {
    log.warn('rank-moves.weekly-day-failed', { err: String(err) });
  }
}
