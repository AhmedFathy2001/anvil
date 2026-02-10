import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { count, desc } from 'drizzle-orm';

export async function GET() {
  const comps = await db.select().from(weeklyCompetitions).orderBy(desc(weeklyCompetitions.createdAt));

  const participantCounts = await db
    .select({ competitionId: weeklyParticipants.competitionId, count: count() })
    .from(weeklyParticipants)
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
