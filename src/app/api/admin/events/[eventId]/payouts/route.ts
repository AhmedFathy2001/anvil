import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events, payouts, clanRoster } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyEventTreasurer } from '@/lib/auth';
import { getEventPrizePool, parsePlacementSplit, placementAmounts } from '@/lib/payouts';
import { getTeamStandings } from '@/lib/statStandings';
import { acceptedCohostClanIds } from '@/lib/coHost';

// Order payouts for display: by finishing place (manual/null-place rows last), then amount desc.
function sortPayouts<T extends { place: number | null; amount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount);
}

// GET — the full payouts panel payload: existing rows, the prize pool, live standings (for the
// generate preview), and whether the winners have been announced.
export async function GET(
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
    // The recipient has to be somebody who could be ON this board. Seat ids are global and this one
    // comes from the body, so a bare `clanRoster.id` lookup accepted any clan's seat — attaching a
    // payout to a stranger, and answering 404-or-created in a way that says which seat ids exist.
    //
    // The host's own clan is not the whole answer: a co-hosted board pays a visiting clan's players,
    // and they hold seats in THEIR clan. So the set is the host plus every accepted co-host, which is
    // exactly who is allowed to field a team here.
    const payableClans = [event.clanId, ...(await acceptedCohostClanIds(id))];
    const member = Number.isFinite(cmId)
      ? await findRosterSeat(and(eq(clanRoster.id, cmId), inArray(clanRoster.clanId, payableClans)))
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
