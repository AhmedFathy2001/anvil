import { db } from '@/db';
import { events, teams, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { count, desc } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import EventsClient, { type ListItem } from './EventsClient';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const [allEvents, allWeekly] = await Promise.all([
    db.select().from(events).orderBy(desc(events.createdAt)),
    db.select().from(weeklyCompetitions).orderBy(desc(weeklyCompetitions.startDate)),
  ]);

  const teamCounts: Record<number, number> = {};
  const participantCounts: Record<number, number> = {};
  await Promise.all([
    allEvents.length > 0
      ? db
          .select({ eventId: teams.eventId, c: count() })
          .from(teams)
          .groupBy(teams.eventId)
          .then((rows) => {
            for (const r of rows) teamCounts[r.eventId] = r.c;
          })
      : Promise.resolve(),
    allWeekly.length > 0
      ? db
          .select({ competitionId: weeklyParticipants.competitionId, c: count() })
          .from(weeklyParticipants)
          .groupBy(weeklyParticipants.competitionId)
          .then((rows) => {
            for (const r of rows) participantCounts[r.competitionId] = r.c;
          })
      : Promise.resolve(),
  ]);

  const now = new Date().toISOString();

  const eventItems: ListItem[] = allEvents.map((e) => ({
    kind: 'event',
    id: e.id,
    name: e.name,
    boardSize: e.boardSize,
    format: e.format,
    scoringMode: e.scoringMode,
    rules: e.rules,
    startDate: e.startDate,
    endDate: e.endDate,
    forceEndedAt: e.forceEndedAt,
    createdAt: e.createdAt,
    teamCount: teamCounts[e.id] ?? 0,
  }));

  const weeklyItems: ListItem[] = allWeekly.map((w) => ({
    kind: 'weekly',
    id: w.id,
    title: w.title,
    type: w.type === 'boss' ? 'boss' : 'skill',
    metric: w.metric,
    status: w.status,
    startDate: w.startDate,
    endDate: w.endDate,
    participantCount: participantCounts[w.id] ?? 0,
    createdAt: w.createdAt,
  }));

  const isPast = (item: ListItem) =>
    item.kind === 'event'
      ? !!item.forceEndedAt || (!!item.endDate && item.endDate < now)
      : item.status === 'completed';

  // Active list keeps newest-first; sort by the date the thing runs (falling back
  // to creation time for never-scheduled draft events).
  const sortKey = (item: ListItem) =>
    item.kind === 'event' ? item.startDate ?? item.createdAt : item.startDate;
  const byDateDesc = (a: ListItem, b: ListItem) => (sortKey(a) < sortKey(b) ? 1 : -1);

  const all: ListItem[] = [...eventItems, ...weeklyItems];
  const active = all.filter((i) => !isPast(i)).sort(byDateDesc);
  const past = all.filter(isPast).sort(byDateDesc);

  const session = await verifyUser();
  const canManage = session?.role === 'admin';

  return <EventsClient active={active} past={past} canManage={canManage} />;
}
