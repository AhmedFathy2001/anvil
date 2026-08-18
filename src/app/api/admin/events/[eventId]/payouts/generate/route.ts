import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyFeeCollector } from '@/lib/auth';
import {
  generatePayouts,
  savePlacementPrizes,
  parsePlacementPrizes,
  suggestPlaceAmounts,
  getEventPrizePool,
} from '@/lib/payouts';

// POST — (re)generate per-player payout rows from the final standings, and persist the prize-per-
// placement structure it used. Body: { paidPlaces?, placeAmounts?: number[] (gp per placement),
// includeSubbed?: boolean }. Reward per place: explicit amounts win; else the saved structure; else
// a pool-derived split. Existing PAID rows are never touched; stale pending auto-rows are pruned.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyFeeCollector())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    paidPlaces?: number;
    placeAmounts?: number[];
    includeSubbed?: boolean;
  } | null;
  const includeSubbed = body?.includeSubbed === true;

  // Reward per placement: explicit request wins; otherwise the saved structure; otherwise a split of
  // the pool across the requested number of places.
  let placeAmounts =
    Array.isArray(body?.placeAmounts) && body.placeAmounts.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? body.placeAmounts.map((n) => Math.max(0, Math.round(n)))
      : parsePlacementPrizes(event.placementPrizes);
  if (placeAmounts.length === 0) {
    const pool = await getEventPrizePool(id);
    const places = Math.max(1, Math.round(Number(body?.paidPlaces) || 1));
    placeAmounts = suggestPlaceAmounts(pool.total, places);
  }

  // Persist the structure (so the event page reflects it), then build the rows.
  const saved = await savePlacementPrizes(id, placeAmounts);
  const rows = await generatePayouts(id, { placeAmounts: saved, includeSubbed });
  return NextResponse.json({ payouts: rows, placeAmounts: saved });
}
