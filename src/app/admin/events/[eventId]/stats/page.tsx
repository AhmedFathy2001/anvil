import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import StatsClient from './StatsClient';

export const dynamic = 'force-dynamic';

export default async function EventStatsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  return <StatsClient event={event} teams={safeTeams} />;
}
