import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { savePlacementPrizes, savePlacementSplit } from '@/lib/payouts';

// POST — save the prize-per-placement structure on the event WITHOUT generating payout rows. Lets an
// admin advertise the reward per place ahead of time (shown on the event page); the rows are built
// later, manually or auto-generated when the event ends. Body: { placeAmounts: number[] }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  // Event-scoped: an admin, a clan treasurer, or whoever holds THIS board's treasurer grant.
  if (!(await verifyEventTreasurer(id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    placeAmounts?: unknown;
    placePercents?: unknown;
  } | null;

  // Shares of the pool. Stored as percentages and resolved live, so the advertised prize follows
  // the pool as entries are approved instead of freezing at whatever it was worth today.
  if (Array.isArray(body?.placePercents)) {
    const pcts = body.placePercents.map((n) => Number(n) || 0);
    const total = pcts.reduce((sum, n) => sum + n, 0);
    if (total > 100.5) {
      return NextResponse.json(
        { error: `Those shares add up to ${Math.round(total)}% of the pool.` },
        { status: 400 },
      );
    }
    const saved = await savePlacementSplit(id, pcts);
    return NextResponse.json({ placePercents: saved });
  }

  if (!Array.isArray(body?.placeAmounts)) {
    return NextResponse.json(
      { error: 'placeAmounts (gp) or placePercents (share of pool) must be an array' },
      { status: 400 },
    );
  }
  const amounts = body.placeAmounts.map((n) => Math.max(0, Math.round(Number(n) || 0)));

  const saved = await savePlacementPrizes(id, amounts);
  return NextResponse.json({ placeAmounts: saved });
}
