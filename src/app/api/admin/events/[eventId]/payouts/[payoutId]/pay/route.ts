import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events, payouts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { del } from '@/lib/storage';
import { allPayoutsPaid, announcePayouts } from '@/lib/payouts';

// POST — a treasurer/admin marks a payout as paid, optionally attaching a proof screenshot.
// Body: { proofUrl?, notes? }. Re-marking replaces the proof. When this makes EVERY payout for the
// event paid (and it hasn't been announced yet), the winners are auto-announced to the bingo webhook.
export async function POST(
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
  const session = await verifyEventTreasurer(eId);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { proofUrl?: string; notes?: string } | null;
  const proofUrl = typeof body?.proofUrl === 'string' && body.proofUrl ? body.proofUrl : null;

  const payout = await db.query.payouts.findFirst({
    where: and(eq(payouts.id, id), eq(payouts.eventId, eId)),
  });
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });

  // Clean up a replaced proof blob (best-effort).
  if (payout.proofBlobUrl && proofUrl && payout.proofBlobUrl !== proofUrl) {
    del(payout.proofBlobUrl).catch(() => {});
  }

  const [updated] = await db
    .update(payouts)
    .set({
      status: 'paid',
      paidByUserId: session.userId,
      paidAt: new Date().toISOString(),
      proofBlobUrl: proofUrl ?? payout.proofBlobUrl,
      notes: body?.notes ?? payout.notes,
    })
    .where(eq(payouts.id, id))
    .returning();

  // Auto-announce once the whole set is paid and hasn't been announced before.
  let announced = false;
  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (event && !event.payoutsAnnouncedAt && (await allPayoutsPaid(eId))) {
    announced = await announcePayouts(eId).catch(() => false);
  }

  return NextResponse.json({ payout: updated, announced });
}
