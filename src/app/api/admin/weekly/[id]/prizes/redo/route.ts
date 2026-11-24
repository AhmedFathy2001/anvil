import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { competitionForRequest } from '@/lib/eventScope';
import { redoWeeklyPrizes } from '@/lib/weeklyPrizeRedo';

/**
 * POST { repost?: boolean } — redo a finished competition's prizes from its standings as they are
 * now, and (by default) post corrected results to Discord (lib/weeklyPrizeRedo). The clan's money,
 * so the treasurer's grant, like the ladder itself. Refused once any prize is marked paid.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyFeeCollector();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const comp = await competitionForRequest(request, parseInt(id, 10));
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { repost?: unknown } | null;
  const res = await redoWeeklyPrizes(comp.id, user.userId, { repost: body?.repost !== false });
  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          res.reason === 'paid'
            ? `Already marked paid: ${res.paid?.join(', ')}. Fix those on the coffer page instead.`
            : 'This competition has not finished yet.',
      },
      { status: 409 },
    );
  }
  return NextResponse.json(res);
}
