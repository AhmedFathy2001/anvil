import { raceViewData } from '@/lib/raceSummary';
import { feeLabel, paidEntriesLabel, standardFee } from '@/lib/entryFeeMath';
import CohostTileSuggest from '@/components/CohostTileSuggest';
import { parseBoardAccess } from '@/lib/cohostBoardAccess';
import type { Metadata } from 'next';

import { db } from '@/db';
import { clanPrefix, currentClan, requireClan, resolveClanById } from '@/lib/clanContext';
import { canSeeEvent } from '@/lib/eventAccess';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { canonicalPathFor, socialMetadata } from '@/lib/seo';
import { eventLinkDescription } from '@/lib/linkText';
import { JsonLd, breadcrumbLd, eventLd } from '@/lib/jsonLd';
import { clanTrail } from '@/lib/seoPages';
import { clanHref } from '@/lib/clanPath';
import { eventInClan, requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import { eventIconUrl } from '@/lib/eventImage';
import { accounts, events, tiles, teams, completions, eventSignups, clanRoster, players, submissions, surveyQuestions, surveyResponses, eventStartProofs, eventParticipants, eventCohosts } from '@/db/schema';
import { nestParts } from '@/lib/combo';
import { and, eq, isNull, inArray, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ScoreboardClient from './ScoreboardClient';
import { verifyUser } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { showReportButton } from '@/lib/platformReportRules';
import { siteReactions } from '@/lib/siteReactions';
import { parseStamp } from '@/lib/dbTime';
import { tileKindKey } from '@/lib/tileKinds';
import { isManualTile } from '@/lib/clogManual';
import { signupWindowState, signupEditState } from '@/lib/signup';
import { countPaidEntries, computePrizePool } from '@/lib/prizePool';
import { eventPoolGp } from '@/lib/coffer';
import { placementAmounts } from '@/lib/payouts';
import EventHero from '@/components/EventHero';
import StartProofCard from '@/components/StartProofCard';
import { startProofState } from '@/lib/startProof';
import EventFirsts from '@/components/events/EventFirsts';
import { loadEventFirsts } from '@/lib/eventFirsts';
import MomentsFeed from '@/components/MomentsFeed';
import HighlightsStrip from '@/components/HighlightsStrip';
import ReportButton from '@/components/ReportButton';
import { highlightsForEvent, linksByMoment } from '@/lib/highlights/store';
import { getEventLuck } from '@/lib/eventLuck';
import EventLuck from './EventLuck';
import { eventFeed } from '@/lib/momentsStore';
import { collapseMomentRuns } from '@/lib/feedRuns';
import { isPointsMode, eventShapeBadge } from '@/lib/utils';
import { eventAxes } from '@/lib/eventAxes';
import {
  parseEventRules,
  hasRevealPolicy,
  visibleTiles,
  isMissionTile,
  lockedMissionPreviews,
  isTileRevealed,
  nextRevealAt,
  rotationExpiries,
  boardTiles as scoredBoardTiles,
} from '@/lib/eventRules';
import { deriveTileIcon } from '@/lib/tileIcons';
import { buildLadderView } from '@/lib/ladderView';
import LadderClient from './LadderClient';
import EventRulesCard from '@/components/events/EventRulesCard';
import { loadRulesFacts } from '@/lib/eventRulebook';
import { getTierBands } from '@/lib/pluginConfig';
import { computeEventMvp, computeMemberBreakdown, topMember, rollupByOwner, type StatGainMap, type TeamMvp } from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings, getTeamStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';
import { eventHasStarted as boardHasStarted } from '@/lib/completionGate';
import { atLeast } from '@/lib/clanRoles';
import { chatAccess } from '@/lib/eventChat';
import ClanLink from '@/components/ClanLink';
import { canEnterEvent } from '@/lib/eventAccess';
import { accentStyle } from '@/lib/accentStyle';
import EnterEvent from './EnterEvent';
import { eventActivityIsValid } from '@/lib/completionGate';
import LocalTime from '@/components/LocalTime';
import { isCreatorSpace, seatsEventPlayers, streamedEvent } from '@/lib/creatorSpaces';
import { isFriendsHost } from '@/lib/friendEventRules';
import { withSearchText } from '@/lib/tileSearchText';
import { standingsLayout } from '@/lib/standingsWindow';
import { placementOf } from '@/lib/teamPlacement';
import { supporterLooksByName } from '@/lib/supporter';
import { standingsScopeForSession } from '@/lib/standingsAccess';
import { canSeeTeamProgress, curtainInfo, filterToVisibleTeams, standingsHidden, standingsRevealAt } from '@/lib/standingsVisibility';

export const dynamic = 'force-dynamic';

/**
 * The board's own card and title.
 *
 * The most-pasted link on the platform had no metadata of its own, so every board in every clan
 * unfurled with the clan's name and the clan's card — three boards shared into the same Discord
 * channel were three identical previews. The event card is drawn by /api/og/event/[eventId], which
 * re-checks visibility itself and falls back to the plain Anvil card, so nothing here can leak a
 * private event by pointing at it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const clan = await currentClan();
  const id = Number((await params).eventId);
  if (!clan || !Number.isInteger(id)) return {};

  const event = await eventInClan(clan.id, id);
  // No event, or one this visitor may not read: say nothing and let the layout's clan-level
  // metadata stand. Naming it here would describe a page that is about to 404.
  const session = await verifyUser();
  if (!event || !(await canSeeEvent({ eventId: id, playerId: session?.playerId ?? null }))) return {};

  // A link card is as public as it gets: while the standings are hidden it names no leader.
  const curtained = standingsHidden(event);
  const [clanName, prefix, standings] = await Promise.all([
    getClanDisplayName(clan.id, clan.name),
    clanPrefix(),
    curtained ? Promise.resolve([]) : getTeamStandings(id, event.scoringMode),
  ]);
  return socialMetadata({
    title: `${event.name} — ${clanName || clan.name}`,
    description: eventLinkDescription(event, standings, Date.now(), { standingsHidden: curtained }),
    canonical: canonicalPathFor({ prefix, pathname: `/events/${id}`, clanSlug: clan.slug }),
    image: `/api/og/event/${id}`,
  });
}

export default async function EventScoreboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tile?: string | string[]; rules?: string | string[] }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const requestedTile = query.tile;
  const showRules = (Array.isArray(query.rules) ? query.rules[0] : query.rules) === '1';
  const initialTileId = Number(Array.isArray(requestedTile) ? requestedTile[0] : requestedTile);
  const id = parseInt(eventId, 10);
  // Before requireClan: on the apex this redirects to the event's own address instead of 404ing.
  await requireEventForParticipantPage(id);
  const clan = await requireClan();

  // Whose event is this? Ids are global and this one came from the URL. A co-host's address reaches
  // it too (`apiPrefix` set): its members play from their own clan, not the host's.
  const { apiPrefix } = await requireEventForParticipantPage(id);
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  // HIDDEN STANDINGS (lib/standingsVisibility): while the host keeps the standings back, everything
  // below that carries progress is cut to the viewer's own team(s) BEFORE it is derived from or sent
  // to the client — a member sees their own board in full and nothing about anyone else's. Staff
  // and a lifted curtain see it all; the filters are no-ops then.
  const standingsScope = await standingsScopeForSession(event);
  const curtain = curtainInfo(standingsScope);

  // Every row (combo parts included — their completions and submissions are the combo's progress),
  // and the BOARD: cells only, each combo carrying its `parts` (lib/combo nestParts).
  const allTileRows = await db.select().from(tiles).where(eq(tiles.eventId, id));
  const eventTiles = nestParts(allTileRows);
  // The board's rules (mechanics + the host's rulebook) — the same words every clan's Discord gets.
  const rulesFacts = await loadRulesFacts(id).catch(() => null);
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  // The HOST's bands — the tiles were authored against them, whichever clan's address this is.
  const tierBands = await getTierBands(event.clanId);

  const tileIds = allTileRows.map((t) => t.id);
  let eventCompletions: {
    id: number;
    teamId: number;
    tileId: number;
    completedAt: string;
    statContributions: StatContributionSnapshot | null;
    awardedPoints: number | null;
  }[] = [];
  if (tileIds.length > 0) {
    const tileIdSet = new Set(tileIds);
    const allCompletions = await db.select().from(completions);
    eventCompletions = allCompletions
      .filter((c) => tileIdSet.has(c.tileId) && eventActivityIsValid(event, c.completedAt))
      .filter((c) => canSeeTeamProgress(standingsScope, c.teamId))
      .map((c) => ({
        id: c.id,
        teamId: c.teamId,
        tileId: c.tileId,
        completedAt: c.completedAt,
        // Parse the frozen KC/XP split once here so the breakdown uses it for completed stat tiles.
        statContributions: parseContributionSnapshot(c.statContributions),
        awardedPoints: c.awardedPoints,
      }));
  }

  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  // Event MVP — the single highest-scoring member across every team. Pull only the columns the
  // split needs (not full submission rows) so a kill-count-heavy event doesn't drag this public page.
  const eventSubmissions = tileIds.length > 0
    ? await db
        .select({
          tileId: submissions.tileId,
          teamId: submissions.teamId,
          creditPlayerId: submissions.creditPlayerId,
          goal: submissions.goal,
          amount: submissions.amount,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(inArray(submissions.tileId, tileIds))
        .then((rows) =>
          rows.filter((row) => eventActivityIsValid(event, row.createdAt) && canSeeTeamProgress(standingsScope, row.teamId)),
        )
    : [];
  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, id));
  // Multi-account: owner per player + slot mode, so 'per-person' events rank the MVP by person.
  const ownerByPlayerId = await loadPlayerOwners(eventPlayers);
  const accountSlotMode = event.accountSlotMode;
  // Per skill/boss tile, each player's XP/KC gain — so stat tiles count toward the MVP too.
  const statStandings = await getStatStandings(id);
  const statGains: StatGainMap = {};
  for (const s of statStandings) {
    statGains[s.tileId] = filterToVisibleTeams(standingsScope, s.players, (pl) => pl.teamId).map((pl) => ({
      playerId: pl.playerId,
      gained: pl.gained,
    }));
  }
  // The event MVP ranks everyone against everyone — exactly what the curtain is for.
  const mvpAll = curtain ? null : computeEventMvp({
    scoringMode: event.scoringMode,
    teams: eventTeams,
    players: eventPlayers,
    tiles: eventTiles,
    completions: eventCompletions,
    submissions: eventSubmissions,
    statGains,
    ownerByPlayerId,
    accountSlotMode,
  });
  const mvp = mvpAll;

  // MVP of the day — the same split, but scored only over tiles completed in the last 24h. The
  // completedAt filter is all it needs (computeEventMvp ignores completion timestamps); stat tiles
  // still count via their total gain. Null when nothing was completed in the window.
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const mvpTodayRaw = curtain ? null : computeEventMvp({
    scoringMode: event.scoringMode,
    teams: eventTeams,
    players: eventPlayers,
    tiles: eventTiles,
    completions: eventCompletions.filter((c) => c.completedAt >= dayAgoIso),
    submissions: eventSubmissions,
    statGains,
    ownerByPlayerId,
    accountSlotMode,
  });
  // Early in an event everything was completed recently, so the day MVP == the overall MVP. Drop the
  // duplicate card in that case; keep it once they diverge (even the same player with different totals).
  const mvpToday =
    mvpTodayRaw &&
    mvp &&
    mvpTodayRaw.playerId === mvp.playerId &&
    mvpTodayRaw.points === mvp.points &&
    mvpTodayRaw.tasks === mvp.tasks
      ? null
      : mvpTodayRaw;

  // Ladder events rank PEOPLE and usually never end, so they get their own surface (LadderClient)
  // rather than the team scoreboard with the team parts switched off. Everything it renders —
  // seasons, movement, streaks, the hall — is derived here from rows already loaded above.
  const isLadder = eventAxes(event).competitors === 'individuals';
  let ladderHasTeams = false;
  if (isLadder) {
    const playersPerTeam = new Map<number, number>();
    for (const p of eventPlayers) {
      if (p.teamId != null) playersPerTeam.set(p.teamId, (playersPerTeam.get(p.teamId) ?? 0) + 1);
    }
    ladderHasTeams = [...playersPerTeam.values()].some((n) => n > 1);
  }

  // Per-team MVP (overall) for the standings cards — the top contributor on each team.
  const teamMvps: Record<number, TeamMvp | null> = {};
  for (const team of eventTeams) {
    if (!canSeeTeamProgress(standingsScope, team.id)) continue;
    const bd = computeMemberBreakdown({
      teamId: team.id,
      scoringMode: event.scoringMode,
      players: eventPlayers,
      tiles: eventTiles,
      completions: eventCompletions,
      submissions: eventSubmissions,
      statGains,
    });
    teamMvps[team.id] = topMember(accountSlotMode === 'per-person' ? rollupByOwner(bd, ownerByPlayerId) : bd);
  }

  // Sign-up CTA — server-side so the right banner shows on first paint without a client
  // round-trip. We need the viewer's session, their existing signup (if any), and whether
  // they have any verified RSNs at all (controls the banner's primary action).
  const session = await verifyUser();
  // The Report flag (lib/platformReports) is for everyone signed in EXCEPT the host clan's own staff,
  // who run this event and fix it in its settings. clanGrant reads clan_staff for exactly event.clanId.
  const canReport = showReportButton({
    signedIn: !!session?.userId,
    staffOfTarget: session?.userId ? (await clanGrant(event.clanId, session.userId)) != null : false,
  });
  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
    // A friends host's undated event is open to its invite link's people (lib/signup).
    hostKind: (await resolveClanById(event.clanId))?.kind,
  });

  let mySignup: { status: string } | null = null;
  let editOpen = false;
  let hasVerifiedAccount = false;
  let myMemberIds: number[] = [];
  if (session) {
    const sig = await db.query.eventSignups.findFirst({
      where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
    });
    mySignup = sig ? { status: sig.status } : null;
    // Whether an already-signed-up viewer can still edit — honors the payment-deadline grace,
    // and stays closed once that (or the sign-up deadline) passes. Without this the banner would
    // keep inviting edits days after sign-ups closed.
    if (mySignup && mySignup.status !== 'withdrawn') {
      editOpen = signupEditState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
        paymentDeadline: event.paymentDeadline,
      }).open;
    }

    myMemberIds = (
      // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to the viewer's own.
      await db
        .select({ id: clanRoster.id })
        .from(clanRoster)
        .where(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)))
    ).map((m) => m.id);
    hasVerifiedAccount = myMemberIds.length > 0;
  }

  // Can this viewer sign up at all, or do they have to be let in first?
  //
  // `event_signups.clan_member_id` names a seat in the HOSTING clan, so somebody without one has
  // nowhere to sit and the ordinary banner would send them to a form that cannot succeed. It did
  // exactly that, because `hasVerifiedAccount` above counts seats in ANY clan — which is right for
  // the ladder strip below and wrong for this question.
  // A creator space's event (lib/creatorSpaces): the join card is the one-button version.
  // A streamed event (a creator space's, or a Streaming clan's open to viewers) gets the viewer's join flow.
  const hostRow = await resolveClanById(event.clanId);
  const creatorEvent = streamedEvent(hostRow, event);
  // A friends event (lib/friendEventRules) joins the same one-button way — the invite link already
  // said yes — without being streamed (no highlights, no gates).
  const oneButtonJoin = seatsEventPlayers(hostRow, event);
  let isOutsider = false;
  if (session?.playerId != null) {
    const verdict = await canEnterEvent({ eventId: id, playerId: session.playerId });
    isOutsider = verdict.outcome === 'outsider';
  }
  // Which player rows in THIS event are the viewer's — the ladder's "you" strip needs it, and it's
  // the same membership lookup the sign-up banner already did.
  const myPlayerIds = myMemberIds.length
    ? eventPlayers.filter((p) => p.clanMemberId != null && myMemberIds.includes(p.clanMemberId)).map((p) => p.id)
    : [];

  // A players board (lib/standingsWindow): solo placement, or a big board of one-person teams. Its
  // standings read as a ranked list with the viewer's own line(s) picked out — every account of theirs
  // entered, matched by roster seat or by the account itself (a guest from another clan has no seat here).
  const membersPerTeam = new Map<number, number>(eventTeams.map((t) => [t.id, 0]));
  for (const p of eventPlayers) if (p.teamId != null && membersPerTeam.has(p.teamId)) membersPerTeam.set(p.teamId, membersPerTeam.get(p.teamId)! + 1);
  // 12+ teams of any size (lib/standingsWindow isManyTeams): the same cut list, worded as teams.
  const layout = isLadder ? 'cards' : standingsLayout(placementOf(event), [...membersPerTeam.values()]);
  const soloBoard = layout === 'players';
  const manyTeamsBoard = layout === 'teams';
  let teamMembers: Record<number, string[]> | undefined;
  if (manyTeamsBoard) {
    teamMembers = Object.fromEntries(eventTeams.map((t) => [t.id, [] as string[]]));
    for (const p of eventPlayers) if (p.teamId != null && teamMembers[p.teamId]) teamMembers[p.teamId].push(p.name);
  }
  let myTeamIds: number[] = [];
  if ((soloBoard || manyTeamsBoard) && session?.playerId != null) {
    const myAccountIds = new Set(
      (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, session.playerId))).map((a) => a.id),
    );
    myTeamIds = [...new Set(
      eventPlayers
        .filter((p) => p.teamId != null && (myPlayerIds.includes(p.id) || (p.accountId != null && myAccountIds.has(p.accountId))))
        .map((p) => p.teamId!),
    )];
  }

  // Playing, but the plugin hasn't been heard from since the start? Then drop, kill and lap tiles
  // are silently not counting for them, and nothing on the board said so.
  let pluginQuiet = false;
  const startedAt = event.startDate ? Date.parse(event.startDate) : NaN;
  // Only on boards with plugin-counted tiles: a skills-and-bosses board counts off the hiscores.
  const boardNeedsPlugin = allTileRows.some(
    (t) => !isManualTile(t) && !['standard', 'skill', 'boss'].includes(tileKindKey(t)),
  );
  if (boardNeedsPlugin && myPlayerIds.length > 0 && startedAt <= Date.now() && !isEventEnded(event)) {
    const pushes = await db
      .select({ at: accounts.liveStatsAt })
      .from(eventParticipants)
      .innerJoin(accounts, eq(eventParticipants.accountId, accounts.id))
      .where(inArray(eventParticipants.id, myPlayerIds));
    // Give a fresh start an hour before nagging — nobody is "missing" ten minutes in.
    pluginQuiet =
      Date.now() - startedAt > 3_600_000 && !pushes.some((r) => (parseStamp(r.at) ?? 0) >= startedAt);
  }

  // Underway and the viewer isn't on the board. Two different people, and both used to get nothing:
  // somebody who signed up but whose seat no longer resolves to a player here (the personal parts of
  // the board just vanished for them), and somebody who never signed up (the banner went blank).
  const underway = startedAt <= Date.now() && !isEventEnded(event);
  const offBoard =
    session && underway && myPlayerIds.length === 0 && !isOutsider
      ? mySignup && mySignup.status === 'approved'
        ? ('signed-up' as const)
        : !mySignup || mySignup.status === 'withdrawn'
          ? ('not-entered' as const)
          : null
      : null;

  // Hide the board when either (a) sign-ups haven't opened yet, or (b) the host hasn't revealed the
  // tiles.
  //
  // No staff exception. This is the PUBLIC page — the one the admin rail links to as "Player view" —
  // and a host who can't see what a member sees can't tell whether the curtain is actually drawn.
  // Staff who want the real board have the admin panel's Tiles tab and its team boards, where
  // looking is a deliberate act.
  const tilesHidden = !event.tilesRevealed;
  const hideBoardFromPlayer = window.reason === 'not_open_yet' || tilesHidden;

  // Reveal-policy events (lib/eventRules): members only receive the revealed subset — hidden
  // tile content must never reach the client. Staff keep the full board. The aggregate counts
  // (hidden count, next reveal time) are safe to share and feed the board's countdown banner.
  const rules = parseEventRules(event.rules);
  // The board's firsts — read in claim order, so they're a fact about the event rather than a
  // recomputation of the standings.
  // Hidden standings: the firsts name whichever team got there first, so they wait for the reveal.
  const firsts = curtain ? [] : await loadEventFirsts(event.id, event.startDate);
  // The week's colour: pets, clog slots, 1M+ drops and deaths that happened while the board ran
  // (lib/moments isEventFeedWorthy) — never any part of the scoring.
  // Back-to-back repeats (someone's run of deaths) collapse to one line with a count (lib/feedRuns)
  // in what this viewer sees, before the cut to twelve.
  const eventMoments = collapseMomentRuns((await eventFeed(event.id, curtain ? 60 : 36))
    .filter((moment) => eventActivityIsValid(event, moment.occurredAt))
    // Behind the curtain: only the viewer's own team's moments (a teamless moment names no side
    // and can't be placed, so it waits too).
    .filter((moment) => canSeeTeamProgress(standingsScope, moment.teamId))).slice(0, 12);
  // Stream highlights (lib/highlights): a streamed board's clips and stream timestamps, under the same
  // curtain as the feed above. The page's own gate already decided the event is this viewer's to see.
  const streamHighlights = creatorEvent
    ? await highlightsForEvent(event.id, (teamId) => canSeeTeamProgress(standingsScope, teamId), { limit: 100 }).catch(() => [])
    : [];
  const highlightStrip = streamHighlights.slice(0, 12);
  const momentStreamLinks = linksByMoment(streamHighlights);
  const tileHighlights: Record<number, typeof streamHighlights> = {};
  for (const h of streamHighlights) if (h.tileId != null) (tileHighlights[h.tileId] ??= []).push(h);
  // GZ / Sad / Sit under each (lib/siteReactions): counts for anyone who sees the row, who gave them
  // (and a press) for the board's players and the host's staff, as in the plugin's Feed.
  const momentReactions = eventMoments.length ? await siteReactions(eventMoments, { eventId: event.id, hostClanId: event.clanId }, session?.userId ?? null) : undefined;
  // Who the game was kind to this event, and who it wasn't (lib/eventLuck) — once it has started.
  // Cross-team by construction (luckiest / unluckiest across the whole board) — held while hidden.
  const luck =
    !curtain && event.startDate && Date.parse(event.startDate) <= Date.now()
      ? await getEventLuck(event.id).catch(() => null)
      : null;
  const boardTiles = visibleTiles(rules, eventTiles);
  // A TILE RACE's own data — built from the VISIBLE board only (this viewer's boardTiles) and the
  // completions on it, so a hidden tile's label, a hidden mission or an unopened slot can't leak
  // through the route, the firsts, the feed or the step count. Nothing before the reveal.
  const raceView = event.format === 'tilerace' && event.tilesRevealed
    ? raceViewData({ visibleBoardTiles: boardTiles, teams: safeTeams, completions: eventCompletions, withFirsts: !curtain })
    : null;
  const raceRouteGraph = raceView?.graph ?? null;
  const raceStandings = raceView?.standings ?? null;
  const raceEmoji: Record<string, string> = { 'off-the-line': '🏁', junction: '⇄', 'road-switch': '↪' };
  for (const f of raceView?.firsts ?? []) {
    firsts.push({ key: `race-${f.key}`, emoji: raceEmoji[f.key], title: f.title, blurb: f.title, who: f.team.name, teamName: f.team.name, teamColor: f.team.color, tileLabel: f.detail, at: f.at ?? '' });
  }
  // Board tiles only: a mission hidden until its drop isn't even a number in "N still hidden".
  const hiddenTileCount = hasRevealPolicy(rules)
    ? eventTiles.filter((t) => !isMissionTile(t)).length - visibleTiles(rules, eventTiles).filter((t) => !isMissionTile(t)).length
    : 0;
  // Nothing here is staff-only any more: this page shows one board, the member's. The "which tiles
  // can't they see" overlay lives on the admin team boards, which is where a host checks that.
  const staffOnlyTileIds: number[] = [];
  const upcomingRevealAt = hasRevealPolicy(rules) ? nextRevealAt(event, rules, eventTiles) : null;

  // A SHOWDOWN advertises its schedule: every slot's time and value are public from the start, and
  // only the content is hidden. Members can't be sent the hidden tiles themselves (that would leak
  // exactly what the format is built to withhold), so they get placeholders carrying nothing but
  // when it lands and what it's worth. Staff already receive the real tiles.
  const hiddenSchedule =
    rules.revealPolicy === 'scheduled'
      ? eventTiles
          // A mission is never a schedule slot: one hidden until its drop shows nothing at all.
          .filter((t) => !isTileRevealed(rules, t) && !isMissionTile(t))
          .map((t) => ({ revealAt: t.revealAt, points: t.points }))
      : [];

  // Post-event survey nudge — show an approved participant a CTA once the event has ended, if a survey
  // exists and they haven't responded yet. Cheap guarded queries (only when they're eligible).
  let showSurveyCta = false;
  if (session && mySignup?.status === 'approved' && isEventEnded(event)) {
    const [{ c: qCount }] = await db
      .select({ c: count() })
      .from(surveyQuestions)
      .where(eq(surveyQuestions.eventId, id));
    if (qCount > 0) {
      const resp = await db.query.surveyResponses.findFirst({
        where: and(eq(surveyResponses.eventId, id), eq(surveyResponses.userId, session.userId)),
      });
      showSurveyCta = !resp;
    }
  }

  // Fun end-of-event recap ("superlatives") CTA — shown to everyone once the event has ended, but only
  // when there's actually something to show. `mvp` is non-null exactly when someone scored/completed a
  // task, which guarantees the recap has at least the MVP award, so we never link to an empty page.
  const showRecapCta = isEventEnded(event) && !!mvp;
  // The stats page counts from the start; before it there's nothing to show.
  const showStatsLink = boardHasStarted(event);
  // The chat moderation page, for the host clan's mods and up and Anvil staff (lib/eventChat chatAccess),
  // only at the host's own address: a co-host's role says nothing about this event.
  const canModerateChat = !apiPrefix && event.chatEnabled && session ? !!(await chatAccess(event.id, session.userId))?.staff : false;

  // The pot counts fees actually in (lib/prizePool countPaidEntries), not every approved sign-up.
  const [paid, cofferFunded] = await Promise.all([countPaidEntries(id), eventPoolGp(id)]);
  const approvedCount = paid.count;
  const prizePool = computePrizePool({
    addedPrizePool: event.addedPrizePool,
    signupFee: event.signupFee,
    approvedCount,
    paidFeesGp: paid.gp,
    cofferFunded,
  });

  // Hero props: shape/points badge and the advertised prize-per-placement structure (public).
  const pointsMode = isPointsMode(event.scoringMode);
  // Missions are excluded: they're a bonus dropped mid-event from their own pool, so counting them
  // here would move the advertised board total the moment one is announced (see lib/eventRules).
  const requiredTiles = scoredBoardTiles(eventTiles).filter((t) => !t.optional);
  // Null until revealed: how many points the board holds is part of what the host is keeping back.
  const pointsOnBoard = pointsMode && event.tilesRevealed
    ? requiredTiles.reduce((sum, t) => sum + (t.points ?? 0), 0)
    : null;
  // Resolved against the LIVE pool, so a board whose prizes are set as shares advertises what each
  // place is worth right now rather than what it was worth when the host typed it in.
  const placementPrizes = placementAmounts(event, prizePool);

  const prizeBreakdownParts: string[] = [];
  // Members, guests and hand-priced entries pay different amounts — "× fee" only when that's true.
  if (paid.gp > 0) {
    prizeBreakdownParts.push(paidEntriesLabel(approvedCount, paid.gp, event.signupFee));
  }
  if ((event.addedPrizePool ?? 0) > 0) {
    prizeBreakdownParts.push(`${event.addedPrizePool!.toLocaleString()} gp added`);
  }
  // Named rather than folded into "added": a pool out of the clan's own coffer is the clan paying
  // for this, which is worth reading on the page people enter from.
  if (cofferFunded > 0) {
    prizeBreakdownParts.push(`${cofferFunded.toLocaleString()} gp from the clan coffer`);
  }

  // The ladder view model — seasons, movement, streaks, the hall, the feed — all derived from the
  // rows above, so a ladder costs one extra pass over data the page already had in memory.
  const ladderView =
    isLadder && !hideBoardFromPlayer
      ? buildLadderView({
          event,
          tiles: eventTiles,
          teams: eventTeams,
          players: eventPlayers,
          completions: eventCompletions,
          submissions: eventSubmissions,
          statGains,
          ownerByPlayerId,
          myPlayerIds,
        })
      : null;

  if (ladderView) {
    // Members see only what's been revealed; staff see the whole pool so they can still configure it.
    const ladderTiles = scoredBoardTiles(eventTiles).filter((t) => isTileRevealed(rules, t));
    const expiries = rotationExpiries(
      rules,
      ladderTiles.filter((t) => t.revealedAt && !t.closedAt),
      upcomingRevealAt,
    );
    // Supporter flair on the names the standings show: one query for every row in every scope.
    const ladderLooks = await supporterLooksByName([...new Set(ladderView.scopes.flatMap((sc) => sc.rows.map((r) => r.name)))]);
    return (
      <LadderClient
        event={event}
        tiles={ladderTiles
          .map((t) => ({
            id: t.id,
            label: t.label,
            points: t.points,
            icon: deriveTileIcon(t),
            revealedAt: t.revealedAt,
            closedAt: t.closedAt,
          }))}
        view={ladderView}
        shapeBadge={raceRouteGraph && event.tilesRevealed ? `Race · ${raceRouteGraph.lastStep + 1} steps` : eventShapeBadge(event.format, event.scoringMode, event.tilesRevealed ? event.boardSize : null, event.rules)}
        hiddenTileCount={hiddenTileCount}
        nextRevealAt={upcomingRevealAt}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdownParts.length ? prizeBreakdownParts.join('  +  ') : null}
        placementPrizes={placementPrizes}
        expiryByTile={Object.fromEntries(expiries)}
        showTeam={ladderHasTeams}
        poolSize={scoredBoardTiles(eventTiles).length}
        curtain={curtain}
        supporterLooks={ladderLooks}
      />
    );
  }

  // STARTING SHOT (lib/startProof): a player who owes one is playing without their credits counting
  // for the next few hours, and until now the only place that said so was the My Teams hub — a page
  // you have no reason to open when you came here to look at the board. The ask lapses six hours
  // after the start, and `needsUpload` already carries that, so this goes quiet on its own.
  const startProofCfg = parseEventRules(event.rules).startProof;
  const myStartProofs: {
    playerId: number;
    rsn: string;
    location: string;
    spot: { x: number; y: number; radius: number } | null;
    keyword: string;
    maxSessionMinutes: number;
    status: 'pending' | 'accepted' | 'rejected' | null;
    reviewNote: string | null;
  }[] = [];
  if (startProofCfg && myPlayerIds.length > 0) {
    const proofRows = await db
      .select()
      .from(eventStartProofs)
      .where(and(eq(eventStartProofs.eventId, event.id), inArray(eventStartProofs.playerId, myPlayerIds)));
    const proofByPlayer = new Map(proofRows.map((r) => [r.playerId, r]));
    for (const playerId of myPlayerIds) {
      const proof = proofByPlayer.get(playerId);
      const state = startProofState({ cfg: startProofCfg, event, playerId, proof });
      if (!state.needsUpload || !state.location || !state.keyword) continue;
      myStartProofs.push({
        playerId,
        rsn: eventPlayers.find((p) => p.id === playerId)?.name ?? 'You',
        location: state.location,
        spot: state.spot,
        keyword: state.keyword,
        maxSessionMinutes: state.maxSessionMinutes,
        status: (proof?.status as 'pending' | 'rejected' | undefined) ?? null,
        reviewNote: proof?.reviewNote ?? null,
      });
    }
  }

  // Staff see through the curtain; say so, or a host can't tell that their players don't.
  const staffSeesCurtain = !curtain && standingsHidden(event);
  const staffCurtainAt = staffSeesCurtain ? standingsRevealAt(event) : null;

  // The icon falls back to the HOST's logo, even when this page is reached at a co-host's address.
  const hostClan = event.clanId === clan.id ? clan : await resolveClanById(event.clanId);
  // Suggestions open to every player of this (co-host) clan, before the board starts.
  const cohostSuggest =
    event.clanId !== clan.id &&
    !(event.startDate && new Date(event.startDate) <= new Date()) &&
    (await db
      .select({ staffCanEditBoard: eventCohosts.staffCanEditBoard, boardAccess: eventCohosts.boardAccess })
      .from(eventCohosts)
      .where(and(eq(eventCohosts.eventId, event.id), eq(eventCohosts.clanId, clan.id), eq(eventCohosts.status, 'accepted')))
      .limit(1)
      .then(([seat]) => !!seat && parseBoardAccess(seat.boardAccess, seat.staffCanEditBoard).suggest === 'players'));
  return (
    // A streamed event wears its host space's colour (lib/accentStyle); `contents` adds no box, so the
    // page lays out exactly as before and only the custom properties are inherited.
    <div className="contents" style={creatorEvent ? accentStyle(hostRow?.accentColor) : undefined}>
      <EventApiHost eventId={event.id} prefix={apiPrefix} />
      {/* A board is an EVENT — it has a name, a start, an end and an organiser — and saying so is
          what lets it appear in search as an event rather than as a blue link. Emitted only for a
          clan a stranger may read: a `members` clan never renders children at all (the layout swaps
          in ClanPrivate), and an invite-only board is not reachable here without a seat. */}
      {!apiPrefix && <JsonLd
        data={eventLd({
          name: event.name,
          url: `/c/${clan.slug}/events/${event.id}`,
          startDate: event.startDate,
          // A force-ended board really ended then, whatever its planned end said.
          endDate: event.forceEndedAt ?? event.endDate,
          clanName: clan.name,
          clanSlug: clan.slug,
          hostKind: hostClan?.kind,
        })}
      />}
      {!apiPrefix && <JsonLd
        data={breadcrumbLd(
          clanTrail(clan, [
            { name: isCreatorSpace(clan) ? 'Events' : 'Competitions', path: `/c/${clan.slug}/events` },
            { name: event.name, path: `/c/${clan.slug}/events/${event.id}` },
          ]),
        )}
      />}
      <EventHero
        name={event.name}
        iconUrl={eventIconUrl(event, hostClan)}
        bannerUrl={event.bannerUrl}
        bannerPosition={event.bannerPosition}
        hostName={hostClan?.name ?? clan.name}
        // A creator space's event names its host in words, not with a clan crest's say-so.
        // A friends event (lib/friendEventRules) too: "Ahmed’s friends".
        hostedBy={isCreatorSpace(hostClan) || isFriendsHost(hostClan) ? hostClan?.name ?? null : null}
        shapeBadge={raceRouteGraph && event.tilesRevealed ? `Race · ${raceRouteGraph.lastStep + 1} steps` : eventShapeBadge(event.format, event.scoringMode, event.tilesRevealed ? event.boardSize : null, event.rules)}
        pointsOnBoard={pointsOnBoard}
        teamsCount={safeTeams.length}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdownParts.length ? prizeBreakdownParts.join('  +  ') : null}
        startDate={event.startDate}
        endDate={event.endDate}
        forceEndedAt={event.forceEndedAt}
        placementPrizes={placementPrizes}
        startProof={!!parseEventRules(event.rules).startProof}
      />
      {myStartProofs.length > 0 && (
        <section id="starting-shot" className="mb-6 scroll-mt-20">
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-3">
            <p className="font-semibold text-yellow-300">Your starting shot is still missing</p>
            <p className="text-sm text-text-muted">
              Until it&apos;s filed, drops you submit are held for review. It only takes a screenshot —
              and the ask expires a few hours into the event, so it&apos;s now or not at all.
            </p>
          </div>
          <div className="grid gap-3">
            {myStartProofs.map((c) => (
              <StartProofCard
                key={c.playerId}
                eventId={event.id}
                eventName={event.name}
                playerId={c.playerId}
                rsn={c.rsn}
                location={c.location}
                spot={c.spot}
                keyword={c.keyword}
                maxSessionMinutes={c.maxSessionMinutes}
                status={c.status}
                reviewNote={c.reviewNote}
              />
            ))}
          </div>
        </section>
      )}
      {pluginQuiet && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold">We haven’t heard from your Anvil plugin since the start</div>
            <div className="text-sm text-text-muted">
              Drops, kills and laps only count by themselves while the plugin is running in RuneLite.
            </div>
          </div>
          <ClanLink
            href="/guide/plugin"
            className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
          >
            Set up the plugin
          </ClanLink>
        </div>
      )}
      {offBoard === 'signed-up' && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold">You’re signed up, but we can’t find you on the board</div>
            <div className="text-sm text-text-muted">
              None of the characters linked to your profile is playing in this event, so your own progress won’t show
              here. Check your linked characters, or ask the hosts which one they entered.
            </div>
          </div>
          <ClanLink
            href="/profile"
            className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
          >
            Your characters
          </ClanLink>
        </div>
      )}
      {offBoard === 'not-entered' && (
        <div className="mb-6 rounded-xl border border-card-border bg-brown-dark p-4">
          <div className="font-semibold">This one’s already running</div>
          <div className="text-sm text-text-muted">
            Sign-ups closed when it started, so you’re watching this time. Next time, look for the sign-up link before
            the start.
          </div>
        </div>
      )}
      {creatorEvent && !session && window.open ? (
        // A creator space's event, signed out: one button. Discord sign-in, then straight back here,
        // where the same button joins them (EnterEvent, creator mode).
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--sa)]/40 bg-[var(--sa-soft)] p-5">
          <div className="min-w-0 flex-[1_1_16rem]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sa-text)]">Step 1 of 2</div>
            <div className="mt-1 text-lg font-semibold">Join this event</div>
            <div className="text-sm text-text-muted">Sign in with Discord — it takes a few seconds. Then one more tap and you’re playing.</div>
          </div>
          <ClanLink
            href={`/login?return=${encodeURIComponent(await clanHref(`/events/${event.id}`))}`}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--sa)] px-7 text-base font-bold text-[var(--sa-ink)] transition-opacity hover:opacity-90 sm:w-auto"
          >
            Continue with Discord
          </ClanLink>
        </div>
      ) : isOutsider ? (
        <EnterEvent
          eventId={event.id}
          signupFee={standardFee(event, true)}
          signupsOpen={window.open}
          creator={oneButtonJoin}
        />
      ) : (
      <SignupBanner
        eventId={event.id}
        signupReturn={await clanHref(`/events/${event.id}/signup`)}
        loggedIn={!!session}
        mySignup={mySignup}
        editOpen={editOpen}
        hasVerifiedAccount={hasVerifiedAccount}
        windowOpen={window.open}
        windowReason={window.reason}
        feeText={feeLabel(event)}
        signupClosesAt={event.signupDeadline ?? event.startDate}
      />
      )}
      {rulesFacts && <EventRulesCard facts={rulesFacts} defaultOpen={showRules} />}
      {showStatsLink && !curtain && !isEventEnded(event) && (
        <ClanLink
          href={`/events/${id}/stats`}
          className="mb-6 flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-gold/40 transition-colors"
        >
          <span className="text-xl leading-none" aria-hidden>📊</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Live event stats</span>
            <span className="block text-sm text-text-muted">Drops, deaths, XP and tiles per player — by day and hour by hour.</span>
          </span>
          <span className="text-sm text-gold shrink-0">Open →</span>
        </ClanLink>
      )}
      {canModerateChat && (
        <ClanLink
          href={`/events/${id}/chat`}
          className="mb-6 flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-gold/40 transition-colors"
        >
          <span className="text-xl leading-none" aria-hidden>🛡️</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Moderate event chat</span>
            <span className="block text-sm text-text-muted">Staff only: delete messages, time out or ban players, pause the chat.</span>
          </span>
          <span className="text-sm text-gold shrink-0">Open →</span>
        </ClanLink>
      )}
      {/* Post-event actions — one quiet card that folds in whichever of the recap / survey CTAs apply,
          rather than two stacked gold banners shouting the same "event ended" note twice. */}
      {(showRecapCta || showSurveyCta) && (
        <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex items-center gap-3">
            <span className="text-xl leading-none" aria-hidden>🏁</span>
            <div className="min-w-0">
              <p className="font-semibold">This event has ended</p>
              <p className="text-sm text-text-muted">
                {showRecapCta && showSurveyCta
                  ? 'See who took home the awards, then let the hosts know how it went.'
                  : showRecapCta
                    ? 'See who took home MVP, the biggest drop, the most kills, and more.'
                    : 'Take a moment to share your feedback with the hosts.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {showRecapCta && (
              <ClanLink
                href={`/events/${id}/recap`}
                className="text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors"
              >
                🏆 See the recap →
              </ClanLink>
            )}
            {showRecapCta && (
              <ClanLink
                href={`/events/${id}/wrapped`}
                className="text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors"
              >
                🎁 Your Wrapped card →
              </ClanLink>
            )}
            {showStatsLink && (
              <ClanLink
                href={`/events/${id}/stats`}
                className="text-sm font-medium text-text-muted border border-card-border px-4 py-2 rounded-lg hover:text-gold hover:border-gold/30 transition-colors"
              >
                📊 Event stats →
              </ClanLink>
            )}
            {showSurveyCta && (
              <ClanLink
                href={`/events/${id}/survey`}
                className="text-sm font-medium text-text-muted border border-card-border px-4 py-2 rounded-lg hover:text-gold hover:border-gold/30 transition-colors"
              >
                Fill out the survey →
              </ClanLink>
            )}
          </div>
        </div>
      )}
      {hideBoardFromPlayer ? (
        window.reason === 'not_open_yet' ? (
          <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
            <p className="text-lg font-semibold mb-1">The board is hidden until sign-ups open</p>
            {event.signupOpensAt && (
              <p className="text-sm">Opens {new Date(event.signupOpensAt).toLocaleString()}.</p>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
            <p className="text-lg font-semibold mb-1">The tiles haven&apos;t been revealed yet</p>
            <p className="text-sm">The host will unveil the board before the event begins. Check back soon.</p>
          </div>
        )
      ) : (
        <>
        {/* Who got it moving, and who drew first blood. Above the board because they're the part
            that stops being true the moment someone else claims one. */}
        {staffSeesCurtain && (
          <div className="mb-4 rounded-xl border border-gold/25 bg-gold/5 px-4 py-2.5 text-sm text-foreground/90">
            <span aria-hidden className="mr-1.5">👁</span>
            Standings are hidden from players
            {staffCurtainAt ? <> until <LocalTime date={staffCurtainAt} /></> : ' until the event ends'}
            <span className="text-text-muted"> — you see them because you&apos;re staff.</span>
          </div>
        )}
        <EventFirsts firsts={firsts} />
        <HighlightsStrip highlights={highlightStrip} canReport={canReport} />
        <MomentsFeed moments={eventMoments} streamLinks={momentStreamLinks} reactions={momentReactions} />
        <ScoreboardClient
          creator={isCreatorSpace(hostClan)}
          curtain={curtain}
          event={event}
          tiles={withSearchText(boardTiles)}
          lockedMissions={lockedMissionPreviews(eventTiles)}
          raceStandings={raceStandings}
          teams={safeTeams}
          completions={eventCompletions}
          tierBands={tierBands}
          mvp={mvp}
          mvpToday={mvpToday}
          teamMvps={teamMvps}
          hiddenTileCount={hiddenTileCount}
          nextRevealAt={upcomingRevealAt}
          staffOnlyTileIds={staffOnlyTileIds}
          hiddenSchedule={hiddenSchedule}
          boardPointsTotal={pointsOnBoard}
          initialTileId={Number.isInteger(initialTileId) && initialTileId > 0 ? initialTileId : null}
          tileHighlights={tileHighlights}
          solo={soloBoard}
          manyTeams={manyTeamsBoard}
          teamMembers={teamMembers}
          myTeamIds={myTeamIds}
        />
        {luck && <EventLuck luck={luck} />}
        </>
      )}
      {/* A co-host clan's players can suggest tiles when the host opened that to everyone in it. */}
      {cohostSuggest && (
        <section className="mx-auto mt-8 max-w-3xl rounded-xl border border-card-border bg-card-bg p-5">
          <h2 className="mb-1 font-bold">Suggest a tile to {hostClan?.name ?? 'the host'}</h2>
          <p className="mb-3 text-sm text-text-muted">They decide what goes on the board.</p>
          <CohostTileSuggest eventId={event.id} hostName={hostClan?.name ?? 'the host'} />
        </section>
      )}
      {/* To Anvil staff, not the host (lib/platformReports). Signed-in viewers who don't run it. */}
      {canReport && (
        <div className="mt-8 flex justify-end">
          <ReportButton type="event" id={event.id} label="Report this event" />
        </div>
      )}
      {creatorEvent && !session && window.open && (
        // Viewers arrive from a stream and scroll the board first: the way in follows them down.
        <div className="sticky bottom-4 z-30 mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-card-bg-hover/95 py-3 pl-5 pr-3 shadow-[0_18px_44px_rgba(0,0,0,.55)] backdrop-blur">
          <div className="min-w-0 text-sm">
            <div className="text-base font-semibold">Watching on stream?</div>
            <div className="text-text-muted">Join in about a minute. Sign in with Discord.</div>
          </div>
          <ClanLink
            href={`/login?return=${encodeURIComponent(await clanHref(`/events/${event.id}`))}`}
            className="inline-flex min-h-12 items-center rounded-xl bg-[var(--sa)] px-6 text-base font-bold text-[var(--sa-ink)] transition-opacity hover:opacity-90"
          >
            Join
          </ClanLink>
        </div>
      )}
    </div>
  );
}

