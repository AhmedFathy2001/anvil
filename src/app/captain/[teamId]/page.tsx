import { db } from '@/db';
import { events, tiles, teams, completions, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyCaptain } from '@/lib/auth';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import CaptainBoardClient from './CaptainBoardClient';
import DraftBoardClient from './DraftBoardClient';

export const dynamic = 'force-dynamic';

export default async function CaptainBoardPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);

  // Verify this captain owns this team
  const captain = await verifyCaptain();
  if (!captain || captain.teamId !== tId) {
    redirect('/captain');
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, tId),
  });
  if (!team) notFound();

  const event = await db.query.events.findFirst({
    where: eq(events.id, team.eventId),
  });
  if (!event) notFound();

  // If draft is active or paused, show draft board instead
  if (event.draftStatus === 'active' || event.draftStatus === 'paused') {
    const { captainPassword: _, ...safeTeam } = team;
    return (
      <DraftBoardClient
        event={event}
        team={safeTeam}
      />
    );
  }

  // Reveal-policy events (lib/eventRules): captain board is a player surface — revealed tiles only.
  const eventTiles = visibleTiles(
    parseEventRules(event.rules),
    await db.select().from(tiles).where(eq(tiles.eventId, event.id)),
  );
  const eventPlayers = await db.select().from(players).where(eq(players.eventId, event.id));

  const tileIds = eventTiles.map((t) => t.id);
  let teamCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions).where(eq(completions.teamId, tId));
    teamCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  const { captainPassword: _, ...safeTeam } = team;

  return (
    <CaptainBoardClient
      event={event}
      team={safeTeam}
      tiles={eventTiles}
      completions={teamCompletions}
      players={eventPlayers}
    />
  );
}
