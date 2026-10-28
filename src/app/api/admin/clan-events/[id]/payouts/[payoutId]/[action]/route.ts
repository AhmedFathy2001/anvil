import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { movePayout } from '@/lib/clanEventPayouts';
import { isClanMediaUrl } from '@/lib/storage';

// Mark a winner paid (with a screenshot, if there is one) or take it back.

export async function POST(request: Request, { params }: { params: Promise<{ id: string; payoutId: string; action: string }> }) {
  const { id, payoutId, action } = await params;
  if (action !== 'pay' && action !== 'unpay') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const user = await verifyFeeCollector();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const { proofUrl } = (await request.json().catch(() => ({}))) as { proofUrl?: unknown };
  const proof = typeof proofUrl === 'string' && proofUrl ? proofUrl : null;
  if (proof && !isClanMediaUrl(proof, clan.slug)) return NextResponse.json({ error: 'Attach proof by uploading it here.' }, { status: 400 });
  const r = await movePayout(clan.id, Number(id), Number(payoutId), action, user.userId, proof);
  return r.ok ? NextResponse.json({ payout: r.value }) : NextResponse.json({ error: r.error }, { status: r.status });
}
