import { db } from '@/db';
import { events, tiles, teams, completions, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TeamBoardClient from './TeamBoardClient';
import { verifyUser } from '@/lib/auth';
import { signupWindowState } from '@/lib/signup';

export const dynamic = 'force-dynamic';

export default async function TeamBoardPage({
  params,
}: {
  params: Promise<{ eventId: string; teamId: string }>;
}) {
  const { eventId, teamId } = await params;
  const eId = parseInt(eventId, 10);
  const tId = parseInt(teamId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  if (!event) notFound();

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, tId),
  });
  if (!team || team.eventId !== eId) notFound();

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, eId));
  const eventPlayers = await db.select().from(players).where(eq(players.eventId, eId));

  const tileIds = eventTiles.map((t) => t.id);
  let teamCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions).where(eq(completions.teamId, tId));
    teamCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  const { captainPassword: _, ...safeTeam } = team;

  // Same gate as the event scoreboard: non-staff viewers don't see the team board
  // until sign-ups have opened. Staff bypass for setup access.
  const session = await verifyUser();
  const isStaff = session?.role === 'admin' || session?.role === 'treasurer' || session?.role === 'moderator';
  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
  });
  if (!isStaff && window.reason === 'not_open_yet') {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
        <p className="text-lg font-semibold mb-1">This team board is hidden until sign-ups open</p>
        {event.signupOpensAt && (
          <p className="text-sm">Opens {new Date(event.signupOpensAt).toLocaleString()}.</p>
        )}
      </div>
    );
  }

  return (
    <TeamBoardClient
      event={event}
      team={safeTeam}
      tiles={eventTiles}
      completions={teamCompletions}
      players={eventPlayers}
    />
  );
}
