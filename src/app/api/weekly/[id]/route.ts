import { NextResponse } from 'next/server';
import { competitionForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeLeaderboard } from '@/lib/weekly';
import { verifyUser } from '@/lib/auth';
import { competitionStandingsReadableBy } from '@/lib/competitionTeamsDb';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await competitionForRequest(_request, compId).then((c) => (c ? [c] : []));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The page's rule (app/weekly/[id]): a private clan's standings are its members', and a clan vs
  // clan board lists every racing clan's players, so it is read under every racing clan's privacy.
  // 404 either way, so the answer does not say which.
  const session = await verifyUser();
  if (!(await competitionStandingsReadableBy(comp[0], { playerId: session?.playerId ?? null, userId: session?.userId ?? null }))) {
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
