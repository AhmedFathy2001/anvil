import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, events, eventParticipants, payouts, submissions, teams, tiles } from '@/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { requireTeamManager } from '@/lib/teamStaff';
import { enrolParticipant, participantForSeat } from '@/lib/participants';

/**
 * A team's own roster and its recent proof, for whoever runs that team.
 *
 * Both were admin-only surfaces, which is fine while one clan hosts its own event and useless the
 * moment half the roster belongs to a clan whose moderators have no account here. Everything is
 * filtered to this one team, server-side, on every read and write.
 *
 * The one thing a manager can't do here is sub someone out once the event is live — that rewrites
 * scoring history, so it stays with the host. Removing a player before the event starts is fine,
 * because nothing has been scored yet.
 */

const RECENT_PROOF = 40;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  // clan-scope: global -- the event this managed team belongs to, by id; a co-host team's event is the host clan's.
  const event = await db.query.events.findFirst({ where: eq(events.id, management.eventId) });
  const started = !!event?.startDate && event.startDate <= new Date().toISOString();

  const roster = await db
    .select({
      playerId: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      pickNumber: eventParticipants.pickNumber,
      frozenAt: eventParticipants.frozenAt,
      rsn: clanRoster.rsn,
      lastSeen: clanRoster.liveStatsAt,
    })
    .from(eventParticipants)
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(eventParticipants.eventId, management.eventId), eq(eventParticipants.teamId, tId)));

  // Their team's proof: the submissions their own players made, newest first, with the screenshot.
  const eventTiles = await db
    .select({ id: tiles.id, label: tiles.label })
    .from(tiles)
    .where(eq(tiles.eventId, management.eventId));
  const tileLabel = new Map(eventTiles.map((t) => [t.id, t.label]));
  const proof = eventTiles.length
    ? await db
        .select({
          id: submissions.id,
          tileId: submissions.tileId,
          playerId: submissions.playerId,
          creditPlayerId: submissions.creditPlayerId,
          amount: submissions.amount,
          imageUrl: submissions.imageUrl,
          note: submissions.note,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.teamId, tId),
            inArray(submissions.tileId, eventTiles.map((t) => t.id)),
          ),
        )
        .orderBy(desc(submissions.createdAt))
        .limit(RECENT_PROOF)
    : [];

  const nameByPlayer = new Map(roster.map((r) => [r.playerId, r.name]));

  // This team's winnings — shown so a co-host can settle its own under `each-settles` (the pay button
  // is gated to that policy, server-side, in the pay route).
  const teamPayouts = await db
    .select({ id: payouts.id, rsn: payouts.rsn, place: payouts.place, amount: payouts.amount, status: payouts.status })
    .from(payouts)
    .where(and(eq(payouts.eventId, management.eventId), eq(payouts.teamId, tId)));

  return NextResponse.json({
    teamId: tId,
    eventId: management.eventId,
    eventStarted: started,
    isCaptain: management.isCaptain,
    isStaff: management.isStaff,
    cashPolicy: event?.cashPolicy ?? 'host-holds',
    payouts: teamPayouts,
    roster,
    proof: proof.map((p) => ({
      ...p,
      tileLabel: tileLabel.get(p.tileId) ?? 'Tile',
      by: nameByPlayer.get(p.creditPlayerId ?? p.playerId ?? -1) ?? null,
    })),
  });
}

