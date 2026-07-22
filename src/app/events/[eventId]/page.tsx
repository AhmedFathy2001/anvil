import { db } from '@/db';
import { events, tiles, teams, completions, eventSignups, clanMembers, players, submissions, surveyQuestions, surveyResponses } from '@/db/schema';
import { and, eq, isNull, inArray, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ScoreboardClient from './ScoreboardClient';
import { verifyUser } from '@/lib/auth';
import { signupWindowState, signupEditState } from '@/lib/signup';
import { countApprovedSignups, computePrizePool } from '@/lib/prizePool';
import { parsePlacementPrizes } from '@/lib/payouts';
import EventHero from '@/components/EventHero';
import { isPointsMode, eventShapeBadge } from '@/lib/utils';
import { getTierBands } from '@/lib/pluginConfig';
import { computeEventMvp, computeMemberBreakdown, topMember, rollupByOwner, type StatGainMap, type TeamMvp } from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot, type StatContributionSnapshot } from '@/lib/statTracking';
import { isEventEnded } from '@/lib/survey';

export const dynamic = 'force-dynamic';

export default async function EventScoreboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  const tierBands = await getTierBands();

  const tileIds = eventTiles.map((t) => t.id);
  let eventCompletions: {
    id: number;
    teamId: number;
    tileId: number;
    completedAt: string;
    statContributions: StatContributionSnapshot | null;
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
  const eventPlayers = await db.select().from(players).where(eq(players.eventId, id));
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

    const verifiedCount = await db
      .select({ id: clanMembers.id })
      .from(clanMembers)
      .where(
        and(
          eq(clanMembers.userId, session.userId),
          isNull(clanMembers.leftAt),
        ),
      )
      .limit(1);
    hasVerifiedAccount = verifiedCount.length > 0;
  }

  // Hide the board from non-staff viewers when either (a) sign-ups haven't opened yet,
  // or (b) the host hasn't revealed the tiles. Staff (admin / treasurer / moderator)
  // always see it so they can finish configuring tiles ahead of the public launch.
  const isStaff = session?.role === 'admin' || session?.role === 'treasurer' || session?.role === 'moderator';
  const tilesHidden = !event.tilesRevealed;
  const hideBoardFromPlayer = !isStaff && (window.reason === 'not_open_yet' || tilesHidden);

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

  const approvedCount = await countApprovedSignups(id);
  const prizePool = computePrizePool({
    addedPrizePool: event.addedPrizePool,
    signupFee: event.signupFee,
    approvedCount,
  });

  // Hero props: shape/points badge and the advertised prize-per-placement structure (public).
  const pointsMode = isPointsMode(event.scoringMode);
  const requiredTiles = eventTiles.filter((t) => !t.optional);
  const pointsOnBoard = pointsMode
    ? requiredTiles.reduce((sum, t) => sum + (t.points ?? 0), 0)
    : null;
  const placementPrizes = parsePlacementPrizes(event.placementPrizes);

  const prizeBreakdownParts: string[] = [];
  if ((event.signupFee ?? 0) > 0) {
    prizeBreakdownParts.push(
      `${approvedCount} ${approvedCount === 1 ? 'entry' : 'entries'} × ${event.signupFee!.toLocaleString()} gp`,
    );
  }
  if ((event.addedPrizePool ?? 0) > 0) {
    prizeBreakdownParts.push(`${event.addedPrizePool!.toLocaleString()} gp added`);
  }

  return (
    <>
      <EventHero
        name={event.name}
        shapeBadge={eventShapeBadge(event.format, event.scoringMode, event.boardSize)}
        pointsOnBoard={pointsOnBoard}
        teamsCount={safeTeams.length}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdownParts.length ? prizeBreakdownParts.join('  +  ') : null}
        startDate={event.startDate}
        endDate={event.endDate}
        forceEndedAt={event.forceEndedAt}
        placementPrizes={placementPrizes}
      />
      <SignupBanner
        eventId={event.id}
        loggedIn={!!session}
        mySignup={mySignup}
        editOpen={editOpen}
        hasVerifiedAccount={hasVerifiedAccount}
        windowOpen={window.open}
        windowReason={window.reason}
        signupFee={event.signupFee}
      />
      {showSurveyCta && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-gold">This event has ended — how did it go?</p>
            <p className="text-sm text-text-muted">Take a moment to share your feedback with the hosts.</p>
          </div>
          <Link
            href={`/events/${id}/survey`}
            className="shrink-0 text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/30 transition-colors"
          >
            Fill out the survey →
          </Link>
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
        <ScoreboardClient
          event={event}
          tiles={eventTiles}
          teams={safeTeams}
          completions={eventCompletions}
          tierBands={tierBands}
          mvp={mvp}
          mvpToday={mvpToday}
          teamMvps={teamMvps}
        />
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
}: {
  eventId: number;
  loggedIn: boolean;
  mySignup: { status: string } | null;
  editOpen: boolean;
  hasVerifiedAccount: boolean;
  windowOpen: boolean;
  windowReason: string | null;
  signupFee: number | null;
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
    ctaLabel = `/login?return=/events/${eventId}/signup`;
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
        <Link
          href={ctaLabel}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors shrink-0"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}
