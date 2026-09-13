import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountChangeRequests, clanRoster, eventParticipants } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import {
  approverForParticipant,
  openRequestsForClan,
  requestAccountChange,
} from '@/lib/accountChangeRequests';
import { eventForRequest } from '@/lib/eventScope';
import { assertEventEditable } from '@/lib/eventLock';
import { resolveTeamManagement } from '@/lib/teamStaff';

/**
 * "Can I play this event on my other account?" — asking, and seeing what has been asked.
 *
 * THE ASKING IS THE WHOLE POINT. Both repoint routes already existed; neither could be reached by
 * the person it is about, so the request went to Discord and the answer was somebody remembering.
 *
 * Nothing here decides anything. Filing checks only that the player owns both sides of the swap;
 * who may ANSWER is lib/accountChangeRules, applied by the PATCH in ./[requestId].
 */

/**
 * What this viewer needs to see: their own open request and the characters they could ask for, plus
 * anything waiting on them as an approver.
 *
 * One endpoint rather than two because the two audiences overlap — a co-host's moderator is usually
 * also playing, and they should not have to load two screens to see both halves of their own
 * situation.
 */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Their own participation, and their own characters — the seats a request may name.
  const mySeats = session.playerId == null
    ? []
    // clan-scope: global -- a person's characters span clans by design; every row is their own.
    : await db
        .select()
        .from(clanRoster)
        .where(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)));

  const mySeatIds = mySeats.map((s) => s.id);
  const myParticipant = mySeatIds.length
    ? await db.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, eventId),
          inArray(eventParticipants.clanMemberId, mySeatIds),
        ),
      })
    : null;

  const myOpen = myParticipant
    ? await db.query.accountChangeRequests.findFirst({
        where: and(
          eq(accountChangeRequests.participantId, myParticipant.id),
          eq(accountChangeRequests.status, 'pending'),
        ),
      })
    : null;

  // One entry per ACCOUNT, not per seat: clan_roster is (account × clan), so a character in two
  // clans is two rows and would otherwise be offered twice under one name.
  const byAccount = new Map<number, (typeof mySeats)[number]>();
  for (const seat of mySeats) {
    if (seat.accountId == null) continue;
    const held = byAccount.get(seat.accountId);
    if (!held || seat.id === myParticipant?.clanMemberId) byAccount.set(seat.accountId, seat);
  }
  const options = [...byAccount.values()]
    .filter((s) => s.id !== myParticipant?.clanMemberId)
    .map((s) => ({ clanMemberId: s.id, rsn: s.rsn }));

  const toDecide = atLeast(session.role, 'moderator')
    ? (await openRequestsForClan(event.clanId)).filter((r) => r.eventId === eventId)
    : [];

  return NextResponse.json({
    me: myParticipant
      ? {
          participantId: myParticipant.id,
          playingAs: myParticipant.name,
          open: myOpen ? { id: myOpen.id, note: myOpen.note, createdAt: myOpen.createdAt } : null,
          options,
        }
      : null,
    toDecide,
  });
}

/** File one. The player asks; nothing moves until somebody answers. */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session?.userId || session.playerId == null) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // A finished board's results are recorded; re-pointing a row would move them. The same refusal
  // the by-hand repoint makes, made here so the player is told before they ask rather than after.
  const locked = await assertEventEditable(eventId);
  if (locked) return locked;

  const body = (await request.json().catch(() => null)) as {
    participantId?: unknown;
    clanMemberId?: unknown;
    note?: unknown;
  } | null;
  const participantId = Number(body?.participantId);
  const toSeatId = Number(body?.clanMemberId);
  if (!Number.isFinite(participantId) || !Number.isFinite(toSeatId)) {
    return NextResponse.json({ error: 'participantId and clanMemberId are required' }, { status: 400 });
  }

  const participant = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)),
  });
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await requestAccountChange({
    participantId,
    userId: session.userId,
    playerId: session.playerId,
    toSeatId,
    note: typeof body?.note === 'string' ? body.note : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const routing = await approverForParticipant(participantId);
  return NextResponse.json({ ok: true, id: result.id, approver: routing?.approver ?? 'host' });
}

/** Take it back. Only the person who asked, and only while it is still waiting. */
export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const eventId = Number((await params).eventId);
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const req = await db.query.accountChangeRequests.findFirst({
    where: and(eq(accountChangeRequests.id, id), eq(accountChangeRequests.eventId, eventId)),
  });
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.requestedByUserId !== session.userId) {
    return NextResponse.json({ error: 'That is not your request' }, { status: 403 });
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: `That request was already ${req.status}.` }, { status: 409 });
  }

  await db
    .update(accountChangeRequests)
    .set({ status: 'withdrawn', decidedAt: new Date().toISOString() })
    .where(eq(accountChangeRequests.id, id));
  return NextResponse.json({ ok: true });
}

/** Exported for the decision route, which asks the same question about the same participant. */
export async function canDecide(participantId: number, role: string): Promise<boolean> {
  const routing = await approverForParticipant(participantId);
  if (!routing) return false;
  if (routing.approver === 'host') return atLeast(role, 'moderator');
  const participant = await db.query.eventParticipants.findFirst({
    where: eq(eventParticipants.id, participantId),
  });
  if (participant?.teamId == null) return false;
  const management = await resolveTeamManagement(participant.teamId);
  return !!management?.canManage;
}
