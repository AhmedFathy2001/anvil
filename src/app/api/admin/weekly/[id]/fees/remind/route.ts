import { NextResponse } from 'next/server';

import { verifyFeeCollector, verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { competitionForRequest } from '@/lib/eventScope';
import { remindWeeklyFees } from '@/lib/weeklyFeeReminders';

/** "Remind unpaid": DM everyone who still owes this competition's entry fee. Treasurer or admin. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const user = (await verifyFeeCollector()) ? await verifyUser() : null;
  if (!user) return NextResponse.json({ error: 'Only a treasurer or admin can send fee reminders.' }, { status: 403 });
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  const clan = await requireClan();
  // The host's own competition: its fees are that clan's.
  if (!comp || comp.clanId !== clan.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r = await remindWeeklyFees({ clan, comp, actorUserId: user.userId });
  if (!r.ok) return NextResponse.json({ error: r.error, waitMs: r.waitMs }, { status: r.status });
  return NextResponse.json(r);
}
