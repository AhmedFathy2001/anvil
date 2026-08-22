import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import {
  generatePayouts,
  savePlacementPrizes,
  parsePlacementSplit,
  placementAmounts,
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

  const body = (await request.json().catch(() => null)) as {
    paidPlaces?: number;
    placeAmounts?: number[];
    includeSubbed?: boolean;
  } | null;
  const includeSubbed = body?.includeSubbed === true;

  // Reward per placement: explicit request wins; otherwise the board's own structure resolved
  // against the live pool (a share-based board turns into gp here); otherwise a split of the pool
  // across the requested number of places.
  const pool = await getEventPrizePool(id);
  const explicit =
    Array.isArray(body?.placeAmounts) && body.placeAmounts.every((n) => typeof n === 'number' && Number.isFinite(n));
  let placeAmounts = explicit
    ? body!.placeAmounts!.map((n) => Math.max(0, Math.round(n)))
    : placementAmounts(event, pool.total);
  if (placeAmounts.length === 0) {
    const places = Math.max(1, Math.round(Number(body?.paidPlaces) || 1));
    placeAmounts = suggestPlaceAmounts(pool.total, places);
  }

  // Persist the structure (so the event page reflects it), then build the rows — but leave a
  // share-based board as shares unless the caller sent explicit gp. Saving amounts clears the
  // split, which would silently convert "40% of the pool" into a frozen number behind the host's
  // back. The payout ROWS carry concrete gp either way, and those are what gets paid.
  const shareBased = parsePlacementSplit(event.placementSplitPct).length > 0 && !explicit;
  const saved = shareBased ? placeAmounts : await savePlacementPrizes(id, placeAmounts);
  const rows = await generatePayouts(id, { placeAmounts: saved, includeSubbed });
  return NextResponse.json({ payouts: rows, placeAmounts: saved });
}
