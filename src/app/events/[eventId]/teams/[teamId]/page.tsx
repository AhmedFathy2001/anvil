import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { events, tiles, teams, completions, eventParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import TeamBoardClient from './TeamBoardClient';
import { verifyUser, resolveTeamMembership } from '@/lib/auth';
import { signupWindowState } from '@/lib/signup';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { loadPlayerOwners, attachOwners } from '@/lib/draftProfiles';
import type { Completion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TeamBoardPage({
  params,
}: {
  params: Promise<{ eventId: string; teamId: string }>;
}) {
  const clan = await requireClan();
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

  // If you're actually on this team, the general-board "View board" link should land you on your
  // full My Team experience (submit / toggle / manage), not this read-only board — so the two
  // routes to your own team feel identical. Other teams (and staff/guests) stay on the view board.
  const myMembership = await resolveTeamMembership(eId, tId);
  if (myMembership && (myMembership.isCaptain || myMembership.playerId != null)) {
    // Carry the origin so My Team's back link returns to the scoreboard (this route), not the My
    // Teams hub — reaching your own team here should feel like it did on the general board.
    redirect(`/team/${tId}?from=scoreboard`);
  }

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, eId));
  const rawEventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eId));
  // Owner per player so TeamBoardClient can roll a person's accounts into one contributor (per-person).
  const eventPlayers = attachOwners(rawEventPlayers, await loadPlayerOwners(rawEventPlayers));
  const tierBands = await getTierBands(clan.id);

  const tileIds = eventTiles.map((t) => t.id);
  let teamCompletions: Completion[] = [];
  if (tileIds.length > 0) {
    const tileIdSet = new Set(tileIds);
    const allCompletions = await db.select().from(completions).where(eq(completions.teamId, tId));
    teamCompletions = allCompletions
      .filter((c) => tileIdSet.has(c.tileId))
      .map((c) => ({
        id: c.id,
        teamId: c.teamId,
        tileId: c.tileId,
        completedAt: c.completedAt,
        statContributions: parseContributionSnapshot(c.statContributions),
        awardedPoints: c.awardedPoints,
      }));
  }

  const { captainPassword: _, ...safeTeam } = team;

  // Same gate as the event scoreboard: non-staff viewers don't see the team board
  // until sign-ups have opened AND the host has revealed the tiles. Staff bypass for
  // setup access.
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
  if (!isStaff && !event.tilesRevealed) {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
        <p className="text-lg font-semibold mb-1">The tiles haven&apos;t been revealed yet</p>
        <p className="text-sm">The host will unveil the board before the event begins. Check back soon.</p>
      </div>
    );
  }

  // Reveal-policy events (lib/eventRules): non-staff only receive the revealed subset —
  // hidden tile content must never reach the client.
  const boardTiles = isStaff ? eventTiles : visibleTiles(parseEventRules(event.rules), eventTiles);

  return (
    <TeamBoardClient
      event={event}
      team={safeTeam}
      tiles={boardTiles}
      completions={teamCompletions}
      players={eventPlayers}
      tierBands={tierBands}
    />
  );
}
