import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { LAB_TIERS, clearLabDrops, labSupporterState, seedLabDrops, setLabTier } from '@/lib/labSupporter';

// /api/staff/lab/supporter — the Supporter test bench (lib/labSupporter). GET: your lab tier, the
// test clanmates and how many test drops exist. POST {action}: 'tier' {tier|null, months},
// 'seed' {count}, 'clear'.

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  return NextResponse.json(await labSupporterState(gate.actor.user.userId));
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: { action?: unknown; tier?: unknown; months?: unknown; count?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const userId = gate.actor.user.userId;
  if (body.action === 'tier') {
    const tier = LAB_TIERS.find((t) => t === body.tier) ?? null;
    if (body.tier != null && !tier) return NextResponse.json({ error: 'Unknown tier' }, { status: 400 });
    await setLabTier(userId, tier, typeof body.months === 'number' ? body.months : 0);
  } else if (body.action === 'seed') {
    await seedLabDrops(userId, typeof body.count === 'number' ? body.count : 6);
  } else if (body.action === 'clear') {
    await clearLabDrops();
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json(await labSupporterState(userId));
}
