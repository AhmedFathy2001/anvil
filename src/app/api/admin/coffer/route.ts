import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { getCofferBalance, listCofferEntries, recordAdjustment } from '@/lib/coffer';

/**
 * The staff side of the coffer: the whole ledger, and the one write that isn't a reaction to
 * somebody else — a manual adjustment.
 *
 * Gated on the same grant that collects sign-up fees (treasurer or admin, never a plain moderator),
 * because it is the same job: this is the clan's money, and rank alone has never conferred it.
 */

export async function GET() {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const [balance, entries] = await Promise.all([
    getCofferBalance(clan.id),
    listCofferEntries({ clanId: clan.id, limit: 200 }),
  ]);
  return NextResponse.json({ balance, entries });
}

export async function POST(request: Request) {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();

  const body = (await request.json().catch(() => null)) as { amount?: unknown; note?: unknown } | null;
  const amount = Math.trunc(Number(body?.amount));
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: 'Enter an amount to add or remove.' }, { status: 400 });
  }
  if (Math.abs(amount) > 100_000_000_000) {
    return NextResponse.json({ error: 'That amount is out of range.' }, { status: 400 });
  }
  // A negative adjustment can take the pot below what is already promised, and that is allowed on
  // purpose: the gp really did leave, and a ledger that refuses to record reality is worth less than
  // one that shows a treasurer they are short.
  const entry = await recordAdjustment({
    clanId: clan.id,
    amount,
    userId: session.userId,
    note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null,
  });
  return NextResponse.json({ entry });
}
