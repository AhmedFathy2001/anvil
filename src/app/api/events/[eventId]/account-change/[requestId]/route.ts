import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accountChangeRequests } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { decideAccountChange } from '@/lib/accountChangeRequests';
import { eventForRequest } from '@/lib/eventScope';
import { assertEventEditable } from '@/lib/eventLock';
import { canDecide } from '../route';

/**
 * Answering one.
 *
 * WHO MAY is the whole question, and it is lib/accountChangeRules: a clan that collects its members'
 * fees answers its own people, a clan whose members paid into the host's pot does not, and a board
 * may override either way. `canDecide` applies it to this participant.
 *
 * Approving performs the repoint through the same `swapTrackedAccount` the approver could already
 * have run by hand — which re-checks that both seats belong to one person, so a request that went
 * stale between asking and answering fails here rather than moving somebody else's character.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; requestId: string }> },
) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const { eventId: rawEvent, requestId: rawRequest } = await params;
  const eventId = Number(rawEvent);
  const requestId = Number(rawRequest);
  if (!Number.isFinite(eventId) || !Number.isFinite(requestId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The event has to be this clan's — the same tie every other event route makes, and what stops an
  // admin of one clan answering another's queue.
  const event = await eventForRequest(request, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const req = await db.query.accountChangeRequests.findFirst({
    where: and(eq(accountChangeRequests.id, requestId), eq(accountChangeRequests.eventId, eventId)),
  });
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!(await canDecide(req.participantId, session.role))) {
    return NextResponse.json(
      { error: 'This one is not yours to answer — it is waiting on the other side.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
    note?: unknown;
  } | null;
  const decision = body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 });
  }

  // Only approving touches the board, so only approving is refused on a finished one. A stale
  // request on an ended event can still be tidied away with a no.
  if (decision === 'approved') {
    const locked = await assertEventEditable(eventId);
    if (locked) return locked;
  }

  const result = await decideAccountChange({
    requestId,
    actorUserId: session.userId,
    decision,
    note: typeof body?.note === 'string' ? body.note : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, changed: result.changed, rsn: result.rsn });
}
