import { db } from '@/db';
import { events, teams, settings, tiles, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import StatsClient from './StatsClient';
import { getStatStandings, getTeamStandings } from '@/lib/statStandings';

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
  const [eventTiles, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select().from(players).where(eq(players.eventId, id)),
  ]);

  const [statStandings, teamStandings, pullRow] = await Promise.all([
    getStatStandings(id),
    getTeamStandings(id, event.scoringMode),
    db.query.settings.findFirst({ where: eq(settings.key, `stats_pull_at:${id}`) }),
  ]);

  return (
    <StatsClient
      event={event}
      teams={safeTeams}
      tiles={eventTiles}
      players={eventPlayers}
      statStandings={statStandings}
      teamStandings={teamStandings}
      statsPulledAt={pullRow?.value ?? null}
    />
  );
}
