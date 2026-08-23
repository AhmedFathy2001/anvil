import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { requireEventForPage } from '@/lib/eventScope';
import { clanRoster, events, tiles, teams, completions, players, eventParticipants, accounts } from '@/db/schema';
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
  const clan = await requireClan();
  const { eventId, teamId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(eId);
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
  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eId));
  const tierBands = await getTierBands(clan.id);

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
      .select({ id: clanRoster.id })
      .from(clanRoster)
      .where(eq(clanRoster.playerId, team.captainUserId));
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
