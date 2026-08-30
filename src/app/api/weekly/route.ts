import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { countsTowardLeaderboard } from '@/lib/weekly';
import { requireClan } from '@/lib/clanContext';

export async function GET() {
  // This clan's weeks. The public list was unscoped, so every clan's competitions were served from
  // every clan's address — the same bug as the admin list, on the side anyone can read.
  const clan = await requireClan();
  const comps = await db
    .select()
    .from(weeklyCompetitions)
    .where(eq(weeklyCompetitions.clanId, clan.id))
    .orderBy(desc(weeklyCompetitions.createdAt));

  // Count only participants still in the CC (or kept by an admin), matching the leaderboard headcount.
  // clan-scope: global -- joined onto a driving query that is already scoped; this clause adds columns, not rows.
  const participantCounts = await db
    .select({ competitionId: weeklyParticipants.competitionId, count: count() })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(countsTowardLeaderboard())
    .groupBy(weeklyParticipants.competitionId);

  const countMap = new Map(participantCounts.map((p) => [p.competitionId, p.count]));

  const result = comps.map((c) => ({
    id: c.id,
    type: c.type,
    metric: c.metric,
    title: c.title,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    participantCount: countMap.get(c.id) || 0,
  }));

  return NextResponse.json(result);
}
