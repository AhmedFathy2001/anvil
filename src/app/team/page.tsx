import { db } from '@/db';
import { events, teams, eventParticipants, clanRoster, eventSignups, signupFees, eventStartProofs, teamStaff } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import LocalTime from '@/components/LocalTime';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { isTileRaceFormat } from '@/lib/utils';
import { parseEventRules } from '@/lib/eventRules';
import { startProofState } from '@/lib/startProof';
import StartProofCard from '@/components/StartProofCard';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

interface Involvement {
  teamId: number;
  teamName: string;
  teamColor: string;
  eventId: number;
  eventName: string;
  format: string;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  isCaptain: boolean;
  isPlayer: boolean;
  isStaff: boolean;
}

const FEE_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Fee due', cls: 'bg-yellow-500/15 text-yellow-300' },
  reported: { label: 'Payment reported', cls: 'bg-blue-500/15 text-blue-400' },
  collected: { label: 'Collected', cls: 'bg-blue-500/15 text-blue-400' },
  confirmed: { label: 'Paid', cls: 'bg-accent-green/15 text-accent-green-light' },
  disputed: { label: 'Disputed', cls: 'bg-red-500/15 text-red-400' },
  // The board ended with this one never paid, and the host wrote it off. Says so plainly rather
  // than leaving a "Fee due" nag on an event that's been over for months.
  closed: { label: 'Closed', cls: 'bg-text-muted/15 text-text-muted' },
};

