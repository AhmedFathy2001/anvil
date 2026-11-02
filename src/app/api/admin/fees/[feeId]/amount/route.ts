import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, eventSignups, events, signupFees } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { standardFeeForAccount } from '@/lib/entryFee';
import { assertEventEditable } from '@/lib/eventLock';
import { feeEventForRequest } from '@/lib/eventScope';

// Price one entry by hand — an invite discount, a comp, a guest who was charged the member fee.
//   { amount: number } → that amount, marked custom so later fee changes on the board leave it be.
//   { amount: null }   → back to the standard member/guest fee, and back under those changes.
// The pot sums the real fee rows (lib/prizePool), so this moves the advertised pool with it.
export async function POST(request: Request, { params }: { params: Promise<{ feeId: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 401 });

  const { feeId } = await params;
  const id = parseInt(feeId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  // Whose fee is this? Ids are global; only this clan's ledger is this clan's to touch.
  const scoped = await feeEventForRequest(request, id);
  if (!scoped) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const raw = body?.amount;
  if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 2_147_483_647)) {
    return NextResponse.json({ error: 'amount must be a whole number of gp, or null for the standard fee' }, { status: 400 });
  }

  // clan-scope: global -- this one fee, already scoped to this clan above (feeEventForRequest); the seat join adds its character.
  const [row] = await db
    .select({ eventId: eventSignups.eventId, accountId: clanMemberships.accountId })
    .from(signupFees)
    .innerJoin(eventSignups, eq(eventSignups.id, signupFees.signupId))
    .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
    .where(eq(signupFees.id, id));
  if (!row) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  // A finished board's ledger is its recorded result.
  const locked = await assertEventEditable(row.eventId);
  if (locked) return locked;

  // clan-scope: global -- the fee was scoped to this clan above (feeEventForRequest); this reads its own event by id.
  const event = await db.query.events.findFirst({ where: eq(events.id, row.eventId) });
  if (!event) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  const amount = raw === null ? (await standardFeeForAccount(event, row.accountId)) ?? 0 : (raw as number);
  const [updated] = await db
    .update(signupFees)
    .set({ amount, customAmount: raw !== null })
    .where(eq(signupFees.id, id))
    .returning();
  return NextResponse.json({ fee: updated });
}
