import { NextResponse } from 'next/server';
import { db } from '@/db';
import { payouts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { del } from '@/lib/storage';

// POST — revert a payout back to pending: clears the paid marker and deletes any proof screenshot.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; payoutId: string }> },
) {
  const { eventId, payoutId } = await params;
  const eId = parseInt(eventId, 10);
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

  const [updated] = await db
    .update(payouts)
    .set({ status: 'pending', paidByUserId: null, paidAt: null, proofBlobUrl: null })
    .where(eq(payouts.id, id))
    .returning();

  return NextResponse.json({ payout: updated });
}
