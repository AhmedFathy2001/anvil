import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { enrollAllPlayers } from '@/lib/weekly';

export async function GET() {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const comps = await db.select().from(weeklyCompetitions).orderBy(weeklyCompetitions.createdAt);

  // Get participant counts
  const participantCounts = await db
    .select({ competitionId: weeklyParticipants.competitionId, count: count() })
    .from(weeklyParticipants)
    .groupBy(weeklyParticipants.competitionId);

  const countMap = new Map(participantCounts.map((p) => [p.competitionId, p.count]));

  const result = comps.map((c) => ({
    ...c,
    participantCount: countMap.get(c.id) || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, metric, title, startDate, endDate, womCompetitionId } = await request.json();

  if (!type || !metric || !title || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (type !== 'skill' && type !== 'boss') {
    return NextResponse.json({ error: 'Type must be skill or boss' }, { status: 400 });
  }

  // Determine initial status based on dates
  const now = new Date().toISOString();
  let status = 'upcoming';
  if (startDate <= now && endDate > now) status = 'active';
  else if (endDate <= now) status = 'completed';

  const result = await db.insert(weeklyCompetitions).values({
    type,
    metric,
    title,
    startDate,
    endDate,
    createdById: user.userId > 0 ? user.userId : null,
    womCompetitionId: womCompetitionId || null,
    status,
  }).returning();

  const comp = result[0];

  // Auto-enroll all registered players
  const enrolled = await enrollAllPlayers(comp.id);

  return NextResponse.json({ ...comp, enrolled });
}
