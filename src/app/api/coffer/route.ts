import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { clanRoster } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { fileDonation, getCofferBalance, listCofferEntries, topDonors } from '@/lib/coffer';
import { rateLimitByKey } from '@/lib/rate-limit';
import { findRosterSeats, seatsOwnedBy } from '@/lib/roster';

/**
 * The clan coffer, from a member's side: what is in the pot, who put it there, and the form for
 * saying you have added to it.
 *
 * A donation is a CLAIM, not a credit. Anyone holding a seat here can file one; it lands 'pending'
 * and moves nothing until staff approve it on /admin/coffer. That asymmetry is the whole security
 * model of this endpoint — the amount is self-reported, so the only thing being trusted is that a
 * member said something, and the only cost of a lie is a staffer's rejection.
 */

export async function GET() {
  const clan = await requireClan();
  const [balance, donors, recent] = await Promise.all([
    getCofferBalance(clan.id),
    topDonors(clan.id, 10),
    listCofferEntries({ clanId: clan.id, statuses: ['approved', 'paid', 'reserved'], limit: 25 }),
  ]);
  return NextResponse.json({
    balance,
    donors,
    // Amounts and names only: the ledger's notes and proof links are staff-side.
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      rsn: r.memberName ?? r.rsn,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const clan = await requireClan();

  // A donation costs a staffer's attention to resolve, so the limit is on filing them, not on the
  // gp: somebody spamming 200 claims is a moderation problem we can simply not have.
  const limited = await rateLimitByKey('coffer-donation', String(session.userId), { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many donations filed — try again in a minute.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    note?: unknown;
    proofUrl?: unknown;
    seatId?: unknown;
  } | null;
  const amount = Math.floor(Number(body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter how much you donated.' }, { status: 400 });
  }
  if (amount > 100_000_000_000) {
    return NextResponse.json({ error: "That's more gp than exists in this clan. Check the amount." }, { status: 400 });
  }

  // Which of their characters is donating. Their own seats only — the picker is a convenience, not
  // an authority, so a seat id from somebody else's roster resolves to nothing and the row is filed
  // under their name alone rather than credited to a stranger.
  const mine = await findRosterSeats(
    and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt), await seatsOwnedBy(clan.id, session.userId)),
  );
  if (mine.length === 0) {
    return NextResponse.json({ error: 'Only members of this clan can donate to its coffer.' }, { status: 403 });
  }
  const chosen = mine.find((s) => s.id === Number(body?.seatId)) ?? mine[0];

  const entry = await fileDonation({
    clanId: clan.id,
    amount,
    clanMemberId: chosen.id,
    rsn: chosen.rsn,
    createdByUserId: session.userId,
    proofBlobUrl: typeof body?.proofUrl === 'string' && body.proofUrl ? body.proofUrl : null,
    note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null,
  });
  return NextResponse.json({ entry: { id: entry.id, amount: entry.amount, status: entry.status } });
}
