import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clans, events, tiles, teams, completions, eventParticipants } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { resolveTeamManagement } from '@/lib/teamStaff';
import MyTeamClient from './MyTeamClient';
import TeamManageClient from './TeamManageClient';
import DraftClockClient from './DraftClockClient';
import DraftWatchClient from './DraftWatchClient';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { loadPlayerOwners, attachOwners, loadEventProfiles } from '@/lib/draftProfiles';
import { coverageGaps, rosterShape } from '@/lib/rosterShape';
import RosterShapePanel from '@/components/RosterShapePanel';
import type { Completion } from '@/lib/types';
import { atLeast } from '@/lib/clanRoles';
import { clanHref } from '@/lib/clanPath';
import ClanLink from '@/components/ClanLink';
import EventBriefing from '@/components/team/EventBriefing';
import { acceptedCohostClanIds } from '@/lib/coHost';

export const dynamic = 'force-dynamic';

export default async function MyTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const clan = await requireClan();
  const { teamId } = await params;
  const { from } = await searchParams;
  const tId = parseInt(teamId, 10);

  const user = await verifyUser();
  // Both sides, reconciled: beta added return-to-where-you-were; this branch made login
  // clan-aware. The return target is the clan-prefixed team page so you land back inside the clan,
  // not on the apex — same pattern as /profile.
  if (!user) redirect(`/login?return=${encodeURIComponent(await clanHref(`/team/${tId}`))}`);

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) notFound();
  // clan-scope: global -- a team is reached through membership, not through a clan — that is what lets a visiting clan's staff run their own team.
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) notFound();

  // Origin-aware back link: reaching your own team via the scoreboard redirects here (see the view-
  // board page), so honour where you came from — back to the scoreboard, not the My Teams hub.
  const backHref = from === 'scoreboard' ? `/events/${event.id}` : '/team';
  const backLabel = from === 'scoreboard' ? 'Back to scoreboard' : 'My teams';

  // Discord-session standing on this team is the single auth gate: captain, staff seat, or a player
  // row. Staff are people the host gave this one team to — a visiting clan's moderator, typically —
  // so the gate can't be "captain or player" any more.
  const membership = await resolveTeamManagement(tId);
  if (!membership) redirect(await clanHref('/team'));

  const { captainPassword: _p, ...safeTeam } = team;
  // Applicants/answers are a pre-draft concern — hide those captain links once the event is live.
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  // While the draft is live: captains get the live pick board; everyone else waits.
  if (event.draftStatus === 'active' || event.draftStatus === 'paused') {
    return (
      <div className={membership.isCaptain ? 'max-w-6xl mx-auto' : undefined}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <ClanLink href={backHref} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
            &larr; {backLabel}
          </ClanLink>
          {membership.isCaptain && (
            <ClanLink
              href={`/team/${tId}/applicants`}
              className="text-sm text-gold hover:text-gold/80 transition-colors"
            >
              War room &rarr;
            </ClanLink>
          )}
        </div>
        {membership.isCaptain ? (
          <>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: safeTeam.color }} />
              <h1 className="text-2xl font-bold">{safeTeam.name}</h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
                Captain
              </span>
            </div>
            <p className="text-text-muted text-sm mb-5">{event.name} &middot; player draft</p>
            <DraftClockClient teamId={tId} eventId={event.id} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gold mb-1">{safeTeam.name}</h1>
            <p className="text-text-muted text-sm mb-6">{event.name} &middot; draft in progress</p>
            <DraftWatchClient
              eventId={event.id}
              teamId={tId}
              teamName={safeTeam.name}
              myPlayerId={membership.playerId}
            />
          </>
        )}
      </div>
    );
  }

  const [allEventTiles, rawEventPlayers, tierBands] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, event.id)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, event.id)),
    getTierBands(clan.id),
  ]);
  // The team hub is a PLAYER surface. A captain is a player with extra buttons — not staff — so an
  // unrevealed board is as hidden here as it is on the event page: the tiles are dropped before the
  // page is built, not hidden in the client.
  //
  // No staff exception. Every other surface lets an admin see through the curtain, but here that
  // put the board in front of a host who is ALSO playing on a team — which is the one place seeing
  // it early actually matters. Staff who need to look at an unrevealed board have the Tiles tab in
  // the admin panel, where looking is a deliberate act rather than a side effect of opening their
  // own team page.
  // Read once for the briefing panel: who else is in this event, and whether THIS team is the side
  // that collects. A team with no clan tag is the host's own — the same reading lib/coHostSettlement
  // uses, so the panel and the settlement can never disagree about who holds the money.
  const cohostIds = await acceptedCohostClanIds(event.id);
  const cohostNames = cohostIds.length
    ? (await db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, cohostIds))).map((c) => c.name)
    : [];
  const hostClanName =
    (await db.select({ name: clans.name }).from(clans).where(eq(clans.id, event.clanId)).limit(1))[0]?.name ?? null;
  const isHostTeam = team.clanId == null || team.clanId === event.clanId;
  const briefing = {
    hostClan: hostClanName,
    cohosts: cohostNames,
    format: event.format ?? 'bingo',
    scoringMode: event.scoringMode ?? '',
    startDate: event.startDate ?? null,
    endDate: event.endDate ?? null,
    tileCount: allEventTiles.length,
    teamCount: new Set(rawEventPlayers.map((pl) => pl.teamId).filter((t): t is number => t != null)).size,
    signupFee: event.signupFee ?? null,
    cashPolicy: event.cashPolicy ?? 'host-holds',
    weCollect: (event.signupFee ?? 0) > 0 && (isHostTeam || (event.cashPolicy ?? 'host-holds') !== 'host-holds'),
  };

  const boardHidden = !event.tilesRevealed;
  // Reveal-policy events (lib/eventRules): only revealed tiles ever reach the client, even for
  // staff viewing their own team.
  const eventTiles = boardHidden ? [] : visibleTiles(parseEventRules(event.rules), allEventTiles);
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

  // What this roster said about itself when it signed up. The answers were only ever readable one
  // card at a time, so the group they add up to — where it's thin, when it plays — was invisible.
  const teamMemberIds = new Set(
    rawEventPlayers.filter((p) => p.teamId === tId && p.clanMemberId != null).map((p) => p.clanMemberId!),
  );
  const eventProfiles = teamMemberIds.size > 0 ? await loadEventProfiles(event.id) : new Map();
  const shape = rosterShape([...teamMemberIds].map((id) => eventProfiles.get(id) ?? {}));
  // Coverage GAPS name tiles the board asks for, so they only exist for someone allowed to see the
  // board — otherwise "nobody runs Nex" is a sentence about a sealed board's contents.
  const boardBossKeys = boardHidden
    ? []
    : eventTiles.flatMap((t) => (t.trackedStat ?? '').split(',').map((k) => k.trim()).filter(Boolean));
  const gaps = coverageGaps(shape, boardBossKeys);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <ClanLink href={backHref} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors">
          &larr; {backLabel}
        </ClanLink>
        {/* The war room has ONE way in. When the draft hasn't started the banner below says why to
            go there, so a second identical button above it was noise; once it has, this is it. */}
        {membership.isCaptain && !eventStarted && event.draftStatus !== 'none' && (
          <ClanLink
            href={`/team/${tId}/applicants`}
            className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition-colors"
          >
            Open the war room &rarr;
          </ClanLink>
        )}
      </div>
      <MyTeamClient
        event={event}
        team={safeTeam}
        tiles={eventTiles}
        completions={teamCompletions}
        players={eventPlayers}
        isCaptain={membership.isCaptain}
        boardHidden={boardHidden}
        tools={
          /* The captain's own blocks, handed to the client so they sit UNDER the team's name and
             countdown instead of above them. Arriving at your own team page and reading two
             control panels before the team's name was the wrong way round. */
          <>
            {membership.isCaptain && !eventStarted && event.draftStatus === 'none' && (
              <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gold">The draft hasn&apos;t started yet</p>
                  <p className="text-sm text-text-muted">
                    Scout the pool, read their sign-up answers, and put your picks in the order you want them.
                  </p>
                </div>
                <ClanLink
                  href={`/team/${tId}/applicants`}
                  className="shrink-0 text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors"
                >
                  Open the war room &rarr;
                </ClanLink>
              </div>
            )}
            {shape.answered > 0 && (
        <div className="mb-6">
          <RosterShapePanel shape={shape} gaps={gaps} title="Your roster, on paper" />
        </div>
      )}
      {membership.canManage && (
              <div className="mb-6">
                {/* The terms this team is playing under. A visiting clan's manager has no admin page
                    to read them on, and the host's screen is the only place they were written down. */}
                <EventBriefing {...briefing} />
                {/* Roster, requests, proof, fees and invite links in one shut card. */}
                <TeamManageClient teamId={tId} />
              </div>
            )}
          </>
        }
        myPlayerId={membership.playerId}
        myPlayerName={myPlayer?.name ?? null}
        tierBands={tierBands}
      />
    </div>
  );
}
