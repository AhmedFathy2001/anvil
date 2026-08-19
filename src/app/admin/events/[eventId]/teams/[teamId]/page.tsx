import { db } from '@/db';
import { clanMembers, events, tiles, teams, completions, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getTierBands } from '@/lib/pluginConfig';
import AdminTeamBoardClient from './AdminTeamBoardClient';
import CaptainAssignment from './CaptainAssignment';
import TeamStaffPanel from './TeamStaffPanel';
import TeamInvitePanel from '@/components/TeamInvitePanel';

export const dynamic = 'force-dynamic';

export default async function AdminTeamBoardPage({
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
  const tierBands = await getTierBands();

  const tileIds = eventTiles.map((t) => t.id);
  let teamCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.select().from(completions).where(eq(completions.teamId, tId));
    teamCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  // Is the captain actually ON this team? Naming one is supposed to enter them, but a captain named
  // before that was true — or one whose seating failed at the time — sits outside their own roster
  // with nothing to say so. The card offers to fix it when this comes back false.
  let captainSeated = true;
  if (team.captainUserId != null) {
    const accounts = await db
      .select({ id: clanMembers.id })
      .from(clanMembers)
      .where(eq(clanMembers.userId, team.captainUserId));
    const accountIds = new Set(accounts.map((a) => a.id));
    captainSeated = eventPlayers.some(
      (p) => p.clanMemberId != null && accountIds.has(p.clanMemberId) && p.teamId === tId,
    );
  }

  const { captainPassword: _, ...safeTeam } = team;

  return (
    <>
      <CaptainAssignment teamId={team.id} currentCaptainUserId={team.captainUserId} captainSeated={captainSeated} />
      <TeamStaffPanel teamId={team.id} />
      <div className="mb-6">
        <TeamInvitePanel teamId={team.id} captainToggle={{ eventId: event.id, rules: event.rules ?? null }} />
      </div>
      <AdminTeamBoardClient
        event={event}
        team={safeTeam}
        tiles={eventTiles}
        completions={teamCompletions}
        players={eventPlayers}
        tierBands={tierBands}
      />
    </>
  );
}
