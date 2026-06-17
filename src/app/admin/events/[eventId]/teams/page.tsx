import { db } from '@/db';
import { events, tiles, teams, players, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TeamsDraftClient from './TeamsDraftClient';

export const dynamic = 'force-dynamic';

export default async function EventTeamsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, eventTeams, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select().from(teams).where(eq(teams.eventId, id)),
    db.select().from(players).where(eq(players.eventId, id)),
  ]);

  const tileIds = new Set(eventTiles.map((t) => t.id));
  const eventCompletions = tileIds.size
    ? (await db.select().from(completions)).filter((c) => tileIds.has(c.tileId))
    : [];

  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  return (
    <TeamsDraftClient
      event={event}
      tiles={eventTiles}
      teams={safeTeams}
      players={eventPlayers}
      completions={eventCompletions}
    />
  );
}
