import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { movePayout } from '@/lib/clanEventPayouts';

// Take a winner off the sheet.

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; payoutId: string }> }) {
  const user = await verifyFeeCollector();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const { id, payoutId } = await params;
  const r = await movePayout(clan.id, Number(id), Number(payoutId), 'delete', user.userId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
