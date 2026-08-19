import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { closeOutEventFees } from '@/lib/feeConfirmations';
import { eventStage } from '@/lib/eventStage';

/**
 * Close a finished event's fee ledger (see lib/feeConfirmations#closeOutEventFees).
 *
 * Admin only — this writes money off, which is a host decision, not a treasurer or moderator one.
 * And only once the event is over: while a board is still running an unpaid fee is a debt someone
 * is chasing, so there is nothing to close.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { eventId?: unknown } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (eventStage(event, new Date().getTime()) !== 'wrap') {
    return NextResponse.json(
      { error: 'This event is still running — fees can only be closed out once it has ended.' },
      { status: 409 },
    );
  }

  const result = await closeOutEventFees(eventId, session.userId);

  db.insert(clanAuditLog)
    .values({
      eventType: 'fees_closed_out',
      newValue: JSON.stringify({ eventId, ...result }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  return NextResponse.json(result);
}
