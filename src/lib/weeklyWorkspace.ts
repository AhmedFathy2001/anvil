// Server reads behind a weekly competition's workspace.
//
// Same shape as lib/eventStageCounts does for a board: one cached set of queries per request, so
// the rail, the lifecycle strip and the page body all agree and none of them re-queries.

import { cache } from 'react';
import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { WeeklyCounts } from '@/lib/weeklyStage';

/**
 * One competition, by id, within a clan.
 *
 * The clan is not optional and not defaulted: ids are global, so without it this returns whichever
 * clan's competition happens to hold that number.
 */
export const getWeeklyRow = cache(async (clanId: number, id: number) =>
  db.query.weeklyCompetitions.findFirst({
    where: and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.id, id)),
  }),
);

export interface WeeklyStanding {
  participantId: number;
  rsn: string;
  baselineValue: number | null;
  currentValue: number | null;
  gained: number;
  flagged: boolean;
  flagReason: string | null;
  /** Enrolled but no longer in the clan. Kept in the standings only via the keepIfLeft override. */
  left: boolean;
  keepIfLeft: boolean;
  lastUpdated: string | null;
}

export const getWeeklyStandings = cache(async (competitionId: number): Promise<WeeklyStanding[]> => {
  const rows = await db
    .select({
      id: weeklyParticipants.id,
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      flagged: weeklyParticipants.flagged,
      flagReason: weeklyParticipants.flagReason,
      keepIfLeft: weeklyParticipants.keepIfLeft,
      lastUpdated: weeklyParticipants.lastUpdated,
      leftAt: clanRoster.leftAt,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(eq(weeklyParticipants.competitionId, competitionId));

  return rows
    .map((r) => ({
      participantId: r.id,
      rsn: r.rsn,
      baselineValue: r.baselineValue,
      currentValue: r.currentValue,
      // A missing baseline means "we haven't measured a starting line yet", not "gained nothing" —
      // it stays zero here and the Baselines surface is what flags it.
      gained: r.baselineValue != null && r.currentValue != null ? Math.max(0, r.currentValue - r.baselineValue) : 0,
      flagged: r.flagged === 1,
      flagReason: r.flagReason,
      left: !!r.leftAt,
      keepIfLeft: r.keepIfLeft === 1,
      lastUpdated: r.lastUpdated,
    }))
    .sort((a, b) => b.gained - a.gained || a.rsn.localeCompare(b.rsn));
});

export const getWeeklyCounts = cache(async (competitionId: number): Promise<WeeklyCounts> => {
  const standings = await getWeeklyStandings(competitionId);
  return {
    participants: standings.length,
    withBaseline: standings.filter((s) => s.baselineValue != null).length,
    moving: standings.filter((s) => s.gained > 0).length,
    flagged: standings.filter((s) => s.flagged).length,
    leavers: standings.filter((s) => s.left && !s.keepIfLeft).length,
  };
});
