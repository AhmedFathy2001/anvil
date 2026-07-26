import { NextResponse } from 'next/server';
import { verifyFeeCollector } from '@/lib/auth';
import { announcePayouts } from '@/lib/payouts';

// POST — manually announce (or re-announce) the paid winners to the bingo Discord webhook.
// The same summary auto-fires when the last payout is marked paid; this is for re-posting or
// announcing a partial set on demand.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyFeeCollector())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const ok = await announcePayouts(id);
  if (!ok) {
    return NextResponse.json(
      { error: 'Nothing to announce — mark at least one payout paid first, or the webhook is unset.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true });
}
