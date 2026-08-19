import { NextResponse } from 'next/server';
import { competitionForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeLeaderboard } from '@/lib/weekly';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await competitionForRequest(request, compId).then((c) => (c ? [c] : []));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  const leaderboard = computeLeaderboard(participants);

  return NextResponse.json({
    competition: {
      id: comp[0].id,
      type: comp[0].type,
      metric: comp[0].metric,
      title: comp[0].title,
      startDate: comp[0].startDate,
      endDate: comp[0].endDate,
      status: comp[0].status,
    },
    leaderboard,
  });
}
