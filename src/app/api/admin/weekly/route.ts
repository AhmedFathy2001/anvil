import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { enrollAllPlayers } from '@/lib/weekly';
import { notifyWeeklyStart } from '@/lib/discord';
import { EFFICIENCY_METRICS } from '@/lib/constants';

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

  const { type, metric, title, startDate, endDate, includeGuests } = await request.json();

  if (!type || !metric || !title || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (type !== 'skill' && type !== 'boss' && type !== 'efficiency') {
    return NextResponse.json({ error: 'Type must be skill, boss or efficiency' }, { status: 400 });
  }
  // Efficiency comps rank by a derived number, so the metric isn't a free-form hiscores key — only
  // the two our engine computes. A typo here would otherwise create a comp that never scores.
  if (type === 'efficiency' && !EFFICIENCY_METRICS.some((m) => m.key === metric)) {
    return NextResponse.json({ error: 'Efficiency metric must be ehp or ehb' }, { status: 400 });
  }

  // Determine initial status based on dates
  const now = new Date().toISOString();
  let status = 'upcoming';
  if (startDate <= now && endDate > now) status = 'active';
  else if (endDate <= now) status = 'completed';

  const clan = await requireClan();
  const result = await db.insert(weeklyCompetitions).values({
    clanId: clan.id,
    type,
    metric,
    title,
    startDate,
    endDate,
    createdById: user.userId > 0 ? user.userId : null,
    status,
    // Guests race alongside members unless the admin unticked the box. Absent (an older client)
    // means include — the clan roster is the entry list, and a weekly is a clan-wide activity.
    includeGuests: includeGuests === false ? 0 : 1,
  }).returning();

  const comp = result[0];

  // Auto-enroll all registered players
  const enrolled = await enrollAllPlayers(comp.id);

  // A comp created to start immediately is born 'active', so the weekly cron's upcoming→active
  // transition never fires for it — announce the start here instead. Future-dated ('upcoming')
  // comps are announced by the cron when it flips them. Fire-and-forget so a webhook hiccup
  // never fails creation.
  if (status === 'active') {
    notifyWeeklyStart({ type: comp.type, title: comp.title, metric: comp.metric, endDate: comp.endDate }).catch(() => {});
  }

  return NextResponse.json({ ...comp, enrolled });
}
