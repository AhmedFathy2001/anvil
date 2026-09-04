import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { requireEventForPage } from '@/lib/eventScope';
import { events, tiles, teams, completions, eventSignups, clanRoster, players, submissions, surveyQuestions, surveyResponses, eventStartProofs, eventParticipants } from '@/db/schema';
import { and, eq, isNull, inArray, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ScoreboardClient from './ScoreboardClient';
import { verifyUser } from '@/lib/auth';
import { signupWindowState, signupEditState } from '@/lib/signup';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
import { placementAmounts } from '@/lib/payouts';
import EventHero from '@/components/EventHero';
import StartProofCard from '@/components/StartProofCard';
import { startProofState } from '@/lib/startProof';
import EventFirsts from '@/components/events/EventFirsts';
import { loadEventFirsts } from '@/lib/eventFirsts';
import MomentsFeed from '@/components/MomentsFeed';
import { momentsForEvent } from '@/lib/momentsStore';
import { isPointsMode, eventShapeBadge } from '@/lib/utils';
import { eventAxes } from '@/lib/eventAxes';
import {
  parseEventRules,
  hasRevealPolicy,
  visibleTiles,
  isTileRevealed,
  nextRevealAt,
  rotationExpiries,
  boardTiles as scoredBoardTiles,
} from '@/lib/eventRules';
import { deriveTileIcon } from '@/lib/tileIcons';
import { buildLadderView } from '@/lib/ladderView';
import LadderClient from './LadderClient';
import { getTierBands } from '@/lib/pluginConfig';
import { computeEventMvp, computeMemberBreakdown, topMember, rollupByOwner, type StatGainMap, type TeamMvp } from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';
import { canEnterEvent } from '@/lib/eventAccess';
import EnterEvent from './EnterEvent';

export const dynamic = 'force-dynamic';

export default async function EventScoreboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const clan = await requireClan();
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  const tierBands = await getTierBands(clan.id);

  const tileIds = eventTiles.map((t) => t.id);
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
      .filter((c) => tileIdSet.has(c.tileId))
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
          amount: submissions.amount,
        })
        .from(submissions)
        .where(inArray(submissions.tileId, tileIds))
    : [];
  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, id));
  // Multi-account: owner per player + slot mode, so 'per-person' events rank the MVP by person.
  const ownerByPlayerId = await loadPlayerOwners(eventPlayers);
  const accountSlotMode = event.accountSlotMode;
  // Per skill/boss tile, each player's XP/KC gain — so stat tiles count toward the MVP too.
  const statStandings = await getStatStandings(id);
  const statGains: StatGainMap = {};
  for (const s of statStandings) {
    statGains[s.tileId] = s.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
  }
  const mvp = computeEventMvp({
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

  // MVP of the day — the same split, but scored only over tiles completed in the last 24h. The
  // completedAt filter is all it needs (computeEventMvp ignores completion timestamps); stat tiles
  // still count via their total gain. Null when nothing was completed in the window.
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const mvpTodayRaw = computeEventMvp({
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
  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
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
  const firsts = await loadEventFirsts(event.id);
  // The week's colour: pets, big drops and deaths that happened while the board ran. Scoped at
  // ingest (lib/moments), so this is a plain read — and never any part of the scoring.
  const eventMoments = await momentsForEvent(event.id, 12);
  const boardTiles = visibleTiles(rules, eventTiles);
  const hiddenTileCount = hasRevealPolicy(rules) ? eventTiles.length - visibleTiles(rules, eventTiles).length : 0;
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
          .filter((t) => !isTileRevealed(rules, t))
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

  const approvedCount = await countApprovedSignups(id);
  const prizePool = computePrizePool({
    addedPrizePool: event.addedPrizePool,
    signupFee: event.signupFee,
    approvedCount,
  });

  // Hero props: shape/points badge and the advertised prize-per-placement structure (public).
  const pointsMode = isPointsMode(event.scoringMode);
  // Missions are excluded: they're a bonus dropped mid-event from their own pool, so counting them
  // here would move the advertised board total the moment one is announced (see lib/eventRules).
  const requiredTiles = scoredBoardTiles(eventTiles).filter((t) => !t.optional);
  const pointsOnBoard = pointsMode
    ? requiredTiles.reduce((sum, t) => sum + (t.points ?? 0), 0)
    : null;
  // Resolved against the LIVE pool, so a board whose prizes are set as shares advertises what each
  // place is worth right now rather than what it was worth when the host typed it in.
  const placementPrizes = placementAmounts(event, prizePool);

  const prizeBreakdownParts: string[] = [];
  if ((event.signupFee ?? 0) > 0) {
    prizeBreakdownParts.push(
      `${approvedCount} ${approvedCount === 1 ? 'entry' : 'entries'} × ${event.signupFee!.toLocaleString()} gp`,
    );
  }
  if ((event.addedPrizePool ?? 0) > 0) {
    prizeBreakdownParts.push(`${event.addedPrizePool!.toLocaleString()} gp added`);
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
        shapeBadge={eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
        hiddenTileCount={hiddenTileCount}
        nextRevealAt={upcomingRevealAt}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdownParts.length ? prizeBreakdownParts.join('  +  ') : null}
        placementPrizes={placementPrizes}
        expiryByTile={Object.fromEntries(expiries)}
        showTeam={ladderHasTeams}
        poolSize={scoredBoardTiles(eventTiles).length}
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

  return (
    <>
      <EventHero
        name={event.name}
        shapeBadge={eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
        pointsOnBoard={pointsOnBoard}
        teamsCount={safeTeams.length}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdownParts.length ? prizeBreakdownParts.join('  +  ') : null}
        startDate={event.startDate}
        endDate={event.endDate}
        forceEndedAt={event.forceEndedAt}
        placementPrizes={placementPrizes}
      />
      {myStartProofs.length > 0 && (
        <section className="mb-6">
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
      {isOutsider ? (
        <EnterEvent eventId={event.id} signupFee={event.signupFee} />
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
        signupFee={event.signupFee}
      />
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
        <EventFirsts firsts={firsts} />
        <MomentsFeed moments={eventMoments} />
        <ScoreboardClient
          event={event}
          tiles={boardTiles}
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
        />
        </>
      )}
    </>
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
  signupFee,
  signupReturn,
}: {
  eventId: number;
  loggedIn: boolean;
  mySignup: { status: string } | null;
  editOpen: boolean;
  hasVerifiedAccount: boolean;
  windowOpen: boolean;
  windowReason: string | null;
  signupFee: number | null;
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
    title = "You're signed up";
    body = 'Edit your details before the deadline.';
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
    body = signupFee ? `Sign-up fee: ${signupFee.toLocaleString()} gp.` : 'Free to enter.';
    ctaText = 'Log in to sign up';
    // Prefixed. `/login` is a platform path so ClanLink leaves it alone — which is right, and is
    // also why the return inside it has to arrive already carrying the clan.
    ctaLabel = `/login?return=${encodeURIComponent(signupReturn)}`;
  } else if (!hasVerifiedAccount) {
    title = 'Verify an RSN to sign up';
    body = 'You need at least one verified RuneScape account before you can join.';
    ctaText = 'Go to profile';
    ctaLabel = '/profile';
  } else {
    title = 'Sign-ups are open';
    body = signupFee ? `Sign-up fee: ${signupFee.toLocaleString()} gp.` : 'Free to enter.';
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
