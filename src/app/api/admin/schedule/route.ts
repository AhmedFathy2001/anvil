import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { events, weeklyCompetitions } from '@/db/schema';

// GET — unified list of scheduled items (bingo events + weekly competitions)
// for the admin schedule calendar. Any admin/moderator can view.
export async function GET() {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [allEvents, allWeeklies] = await Promise.all([
    db.select().from(events),
    db.select().from(weeklyCompetitions),
  ]);

  const bingos = allEvents
    .filter((e) => e.startDate && e.endDate)
    .map((e) => ({
      kind: 'bingo' as const,
      id: e.id,
      title: e.name,
      startDate: e.startDate!,
      endDate: e.endDate!,
      forceEndedAt: e.forceEndedAt,
      href: `/admin/events/${e.id}`,
    }));

  const weeklies = allWeeklies.map((w) => ({
    kind: 'weekly' as const,
    id: w.id,
    title: w.title,
    type: w.type,
    metric: w.metric,
    status: w.status,
    startDate: w.startDate,
    endDate: w.endDate,
    href: `/weekly/${w.id}`,
  }));

  return NextResponse.json({ bingos, weeklies });
}
