import { db } from '@/db';
import { events, tiles, teams, completions, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyUser, resolveTeamMembership } from '@/lib/auth';
import MyTeamClient from './MyTeamClient';
import DraftBoardClient from '@/app/captain/[teamId]/DraftBoardClient';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { loadPlayerOwners, attachOwners } from '@/lib/draftProfiles';
import type { Completion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MyTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { teamId } = await params;
  const { from } = await searchParams;
  const tId = parseInt(teamId, 10);

  const user = await verifyUser();
  if (!user) redirect('/login');

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) notFound();
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) notFound();

  // Origin-aware back link: reaching your own team via the scoreboard redirects here (see the view-
  // board page), so honour where you came from — back to the scoreboard, not the My Teams hub.
  const backHref = from === 'scoreboard' ? `/events/${event.id}` : '/team';
  const backLabel = from === 'scoreboard' ? 'Back to scoreboard' : 'My teams';

  // Discord-session membership is the single auth gate — captain and/or player on this team.
  const membership = await resolveTeamMembership(event.id, tId);
  if (!membership) redirect('/team');

  const { captainPassword: _p, ...safeTeam } = team;
  // Applicants/answers are a pre-draft concern — hide those captain links once the event is live.
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  // While the draft is live: captains get the live pick board; everyone else waits.
  if (event.draftStatus === 'active' || event.draftStatus === 'paused') {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link href={backHref} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
            &larr; {backLabel}
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

  const [allEventTiles, rawEventPlayers, tierBands] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, event.id)),
    db.select().from(players).where(eq(players.eventId, event.id)),
    getTierBands(),
  ]);
  // Reveal-policy events (lib/eventRules): the team hub is a player surface — only revealed
  // tiles ever reach the client, even for staff viewing their own team.
  const eventTiles = visibleTiles(parseEventRules(event.rules), allEventTiles);
  // Attach each player's owner so MyTeamClient can roll a person's accounts into one contributor
  // for MVP + team size when the event is 'per-person' scored (no-op at maxAccounts=1).
  const eventPlayers = attachOwners(rawEventPlayers, await loadPlayerOwners(rawEventPlayers));

  const tileIds = new Set(eventTiles.map((t) => t.id));
  const teamCompletions: Completion[] = tileIds.size
    ? (await db.select().from(completions).where(eq(completions.teamId, tId)))
        .filter((c) => tileIds.has(c.tileId))
        .map((c) => ({
          id: c.id,
          teamId: c.teamId,
          tileId: c.tileId,
          completedAt: c.completedAt,
          statContributions: parseContributionSnapshot(c.statContributions),
          awardedPoints: c.awardedPoints,
        }))
    : [];

  const myPlayer = membership.playerId ? eventPlayers.find((p) => p.id === membership.playerId) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
          &larr; {backLabel}
        </Link>
        {membership.isCaptain && !eventStarted && (
          <Link
            href={`/team/${tId}/applicants`}
            className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition-colors"
          >
            View applicants &amp; answers &rarr;
          </Link>
        )}
      </div>
      {membership.isCaptain && !eventStarted && event.draftStatus === 'none' && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-gold">The draft hasn&apos;t started yet</p>
            <p className="text-sm text-text-muted">
              Scout everyone who signed up — their answers, hours, timezone and stats — to plan your picks.
            </p>
          </div>
          <Link
            href={`/team/${tId}/applicants`}
            className="shrink-0 text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors"
          >
            View applicants &amp; answers &rarr;
          </Link>
        </div>
      )}
      <MyTeamClient
        event={event}
        team={safeTeam}
        tiles={eventTiles}
        completions={teamCompletions}
        players={eventPlayers}
        isCaptain={membership.isCaptain}
        myPlayerId={membership.playerId}
        myPlayerName={myPlayer?.name ?? null}
        tierBands={tierBands}
      />
    </div>
  );
}