/**
 * Add one of your OWN clan's members to this team.
 *
 * This is how a co-host fills its side of a board: the team is tagged with a clan (teams.clanId, set
 * when the co-host was provisioned), and its manager may add members of THAT clan to it — never
 * anyone else's, and never onto a host team (whose roster comes from sign-ups / the draft). Pre-start
 * only, for the same reason as removal: adding after the whistle is a sub-in, which rewrites scoring
 * and stays with the host.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) return NextResponse.json({ error: 'No such team' }, { status: 404 });
  // Only a clan-tagged (co-host) team fills itself. A host team's roster is sign-ups + the draft.
  if (team.clanId == null) {
    return NextResponse.json({ error: 'This team is filled from sign-ups and the draft, not here.' }, { status: 400 });
  }

  // clan-scope: global -- the event this managed team belongs to, by id; a co-host team's event is the host clan's.
  const event = await db.query.events.findFirst({ where: eq(events.id, management.eventId) });
  if (event?.startDate && event.startDate <= new Date().toISOString()) {
    return NextResponse.json({ error: 'The event has started — ask the host to sub someone in.' }, { status: 409 });
  }
  if (event?.draftStatus === 'active' || event?.draftStatus === 'paused') {
    return NextResponse.json({ error: 'The draft is running — rosters are the draft’s to change right now.' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const clanMemberId = Number(body?.clanMemberId);
  if (!Number.isInteger(clanMemberId)) return NextResponse.json({ error: 'clanMemberId is required' }, { status: 400 });

  // The seat must belong to THIS team's clan and be live — you may only add your own members.
  const seat = await db
    .select({ id: clanRoster.id, accountId: clanRoster.accountId, rsn: clanRoster.rsn })
    .from(clanRoster)
    .where(and(eq(clanRoster.id, clanMemberId), eq(clanRoster.clanId, team.clanId), isNull(clanRoster.leftAt)))
    .then((r) => r[0]);
  if (!seat) return NextResponse.json({ error: 'That member is not on your clan’s roster.' }, { status: 400 });

  // One participant per ACCOUNT per event. Reuse an existing row (move it onto this team) rather
  // than making a second — a person cannot be on the board twice.
  //
  // By account rather than by seat, because this is exactly where the two diverge: a co-host fills
  // its team from its OWN roster, while the same player entering the event themselves is seated as a
  // guest of the host clan. Two seats, one person. Asking by seat found neither and made a second
  // row. See lib/participants.
  const existing = await participantForSeat(management.eventId, clanMemberId);
  if (existing) {
    if (existing.teamId === tId) return NextResponse.json({ ok: true, playerId: existing.id, already: true });
    if (existing.teamId != null) {
      return NextResponse.json({ error: 'They are already on another team in this event.' }, { status: 409 });
    }
    await db.update(eventParticipants).set({ teamId: tId }).where(eq(eventParticipants.id, existing.id));
    return NextResponse.json({ ok: true, playerId: existing.id });
  }

  const { row, created } = await enrolParticipant({
    eventId: management.eventId,
    clanMemberId,
    accountId: seat.accountId,
    name: seat.rsn,
    teamId: tId,
  });
  return NextResponse.json({ ok: true, playerId: row.id, already: !created });
}

/**
 * Take someone off this team.
 *
 * Pre-start only. Once an event is live, removing a player unpicks completions and voids
 * submissions — that's the sub-out flow, and it stays with the host by explicit decision.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  const playerId = Number(new URL(request.url).searchParams.get('playerId'));
  if (!Number.isFinite(tId) || !Number.isFinite(playerId)) {
    return NextResponse.json({ error: 'teamId and playerId are required' }, { status: 400 });
  }

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  // clan-scope: global -- the event this managed team belongs to, by id; a co-host team's event is the host clan's.
  const event = await db.query.events.findFirst({ where: eq(events.id, management.eventId) });
  if (event?.startDate && event.startDate <= new Date().toISOString()) {
    return NextResponse.json(
      { error: 'The event has started — ask an admin to sub them out, which keeps their scoring history straight.' },
      { status: 409 },
    );
  }
  if (event?.draftStatus === 'active' || event?.draftStatus === 'paused') {
    return NextResponse.json({ error: 'The draft is running — rosters are the draft’s to change right now.' }, { status: 409 });
  }

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, playerId), eq(eventParticipants.eventId, management.eventId)),
  });
  if (!player || player.teamId !== tId) {
    return NextResponse.json({ error: 'That player is not on your team' }, { status: 404 });
  }

  // Back to the pool rather than deleted: the host may still want them in the event, and the
  // enrollment (and their sign-up) is not a manager's to destroy.
  await db
    .update(eventParticipants)
    .set({ teamId: null, pickNumber: null, pickedAt: null })
    .where(eq(eventParticipants.id, playerId));

  return NextResponse.json({ ok: true });
}
