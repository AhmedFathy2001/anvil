import { db } from '@/db';
import { events, teams, players, clanMembers, eventSignups, signupFees, eventStartProofs, teamStaff } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LocalTime from '@/components/LocalTime';
import { verifyUser } from '@/lib/auth';
import { isTileRaceFormat } from '@/lib/utils';
import { parseEventRules } from '@/lib/eventRules';
import { startProofState } from '@/lib/startProof';
import StartProofCard from '@/components/StartProofCard';

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
};

export default async function MyTeamsHubPage() {
  const user = await verifyUser();
  if (!user) redirect('/login');

  // My roster identities → my drafted player rows → teams I play on.
  const myMembers = await db
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, user.userId), isNull(clanMembers.leftAt)));
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
    const playerRows = await db
      .select({
        playerId: players.id,
        playerName: players.name,
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
      .from(players)
      .innerJoin(teams, eq(players.teamId, teams.id))
      .innerJoin(events, eq(players.eventId, events.id))
      .where(and(inArray(players.clanMemberId, memberIds), isNotNull(players.teamId)));
    for (const r of playerRows) add(r, 'player');
    myPlayerRows = playerRows;
  }

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
    .where(eq(teams.captainUserId, user.userId));
  for (const r of captainRows) add(r, 'captain');

  // Teams this user was given a staff seat on — typically a moderator from the other clan in a
  // clan-v-clan, who neither captains nor plays but has to run their own half.
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
    .where(eq(teamStaff.userId, user.userId));
  for (const r of staffRows) add(r, 'staff');

  const now = new Date().toISOString();
  const all = [...involvements.values()];
  const isPast = (i: Involvement) => !!i.forceEndedAt || (!!i.endDate && i.endDate < now);
  const activeTeams = all.filter((i) => !isPast(i));
  const pastTeams = all.filter(isPast);

  // My sign-ups + fee status (the pre-draft stage of the same journey).
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
    .where(eq(eventSignups.userId, user.userId));
  // Only surface sign-ups still worth acting on. Drop ended events, and — once an event has
  // started — drop fully-resolved sign-ups (approved, with the fee collected/confirmed or no fee),
  // since the "Sign-ups & fees" card is just clutter at that point.
  const activeSignups = signupRows.filter((s) => {
    if (s.forceEndedAt || (s.endDate && s.endDate < now)) return false;
    const started = s.startDate != null && s.startDate <= now;
    const feeResolved = !s.feeStatus || s.feeStatus === 'collected' || s.feeStatus === 'confirmed';
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
                <Link
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
                </Link>
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
    <Link
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
    </Link>
  );
}
