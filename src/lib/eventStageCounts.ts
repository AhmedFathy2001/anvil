// The counts behind an event's stage: what the rail badges, the lifecycle bar and the Build
// checklist all read from.
//
// Wrapped in React's `cache` so the admin shell (which draws the rail) and the event layout (which
// draws the lifecycle bar) share ONE set of queries per request instead of each running their own.

import { cache } from 'react';
import { db } from '@/db';
import {
  events,
  eventSignups,
  payouts,
  players,
  surveyQuestions,
  surveyResponses,
  teams,
  tiles,
} from '@/db/schema';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { eventTileCount } from '@/lib/utils';
import { computeStartReadiness, startBlockerLabel } from '@/lib/eventReadiness';
import type { StageCounts } from '@/lib/eventStage';

export const getEventRow = cache(async (eventId: number) =>
  db.query.events.findFirst({ where: eq(events.id, eventId) }),
);

export const getStageCounts = cache(async (eventId: number): Promise<StageCounts> => {
  const event = await getEventRow(eventId);

  const [
    [tileRow],
    [teamRow],
    [assignedRow],
    [totalPlayerRow],
    [approvedRow],
    [pendingRow],
    [payoutRow],
    [unpaidRow],
    [questionRow],
    [responseRow],
  ] = await Promise.all([
    db.select({ n: count() }).from(tiles).where(eq(tiles.eventId, eventId)),
    db.select({ n: count() }).from(teams).where(eq(teams.eventId, eventId)),
    db
      .select({ n: count() })
      .from(players)
      .where(and(eq(players.eventId, eventId), isNotNull(players.teamId))),
    db.select({ n: count() }).from(players).where(eq(players.eventId, eventId)),
    db
      .select({ n: count() })
      .from(eventSignups)
      .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'approved'))),
    db
      .select({ n: count() })
      .from(eventSignups)
      .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'pending'))),
    db.select({ n: count() }).from(payouts).where(eq(payouts.eventId, eventId)),
    db
      .select({ n: count() })
      .from(payouts)
      .where(and(eq(payouts.eventId, eventId), eq(payouts.status, 'pending'))),
    db.select({ n: count() }).from(surveyQuestions).where(eq(surveyQuestions.eventId, eventId)),
    db.select({ n: count() }).from(surveyResponses).where(eq(surveyResponses.eventId, eventId)),
  ]);

  const readiness = computeStartReadiness({
    draftStatus: event?.draftStatus ?? 'none',
    teamCount: teamRow.n,
    assignedPlayerCount: assignedRow.n,
    totalPlayerCount: totalPlayerRow.n,
  });

  return {
    tileCount: tileRow.n,
    expectedTiles: event ? eventTileCount(event.format, event.scoringMode, event.boardSize) : 0,
    teamCount: teamRow.n,
    assignedPlayers: assignedRow.n,
    signupCount: approvedRow.n,
    pendingSignups: pendingRow.n,
    unpaidPayouts: unpaidRow.n,
    payoutCount: payoutRow.n,
    surveyResponses: responseRow.n,
    hasSurvey: questionRow.n > 0,
    blockers: readiness.blockers.map(startBlockerLabel),
  };
});
