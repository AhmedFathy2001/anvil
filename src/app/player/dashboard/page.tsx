import { db } from '@/db';
import { events, tiles, teams, completions, eventParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyPlayer } from '@/lib/auth';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { getPlayerRecap } from '@/lib/eventRecap';
import PlayerDashboardClient from './PlayerDashboardClient';
import { clanHref } from '@/lib/clanPath';

export const dynamic = 'force-dynamic';

export default async function PlayerDashboardPage() {
  const playerSession = await verifyPlayer();
  if (!playerSession) {
    redirect(await clanHref('/player'));
  }

  const player = await db.query.eventParticipants.findFirst({
    where: eq(eventParticipants.id, playerSession.playerId),
  });
  if (!player || !player.teamId) {
    redirect(await clanHref('/player'));
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, player.teamId),
  });
  if (!team) notFound();

  // clan-scope: global -- a team is reached through membership, not through a clan — that is what lets a visiting clan's staff run their own team.
  const event = await db.query.events.findFirst({
    where: eq(events.id, team.eventId),
  });
  if (!event) notFound();

  // Reveal-policy events (lib/eventRules): player dashboard only ever sees revealed tiles.
  const eventTiles = visibleTiles(
    parseEventRules(event.rules),
    await db.select().from(tiles).where(eq(tiles.eventId, event.id)),
  );
  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, event.id));

  const tileIds = eventTiles.map((t) => t.id);
  let teamCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions).where(eq(completions.teamId, team.id));
    teamCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  const { captainPassword: _, ...safeTeam } = team;

  // "Your event, by the numbers" — a personal recap card. Only meaningful once the event ends, so the
  // client only renders it when `recap.ended`.
  const recap = await getPlayerRecap(event.id, player.id);

  return (
    <PlayerDashboardClient
      event={event}
      team={safeTeam}
      tiles={eventTiles}
      completions={teamCompletions}
      playerId={player.id}
      playerName={player.name}
      players={eventPlayers}
      recap={recap}
    />
  );
}
