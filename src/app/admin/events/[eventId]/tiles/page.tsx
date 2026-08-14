import { db } from '@/db';
import { events, tiles, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TilesClient from './TilesClient';
import { getTierBands } from '@/lib/pluginConfig';
import { verifyUser } from '@/lib/auth';
import { eventEditLocked } from '@/lib/eventLock';
import { isLadderFormat } from '@/lib/utils';
import { parseEventRules, hasMissions } from '@/lib/eventRules';

export const dynamic = 'force-dynamic';

export default async function EventTilesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, tierBands, user, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    getTierBands(),
    verifyUser(),
    db.select({ teamId: players.teamId }).from(players).where(eq(players.eventId, id)),
  ]);

  // Does this board actually have multi-person teams? Team-shaped tile options (Team Total vs Solo,
  // shared-kill credit, minimum teammates) describe nothing on an individual ladder, so the editor
  // drops them there. Every other format is team play by definition; a ladder only counts as team
  // play once some team really holds more than one player.
  const playersPerTeam = new Map<number, number>();
  for (const p of eventPlayers) {
    if (p.teamId != null) playersPerTeam.set(p.teamId, (playersPerTeam.get(p.teamId) ?? 0) + 1);
  }
  const teamPlay = !isLadderFormat(event.format) || [...playersPerTeam.values()].some((n) => n > 1);

  // Missions are a board-level opt-in, and a contradiction on a ladder — that format's whole board
  // is already a pool of announced objectives, so a "mission" inside it would be a mission inside a
  // mission. Elsewhere the flag only appears once the host has turned missions on for the event.
  const missionsAllowed = !isLadderFormat(event.format) && hasMissions(parseEventRules(event.rules));

  return (
    <TilesClient
      event={event}
      tiles={eventTiles}
      tierBands={tierBands}
      isAdmin={user?.role === 'admin'}
      editLocked={eventEditLocked(event)}
      teamPlay={teamPlay}
      missionsAllowed={missionsAllowed}
    />
  );
}
