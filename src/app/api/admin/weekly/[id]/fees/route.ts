import { NextResponse } from 'next/server';

import { verifyAdmin, verifyAdminOrModerator, verifyFeeCollector, verifyUser } from '@/lib/auth';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { competitionForRequest } from '@/lib/eventScope';
import { moveWeeklyFee, weeklyFeeSheet, type WeeklyFeeAction } from '@/lib/weeklySignups';

/**
 * A competition's entry fees (lib/weeklySignups): the sheet, and one move on one entrant's fee.
 * Collectors (treasurer and up) mark a fee collected; admins confirm, reset and waive. The same
 * split as an event's fees.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ entryFee: comp.entryFee, selfSignup: comp.selfSignup, ...(await weeklyFeeSheet(comp)) });
}

const ACTIONS: WeeklyFeeAction[] = ['collect', 'confirm', 'reset', 'waive'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const body = (await request.json().catch(() => ({}))) as { participantId?: unknown; action?: unknown };
  const action = ACTIONS.find((a) => a === body.action);
  if (!action || typeof body.participantId !== 'number') return NextResponse.json({ error: 'participantId and action are required' }, { status: 400 });
  const allowed = action === 'collect' ? await verifyFeeCollector() : await verifyAdmin();
  const user = allowed ? await verifyUser() : null;
  if (!user) {
    return NextResponse.json(
      { error: action === 'collect' ? 'Only a treasurer or admin can mark a fee collected.' : 'Only an admin can confirm, reset or waive a fee.' },
      { status: 403 },
    );
  }
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r = await moveWeeklyFee(comp, body.participantId, action, user.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ...(await weeklyFeeSheet(comp)) });
}
