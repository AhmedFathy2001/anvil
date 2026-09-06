import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyEventTreasurer } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { getCofferBalance, getEventPool, setEventPool } from '@/lib/coffer';
import { getEventPrizePool } from '@/lib/payouts';

/**
 * What a board takes out of the clan coffer.
 *
 * Deliberately a single number. The board already knows how to divide a pool — entry fees, the
 * host's bonus and this all land in the same pot, split across placements by lib/payouts — so the
 * coffer's whole job here is to commit the gp and record that it left. No places, no winners.
 *
 * Event-scoped treasurer, the same grant that collects this board's fees and runs its payouts: a
 * visiting clan's treasurer can fund their own side of a clan-v-clan without holding the ledger.
 */

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!(await eventForRequest(request, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyEventTreasurer(id))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clan = await requireClan();
  const [pool, balance, prizePool] = await Promise.all([
    getEventPool(id),
    getCofferBalance(clan.id),
    getEventPrizePool(id),
  ]);
  return NextResponse.json({
    funded: pool ? Math.abs(pool.amount) : 0,
    status: pool?.status ?? null,
    held: pool?.status === 'reserved',
    balance,
    prizePool,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = await verifyEventTreasurer(id);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clan = await requireClan();
  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    note?: unknown;
    hold?: unknown;
  } | null;
  const amount = Math.floor(Number(body?.amount));
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'Enter an amount, or 0 to take it back.' }, { status: 400 });
  }
  if (amount > 100_000_000_000) {
    return NextResponse.json({ error: 'That amount is out of range.' }, { status: 400 });
  }

  const result = await setEventPool({
    clanId: clan.id,
    eventId: id,
    amount,
    // Holding is the default: the gp is promised, and a promise the coffer can spend twice is the
    // failure this whole ledger exists to prevent. An older client that sends nothing gets a hold.
    hold: body?.hold !== false,
    userId: session.userId,
    note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const [balance, prizePool] = await Promise.all([getCofferBalance(clan.id), getEventPrizePool(id)]);
  return NextResponse.json({
    funded: result.entry ? Math.abs(result.entry.amount) : 0,
    status: result.entry?.status ?? null,
    held: result.entry?.status === 'reserved',
    balance,
    prizePool,
  });
}