function SignupBanner({
  eventId,
  loggedIn,
  mySignup,
  editOpen,
  hasVerifiedAccount,
  windowOpen,
  windowReason,
  feeText,
  signupClosesAt,
  signupReturn,
}: {
  eventId: number;
  loggedIn: boolean;
  mySignup: { status: string } | null;
  editOpen: boolean;
  hasVerifiedAccount: boolean;
  windowOpen: boolean;
  windowReason: string | null;
  /** The fee(s) in words — lib/entryFeeMath feeLabel. Null = free. */
  feeText: string | null;
  /** Explicit deadline when set; otherwise the event start is the final sign-up cutoff. */
  signupClosesAt: string | null;
  /** Where login should come back to — clan-prefixed, because `/login` is on the apex. */
  signupReturn: string;
}) {
  // Don't show anything once the event is underway and the viewer isn't already signed up —
  // the banner is just noise at that point.
  if (windowReason === 'event_started' && !mySignup) return null;

  const isActiveSignup = mySignup && mySignup.status !== 'withdrawn';

  // The "you're signed up" banner is only meaningful while the sign-up is genuinely active. Once an
  // existing sign-up can no longer be edited (past the pay/sign-up deadline), hide it entirely —
  // a stale "edit your details" note over a live, locked event is just noise.
  if (isActiveSignup && !editOpen) return null;

  let title: string;
  let body: string;
  let ctaLabel: string | null = '/events/' + eventId + '/signup';
  let ctaText: string;
  let tone: 'info' | 'success' | 'muted' = 'info';

  if (isActiveSignup) {
    title = mySignup.status === 'approved' ? "You're in" : 'Sign-up received';
    body =
      mySignup.status === 'approved'
        ? 'You can change your details until the deadline.'
        : 'The hosts still need to approve it. You can change your details until the deadline.';
    ctaText = 'Manage sign-up';
    tone = 'success';
  } else if (!windowOpen) {
    title = windowReason === 'closed' ? 'Sign-ups closed' : 'Sign-ups not open yet';
    body =
      windowReason === 'closed'
        ? 'The deadline has passed.'
        : 'Check back when the window opens.';
    ctaLabel = null;
    ctaText = '';
    tone = 'muted';
  } else if (!loggedIn) {
    title = 'Sign-ups are open';
    body = feeText ? `Sign-up fee: ${feeText}.` : 'No sign-up fee.';
    ctaText = 'Sign in to sign up';
    // Prefixed. `/login` is a platform path so ClanLink leaves it alone — which is right, and is
    // also why the return inside it has to arrive already carrying the clan.
    ctaLabel = `/login?return=${encodeURIComponent(signupReturn)}`;
  } else if (!hasVerifiedAccount) {
    // The sign-up page links a character in place now, so send them there rather than to /profile,
    // which never brought them back.
    title = 'Sign-ups are open';
    body = 'First, link your RuneScape character — it takes a minute and the sign-up page walks you through it.';
    ctaText = 'Sign up';
  } else {
    title = 'Sign-ups are open';
    body = feeText ? `Sign-up fee: ${feeText}.` : 'No sign-up fee.';
    ctaText = 'Sign up';
  }

  const toneCls =
    tone === 'success'
      ? 'border-accent-green/30 bg-accent-green/10'
      : tone === 'muted'
        ? 'border-card-border bg-brown-dark'
        : 'border-gold/30 bg-gold/10';

  return (
    <div className={`mb-6 rounded-xl border p-4 flex items-center justify-between gap-4 ${toneCls}`}>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-text-muted">{body}</div>
        {signupClosesAt && windowReason !== 'event_started' && (
          <div className="text-xs text-text-muted mt-1">
            Sign-ups {windowReason === 'closed' ? 'closed' : 'close'} at{' '}
            <LocalTime date={signupClosesAt} />.
          </div>
        )}
      </div>
      {ctaLabel && (
        <ClanLink
          href={ctaLabel}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors shrink-0"
        >
          {ctaText}
        </ClanLink>
      )}
    </div>
  );
}
