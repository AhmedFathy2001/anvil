import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, eventParticipants, submissions, tiles } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireTeamManager } from '@/lib/teamStaff';

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

  const event = await db.query.events.findFirst({ where: eq(events.id, management.eventId) });
  const started = !!event?.startDate && event.startDate <= new Date().toISOString();

  const roster = await db
    .select({
      playerId: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      pickNumber: eventParticipants.pickNumber,
      frozenAt: eventParticipants.frozenAt,
      rsn: clanMembers.rsn,
      lastSeen: clanMembers.liveStatsAt,
    })
    .from(eventParticipants)
    .leftJoin(clanMembers, eq(eventParticipants.clanMemberId, clanMembers.id))
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

  return NextResponse.json({
    teamId: tId,
    eventId: management.eventId,
    eventStarted: started,
    isCaptain: management.isCaptain,
    isStaff: management.isStaff,
    roster,
    proof: proof.map((p) => ({
      ...p,
      tileLabel: tileLabel.get(p.tileId) ?? 'Tile',
      by: nameByPlayer.get(p.creditPlayerId ?? p.playerId ?? -1) ?? null,
    })),
  });
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
