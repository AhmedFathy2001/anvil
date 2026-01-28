import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ScoreboardClient from './ScoreboardClient';

export const dynamic = 'force-dynamic';

export default async function EventScoreboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));

  const tileIds = eventTiles.map((t) => t.id);
  let eventCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions);
    eventCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  return (
    <ScoreboardClient
      event={event}
      tiles={eventTiles}
      teams={safeTeams}
      completions={eventCompletions}
    />
  );
}
