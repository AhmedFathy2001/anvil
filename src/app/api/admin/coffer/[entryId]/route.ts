import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { settleAward, settleDonation } from '@/lib/coffer';

/**
 * Resolving one ledger row: approve or reject a member's donation, mark a prize sent, or take a
 * reservation back.
 *
 * Every write is conditional on the row still being in the state it left — clan id included — so a
 * second click credits nothing twice and a row id from another clan's ledger updates nothing at all.
 */
export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();

  const entryId = parseInt((await params).entryId, 10);
  if (!Number.isFinite(entryId)) return NextResponse.json({ error: 'Invalid entry' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = String(body?.action ?? '');

  switch (action) {
    case 'approve':
    case 'reject': {
      const entry = await settleDonation({
        clanId: clan.id,
        entryId,
        approve: action === 'approve',
        userId: session.userId,
      });
      if (!entry) {
        return NextResponse.json({ error: 'That donation has already been resolved.' }, { status: 409 });
      }
      return NextResponse.json({ entry });
    }
    case 'pay':
    case 'cancel': {
      const entry = await settleAward({
        clanId: clan.id,
        entryId,
        paid: action === 'pay',
        userId: session.userId,
      });
      if (!entry) {
        return NextResponse.json({ error: 'That prize is no longer waiting to be sent.' }, { status: 409 });
      }
      return NextResponse.json({ entry });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
