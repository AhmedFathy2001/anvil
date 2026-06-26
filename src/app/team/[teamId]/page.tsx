import { db } from '@/db';
import { events, tiles, teams, completions, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyUser, resolveTeamMembership } from '@/lib/auth';
import MyTeamClient from './MyTeamClient';
import DraftBoardClient from '@/app/captain/[teamId]/DraftBoardClient';

export const dynamic = 'force-dynamic';

export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);

  const user = await verifyUser();
  if (!user) redirect('/login');

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) notFound();
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) notFound();

  // Discord-session membership is the single auth gate — captain and/or player on this team.
  const membership = await resolveTeamMembership(event.id, tId);
  if (!membership) redirect('/team');

  const { captainPassword: _p, ...safeTeam } = team;

  // While the draft is live: captains get the live pick board; everyone else waits.
  if (event.draftStatus === 'active' || event.draftStatus === 'paused') {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link href="/team" className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
            &larr; My teams
          </Link>
          {membership.isCaptain && (
            <Link
              href={`/team/${tId}/applicants`}
              className="text-sm text-gold hover:text-gold/80 transition-colors"
            >
              View applicants &rarr;
            </Link>
          )}
        </div>
        {membership.isCaptain ? (
          <DraftBoardClient event={event} team={safeTeam} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gold mb-1">{safeTeam.name}</h1>
            <p className="text-text-muted text-sm mb-6">{event.name}</p>
            <div className="border border-dashed border-card-border rounded-xl p-8 text-center text-text-muted">
              The draft is currently in progress. Your team board opens here once the draft wraps up.
            </div>
          </>
        )}
      </div>
    );
  }

  const [eventTiles, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, event.id)),
    db.select().from(players).where(eq(players.eventId, event.id)),
  ]);

  const tileIds = new Set(eventTiles.map((t) => t.id));
  const teamCompletions = tileIds.size
    ? (await db.select().from(completions).where(eq(completions.teamId, tId))).filter((c) => tileIds.has(c.tileId))
    : [];

  const myPlayer = membership.playerId ? eventPlayers.find((p) => p.id === membership.playerId) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href="/team" className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
          &larr; My teams
        </Link>
        {membership.isCaptain && (
          <Link
            href={`/team/${tId}/applicants`}
            className="text-sm text-gold hover:text-gold/80 transition-colors"
          >
            View applicants &rarr;
          </Link>
        )}
      </div>
      <MyTeamClient
        event={event}
        team={safeTeam}
        tiles={eventTiles}
        completions={teamCompletions}
        players={eventPlayers}
        isCaptain={membership.isCaptain}
        myPlayerId={membership.playerId}
        myPlayerName={myPlayer?.name ?? null}
      />
    </div>
  );
}
