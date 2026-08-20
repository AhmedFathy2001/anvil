import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { savePlacementPrizes } from '@/lib/payouts';

// POST — save the prize-per-placement structure on the event WITHOUT generating payout rows. Lets an
// admin advertise the reward per place ahead of time (shown on the event page); the rows are built
// later, manually or auto-generated when the event ends. Body: { placeAmounts: number[] }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  // Event-scoped: an admin, a clan treasurer, or whoever holds THIS board's treasurer grant.
  if (!(await verifyEventTreasurer(id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { placeAmounts?: unknown } | null;
  if (!Array.isArray(body?.placeAmounts)) {
    return NextResponse.json({ error: 'placeAmounts must be an array of gp amounts' }, { status: 400 });
  }
  const amounts = body.placeAmounts.map((n) => Math.max(0, Math.round(Number(n) || 0)));

  const saved = await savePlacementPrizes(id, amounts);
  return NextResponse.json({ placeAmounts: saved });
}
