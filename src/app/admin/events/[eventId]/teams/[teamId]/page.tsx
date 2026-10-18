import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { requireEventForPage } from '@/lib/eventScope';
import { clanRoster, events, tiles, teams, completions, players, eventParticipants, accounts, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getTierBands } from '@/lib/pluginConfig';
import AdminTeamBoardClient from './AdminTeamBoardClient';
import CaptainAssignment from './CaptainAssignment';
import TeamStaffPanel from './TeamStaffPanel';
import TeamInvitePanel from '@/components/TeamInvitePanel';
import { idParam } from '@/lib/routeIds';
import { withSearchText } from '@/lib/tileSearchText';

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
  const tId = idParam(teamId);

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
  //
  // The captain is a USER; seats belong to the PLAYER behind them (users.playerId). This compared the
  // user id against roster player ids — a different numbering — so every captain whose two ids differ
  // read as "not on the roster" while sitting right there on it.
  let captainSeated = true;
  if (team.captainUserId != null) {
    const captain = await db.query.users.findFirst({ where: eq(users.id, team.captainUserId), columns: { playerId: true } });
    if (captain?.playerId != null) {
      // clan-scope: global -- the subject is a PERSON, whose seats span clans by design.
      const seats = await db
        .select({ id: clanRoster.id })
        .from(clanRoster)
        .where(eq(clanRoster.playerId, captain.playerId));
      const seatIds = new Set(seats.map((a) => a.id));
      captainSeated = eventPlayers.some(
        (p) => p.clanMemberId != null && seatIds.has(p.clanMemberId) && p.teamId === tId,
      );
    } else {
      captainSeated = false; // a login with no character linked can't be on any roster
    }
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
        tiles={withSearchText(eventTiles)}
        completions={teamCompletions}
        players={eventPlayers}
        tierBands={tierBands}
      />
    </>
  );
}
