import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeLeaderboard } from '@/lib/weekly';

// GET /api/plugin/weekly-leaderboard[?id=<competitionId>]
// Returns the ranked standings for a weekly competition (the active one when no id is given),
// for the RuneLite plugin's Anvil tab. Unauthenticated — leaderboards are public. Read-only.
// Capped at the top 50 to keep the payload small; the plugin highlights the local player by RSN.
const MAX_ENTRIES = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  const comp = idParam
    ? await db.query.weeklyCompetitions.findFirst({
        where: eq(weeklyCompetitions.id, parseInt(idParam, 10)),
      })
    : await db.query.weeklyCompetitions.findFirst({
        where: eq(weeklyCompetitions.status, 'active'),
      });

  if (!comp) {
    return NextResponse.json({ competition: null, total: 0, entries: [] });
  }

  const participants = await db
    .select({
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
    })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, comp.id));

  const board = computeLeaderboard(participants);
  const entries = board.slice(0, MAX_ENTRIES).map((e, i) => ({
    rank: i + 1,
    rsn: e.rsn,
    gained: e.gained,
  }));

  return NextResponse.json({
    competition: {
      id: comp.id,
      title: comp.title,
      type: comp.type,
      metric: comp.metric,
      startDate: comp.startDate,
      endDate: comp.endDate,
    },
    total: board.length,
    entries,
  });
}
