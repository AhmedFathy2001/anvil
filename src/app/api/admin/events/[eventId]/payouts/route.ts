import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, payouts, clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { getEventPrizePool, parsePlacementSplit, placementAmounts } from '@/lib/payouts';
import { getTeamStandings } from '@/lib/statStandings';

// Order payouts for display: by finishing place (manual/null-place rows last), then amount desc.
function sortPayouts<T extends { place: number | null; amount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount);
}

// GET — the full payouts panel payload: existing rows, the prize pool, live standings (for the
// generate preview), and whether the winners have been announced.
export async function GET(
  _request: Request,
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

  const [rows, pool, standings] = await Promise.all([
    db.select().from(payouts).where(eq(payouts.eventId, id)),
    getEventPrizePool(id),
    getTeamStandings(id, event.scoringMode),
  ]);

  const allPaid = rows.length > 0 && rows.every((r) => r.status === 'paid');
  return NextResponse.json({
    payouts: sortPayouts(rows),
    pool,
    standings,
    announcedAt: event.payoutsAnnouncedAt,
    allPaid,
    // What each place is worth right now — a percentage split resolves against the live pool.
    placementPrizes: placementAmounts(event, pool.total),
    // Non-empty when the board's prizes are SHARES, so the editor opens in the right mode.
    placementSplitPct: parsePlacementSplit(event.placementSplitPct),
  });
}

// POST — add a single free-form payout row (recipient name + amount), outside the standings-driven
// generation. clanMemberId is optional; when supplied it links the row to a roster member.
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
    rsn?: string;
    amount?: number;
    clanMemberId?: number | null;
  } | null;

  const rsn = typeof body?.rsn === 'string' ? body.rsn.trim() : '';
  const amount = Number(body?.amount);
  if (!rsn) return NextResponse.json({ error: 'Recipient name is required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });
  }

  let clanMemberId: number | null = null;
  if (body?.clanMemberId != null) {
    const cmId = Number(body.clanMemberId);
    const member = Number.isFinite(cmId)
      ? await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, cmId) })
      : null;
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    clanMemberId = cmId;
  }

  try {
    const [row] = await db
      .insert(payouts)
      .values({ eventId: id, clanMemberId, rsn, amount: Math.round(amount), status: 'pending' })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    // Unique (event, clanMemberId) — a payout for this member already exists.
    return NextResponse.json(
      { error: 'This member already has a payout row for this event.' },
      { status: 409 },
    );
  }
}
