import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { count, desc } from 'drizzle-orm';
import EventsClient, { type EventRow } from './EventsClient';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));
  const teamCounts: Record<number, number> = {};
  if (allEvents.length > 0) {
    const counts = await db
      .select({ eventId: teams.eventId, count: count() })
      .from(teams)
      .groupBy(teams.eventId);
    for (const row of counts) teamCounts[row.eventId] = row.count;
  }

  const now = new Date().toISOString();
  const project = (e: typeof allEvents[number]): EventRow => ({
    id: e.id,
    name: e.name,
    boardSize: e.boardSize,
    startDate: e.startDate,
    endDate: e.endDate,
    forceEndedAt: e.forceEndedAt,
    createdAt: e.createdAt,
  });

  const active = allEvents
    .filter((e) => !e.forceEndedAt && !(e.endDate && e.endDate < now))
    .map(project);
  const past = allEvents
    .filter((e) => !!e.forceEndedAt || (!!e.endDate && e.endDate < now))
    .map(project);

  return <EventsClient active={active} past={past} teamCounts={teamCounts} />;
}
