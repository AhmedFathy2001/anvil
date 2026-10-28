import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { addPayout, payoutSheet } from '@/lib/clanEventPayouts';

// A clan event's payout sheet under one key (?key=): the pot and the winners the host named. Money,
// so treasurers and admins, as on a board.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyFeeCollector())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const key = new URL(request.url).searchParams.get('key');
  const sheet = key ? await payoutSheet(clan.id, Number((await params).id), key) : null;
  return sheet ? NextResponse.json(sheet) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyFeeCollector())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as { key?: unknown; rsn?: unknown; amount?: unknown; note?: unknown };
  const r = await addPayout(clan.id, Number((await params).id), String(body.key ?? ''), body);
  return r.ok ? NextResponse.json({ payout: r.value }, { status: 201 }) : NextResponse.json({ error: r.error }, { status: r.status });
}