export default async function MyTeamsHubPage() {
  const user = await verifyUser();
  if (!user) redirect('/login?return=/team');

  // WHICH EVENTS THIS PAGE MAY SHOW.
  //
  // The person is the subject — their seats span clans by design — but the page renders under ONE
  // clan's host and wears that clan's nav, so "my teams" has to mean "my teams here". Without this
  // filter it meant "my teams anywhere": /c/lfl/team listed The AFK Spot's July Bingo, an event LFL
  // has nothing to do with, directly under LFL's header.
  //
  // Belonging is ownership OR co-hosting, because a co-hosted board genuinely is this clan's too —
  // that is how "The AFK Spot VS LFL" correctly stays on LFL's page while the July board does not.
  // A team carries its clan in `teams.clanId`, which is the co-host tag rather than a scope.
  // `currentClan`, not `requireClan`: on the APEX no clan is named, and there "my teams" honestly
  // does mean everywhere — the same span /profile covers. Filtering only when a clan IS named keeps
  // that page working instead of 404ing a URL that used to load.
  const clan = await currentClan();
  let inThisClan = undefined as ReturnType<typeof inArray> | undefined;
  if (clan) {
    const [ownedRows, coHostRows] = await Promise.all([
      db.select({ id: events.id }).from(events).where(eq(events.clanId, clan.id)),
      db.select({ id: teams.eventId }).from(teams).where(eq(teams.clanId, clan.id)),
    ]);
    const clanEventIds = [...new Set([...ownedRows, ...coHostRows].map((r) => r.id))];
    // A clan with no events is the normal state of a new one, and `inArray` with an empty list is
    // not a portable "match nothing". An impossible id is, and it keeps the page on its ordinary
    // path so the existing empty state renders rather than a second one written for this branch.
    inThisClan = clanEventIds.length > 0 ? inArray(events.id, clanEventIds) : eq(events.id, -1);
  }

  // My roster identities → my drafted player rows → teams I play on.
  // clan-scope: this clan -- identities are the person's (they span clans), events are filtered to here.
  const myMembers = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.playerId), isNull(clanRoster.leftAt)));
  const memberIds = myMembers.map((m) => m.id);

  // Kept aside from the team-card fold: the starting-shot card needs the ENROLMENT (player row),
  // not the team, and a captain who isn't playing owes nothing.
  let myPlayerRows: {
    playerId: number;
    playerName: string;
    rules: string | null;
    startProofLocation: string | null;
    startProofDrawnAt: string | null;
    startProofX: number | null;
    startProofY: number | null;
    startProofRadius: number | null;
    eventId: number;
    eventName: string;
    endDate: string | null;
    forceEndedAt: string | null;
  }[] = [];

  const involvements = new Map<number, Involvement>();
  const add = (row: Omit<Involvement, 'isCaptain' | 'isPlayer' | 'isStaff'>, role: 'captain' | 'player' | 'staff') => {
    const existing = involvements.get(row.teamId);
    if (existing) {
      if (role === 'captain') existing.isCaptain = true;
      else if (role === 'staff') existing.isStaff = true;
      else existing.isPlayer = true;
    } else {
      involvements.set(row.teamId, {
        ...row,
        isCaptain: role === 'captain',
        isPlayer: role === 'player',
        isStaff: role === 'staff',
      });
    }
  };

  if (memberIds.length > 0) {
    // clan-scope: this clan -- see clanEventIds above.
    const playerRows = await db
      .select({
        playerId: eventParticipants.id,
        playerName: eventParticipants.name,
        rules: events.rules,
        startProofLocation: events.startProofLocation,
        startProofDrawnAt: events.startProofDrawnAt,
        startProofX: events.startProofX,
        startProofY: events.startProofY,
        startProofRadius: events.startProofRadius,
        teamId: teams.id,
        teamName: teams.name,
        teamColor: teams.color,
        eventId: events.id,
        eventName: events.name,
        format: events.format,
        startDate: events.startDate,
        endDate: events.endDate,
        forceEndedAt: events.forceEndedAt,
      })
      .from(eventParticipants)
      .innerJoin(teams, eq(eventParticipants.teamId, teams.id))
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .where(
        and(inArray(eventParticipants.clanMemberId, memberIds), isNotNull(eventParticipants.teamId), inThisClan),
      );
    for (const r of playerRows) add(r, 'player');
    myPlayerRows = playerRows;
  }

  // clan-scope: this clan -- see clanEventIds above.
  const captainRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamColor: teams.color,
      eventId: events.id,
      eventName: events.name,
      format: events.format,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(and(eq(teams.captainUserId, user.userId), inThisClan));
  for (const r of captainRows) add(r, 'captain');

  // Teams this user was given a staff seat on — typically a moderator from the other clan in a
  // clan-v-clan, who neither captains nor plays but has to run their own half.
  // clan-scope: this clan -- see clanEventIds above.
  const staffRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamColor: teams.color,
      eventId: events.id,
      eventName: events.name,
      format: events.format,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(teamStaff)
    .innerJoin(teams, eq(teamStaff.teamId, teams.id))
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(and(eq(teamStaff.userId, user.userId), inThisClan));
  for (const r of staffRows) add(r, 'staff');

  const now = new Date().toISOString();
  const all = [...involvements.values()];
  const isPast = (i: Involvement) => !!i.forceEndedAt || (!!i.endDate && i.endDate < now);
  const activeTeams = all.filter((i) => !isPast(i));
  const pastTeams = all.filter(isPast);

  // My sign-ups + fee status (the pre-draft stage of the same journey).
  // clan-scope: this clan -- see clanEventIds above.
  const signupRows = await db
    .select({
      signupId: eventSignups.id,
      status: eventSignups.status,
      eventId: events.id,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      feeStatus: signupFees.status,
      feeAmount: signupFees.amount,
    })
    .from(eventSignups)
    .innerJoin(events, eq(eventSignups.eventId, events.id))
    .leftJoin(signupFees, eq(signupFees.signupId, eventSignups.id))
    .where(and(eq(eventSignups.userId, user.userId), inThisClan));
  // Only surface sign-ups still worth acting on. Drop ended events, and — once an event has
  // started — drop fully-resolved sign-ups (approved, with the fee collected/confirmed or no fee),
  // since the "Sign-ups & fees" card is just clutter at that point.
  const activeSignups = signupRows.filter((s) => {
    if (s.forceEndedAt || (s.endDate && s.endDate < now)) return false;
    const started = s.startDate != null && s.startDate <= now;
    const feeResolved =
      !s.feeStatus || s.feeStatus === 'collected' || s.feeStatus === 'confirmed' || s.feeStatus === 'closed';
    if (started && s.status === 'approved' && feeResolved) return false;
    return true;
  });

  // STARTING SHOT (lib/startProof) — the one thing on this page that's genuinely time-critical, so
  // it sits above everything else. Only live enrolments on an event that has drawn, and only until
  // the shot is accepted.
  const liveEnrolments = myPlayerRows.filter(
    (r) => !r.forceEndedAt && (!r.endDate || r.endDate >= now) && r.startProofDrawnAt,
  );
  const startProofCards: {
    key: string;
    eventId: number;
    eventName: string;
    playerId: number;
    rsn: string;
    location: string;
    spot: { x: number; y: number; radius: number } | null;
    maxSessionMinutes: number;
    keyword: string;
    status: 'pending' | 'rejected' | null;
    reviewNote: string | null;
  }[] = [];
  if (liveEnrolments.length > 0) {
    const proofRows = await db
      .select()
      .from(eventStartProofs)
      .where(inArray(eventStartProofs.playerId, liveEnrolments.map((r) => r.playerId)));
    const byPlayer = new Map(proofRows.map((p) => [p.playerId, p]));
    for (const r of liveEnrolments) {
      const cfg = parseEventRules(r.rules).startProof;
      if (!cfg) continue;
      const proof = byPlayer.get(r.playerId);
      if (proof?.status === 'accepted') continue; // settled — nothing to nag about
      const state = startProofState({
        cfg,
        event: {
          id: r.eventId,
          startProofLocation: r.startProofLocation,
          startProofDrawnAt: r.startProofDrawnAt,
          startProofX: r.startProofX,
          startProofY: r.startProofY,
          startProofRadius: r.startProofRadius,
        },
        playerId: r.playerId,
        proof,
      });
      if (!state.location || !state.keyword) continue;
      // The ask lapses six hours after the start (lib/startProof): the game has force-logged
      // everyone by then, so there is no stack left to prove anything about. Stop nagging.
      if (!state.windowOpen) continue;
      startProofCards.push({
        key: `${r.eventId}-${r.playerId}`,
        eventId: r.eventId,
        eventName: r.eventName,
        playerId: r.playerId,
        rsn: r.playerName,
        location: state.location,
        spot: state.spot,
        maxSessionMinutes: state.maxSessionMinutes,
        keyword: state.keyword,
        status: (proof?.status as 'pending' | 'rejected' | undefined) ?? null,
        reviewNote: proof?.reviewNote ?? null,
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">My Teams</h1>
      <p className="text-text-muted text-sm mb-8">Your events, teams, sign-ups and fees in one place.</p>

      {startProofCards.length > 0 && (
        <section className="mb-10">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Before you play
          </h2>
          <div className="grid gap-3">
            {startProofCards.map((c) => (
              <StartProofCard
                key={c.key}
                eventId={c.eventId}
                eventName={c.eventName}
                playerId={c.playerId}
                rsn={c.rsn}
                location={c.location}
                spot={c.spot}
                maxSessionMinutes={c.maxSessionMinutes}
                keyword={c.keyword}
                status={c.status}
                reviewNote={c.reviewNote}
                pluginHint
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-accent-green rounded-full" />
          Active
        </h2>
        {activeTeams.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            You&apos;re not on a team for any active event yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeTeams.map((i) => (
              <TeamLink key={i.teamId} i={i} />
            ))}
          </div>
        )}
      </section>

      {activeSignups.length > 0 && (
        <section className="mb-10">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Sign-ups &amp; fees
          </h2>
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
            {activeSignups.map((s) => {
              const fee = s.feeStatus ? FEE_BADGE[s.feeStatus] : null;
              return (
                <ClanLink
                  key={s.signupId}
                  href={`/events/${s.eventId}/signup`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-card-bg-hover transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.eventName}</div>
                    <div className="text-xs text-text-muted capitalize">Sign-up: {s.status}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {fee && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${fee.cls}`}>{fee.label}</span>}
                    <span className="text-text-muted text-xs">→</span>
                  </div>
                </ClanLink>
              );
            })}
          </div>
        </section>
      )}

      {pastTeams.length > 0 && (
        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-text-muted rounded-full" />
            Past
            <span className="text-xs text-text-muted/60 font-normal">({pastTeams.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastTeams.map((i) => (
              <TeamLink key={i.teamId} i={i} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamLink({ i, past }: { i: Involvement; past?: boolean }) {
  return (
    <ClanLink
      href={`/team/${i.teamId}`}
      className={`block p-4 border rounded-xl transition-all ${
        past ? 'border-card-border/60 bg-card-bg/50 hover:border-gold/30' : 'border-card-border bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: i.teamColor }} />
          <span className={`font-semibold truncate ${past ? 'text-text-muted' : ''}`}>{i.teamName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {i.isCaptain && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">Captain</span>}
          {i.isStaff && !i.isCaptain && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">Staff</span>
          )}
          {i.isPlayer && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Player</span>}
        </div>
      </div>
      <div className="text-xs text-text-muted truncate">{i.eventName}</div>
      <div className="text-[10px] text-text-muted/70 mt-1 flex items-center gap-2">
        {isTileRaceFormat(i.format) && <span className="text-blue-400">Tile race</span>}
        {i.startDate && i.endDate && (
          <span>
            <LocalTime date={i.startDate} format="date" /> — <LocalTime date={i.endDate} format="date" />
          </span>
        )}
      </div>
    </ClanLink>
  );
}
