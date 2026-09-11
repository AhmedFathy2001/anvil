import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventParticipants } from '@/db/schema';
import { requireTeamManager } from '@/lib/teamStaff';
import { swapTrackedAccount } from '@/lib/trackedAccount';
import { assertEventEditable } from '@/lib/eventLock';

/**
 * Which character one of your own players is being followed on.
 *
 * DELEGATED TEAMS ONLY. On a clan-vs-clan board a team IS a clan (teams.clanId) and the people
 * running it are that clan's own staff, administering their own members — so "he's on his alt now"
 * is theirs to answer, and asking the opposing clan's admin to do it is absurd. A drafted team's
 * captain is a different creature: a player picked to pick, running a side drawn from several
 * clans on somebody else's board. There it stays with the host, who is the only party with
 * authority over everybody on it.
 *
 * THREE THINGS THIS CANNOT DO, and they are what make it safe to delegate:
 *
 *   - reach another team. The player must be on theirs.
 *   - reach another person. `samePersonOnly` refuses any seat belonging to a different human, so
 *     this cannot be used to put somebody else's character on your team.
 *   - reach another clan's seats. Only their own clan's, so a manager cannot move one of their
 *     players onto a seat in the host clan (or a third co-host) and take them off their own roster
 *     sideways.
 *
 * Allowed mid-event, like the admin path, because that is precisely when it is needed — the
 * baseline is re-anchored to the new character and gains carry on from there. A FINISHED event is
 * refused: its results are recorded, and re-pointing a row would move them.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  if (!management.delegated || management.teamClanId == null) {
    return NextResponse.json(
      { error: 'Only a clan running its own team can change which account a player is tracked on.' },
      { status: 403 },
    );
  }

  const locked = await assertEventEditable(management.eventId);
  if (locked) return locked;

  const body = (await request.json().catch(() => null)) as {
    playerId?: unknown;
    clanMemberId?: unknown;
  } | null;
  const playerId = Number(body?.playerId);
  const toSeatId = Number(body?.clanMemberId);
  if (!Number.isFinite(playerId) || !Number.isFinite(toSeatId)) {
    return NextResponse.json({ error: 'playerId and clanMemberId are required' }, { status: 400 });
  }

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, playerId), eq(eventParticipants.eventId, management.eventId)),
  });
  if (!player || player.teamId !== tId) {
    return NextResponse.json({ error: 'That player is not on your team' }, { status: 404 });
  }

  const swap = await swapTrackedAccount({
    player,
    eventId: management.eventId,
    toSeatId,
    // Their own clan's seats and nobody else's.
    allowedClanIds: [management.teamClanId],
    samePersonOnly: true,
  });
  if (!swap.ok) return NextResponse.json({ error: swap.error }, { status: swap.status });
  if (!swap.changed) return NextResponse.json({ ok: true, changed: false, rsn: swap.rsn });

  await db.update(eventParticipants).set(swap.updates!).where(eq(eventParticipants.id, player.id));
  return NextResponse.json({ ok: true, changed: true, rsn: swap.rsn });
}

/**
 * The characters this player could be followed on instead — their own, in this clan, one row each.
 *
 * Same shape as the admin endpoint and the same reason for folding: `clan_roster` is (account ×
 * clan), so listing seats showed one name once per clan that character is in.
 */
export async function GET(
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
  if (!management.delegated || management.teamClanId == null) {
    return NextResponse.json({ accounts: [] });
  }

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, playerId), eq(eventParticipants.eventId, management.eventId)),
  });
  if (!player || player.teamId !== tId) {
    return NextResponse.json({ error: 'That player is not on your team' }, { status: 404 });
  }

  const current = player.clanMemberId != null
    // clan-scope: global -- the id came from a row this request already established.
    ? await db.select().from(clanRoster).where(eq(clanRoster.id, player.clanMemberId)).limit(1).then((r) => r[0])
    : null;
  if (!current?.playerId) return NextResponse.json({ accounts: [] });

  const seats = await db
    .select()
    .from(clanRoster)
    .where(
      and(
        eq(clanRoster.playerId, current.playerId),
        inArray(clanRoster.clanId, [management.teamClanId]),
        isNull(clanRoster.leftAt),
      ),
    );

  const byAccount = new Map<number, (typeof seats)[number]>();
  for (const seat of seats) {
    if (seat.accountId == null) continue;
    const held = byAccount.get(seat.accountId);
    if (!held || seat.id === player.clanMemberId) byAccount.set(seat.accountId, seat);
  }

  const accounts = [...byAccount.values()]
    .map((m) => ({ clanMemberId: m.id, rsn: m.rsn, isCurrent: m.id === player.clanMemberId }))
    .sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.rsn.localeCompare(b.rsn)));

  return NextResponse.json({ accounts });
}
