import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { payouts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { del } from '@/lib/storage';

// PATCH — edit an editable field on a payout row (amount, recipient name, notes).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; payoutId: string }> },
) {
  const { eventId, payoutId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const id = parseInt(payoutId, 10);
  if (!Number.isFinite(eId) || !Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  // Event-scoped: an admin, a clan treasurer, or this board's own treasurer.
  if (!(await verifyEventTreasurer(eId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payout = await db.query.payouts.findFirst({
    where: and(eq(payouts.id, id), eq(payouts.eventId, eId)),
  });
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    amount?: number;
    rsn?: string;
    notes?: string | null;
  } | null;

  const updateData: { amount?: number; rsn?: string; notes?: string | null } = {};

  if (body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });
    }
    updateData.amount = Math.round(amount);
  }
  if (body?.rsn !== undefined) {
    const rsn = String(body.rsn).trim();
    if (!rsn) return NextResponse.json({ error: 'Recipient name cannot be empty' }, { status: 400 });
    updateData.rsn = rsn;
  }
  if (body?.notes !== undefined) {
    updateData.notes = body.notes ? String(body.notes) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await db.update(payouts).set(updateData).where(eq(payouts.id, id)).returning();
  return NextResponse.json({ payout: updated });
}

// DELETE — remove a payout row entirely (and its proof screenshot, if any).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; payoutId: string }> },
) {
  const { eventId, payoutId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const id = parseInt(payoutId, 10);
  if (!Number.isFinite(eId) || !Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  // Event-scoped: an admin, a clan treasurer, or this board's own treasurer.
  if (!(await verifyEventTreasurer(eId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payout = await db.query.payouts.findFirst({
    where: and(eq(payouts.id, id), eq(payouts.eventId, eId)),
  });
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

  if (payout.proofBlobUrl) del(payout.proofBlobUrl).catch(() => {});
  await db.delete(payouts).where(eq(payouts.id, id));
  return NextResponse.json({ success: true });
}
