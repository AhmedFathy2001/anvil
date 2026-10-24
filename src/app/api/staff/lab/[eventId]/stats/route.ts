import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { labEvent } from '@/lib/lab';
import { simulateStatGain } from '@/lib/labStats';

// POST /api/staff/lab/<id>/stats — move one character's reading of one stat on a lab board and run
// the real stat-tile check (lib/labStats). For XP / KC / activity tiles, which no chat line can fake.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let body: { participantId?: unknown; statType?: unknown; key?: unknown; baseline?: unknown; gain?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { participantId, statType, key, baseline, gain } = body;
  if (!Number.isInteger(participantId) || typeof statType !== 'string' || typeof key !== 'string' || !key.trim()) {
    return NextResponse.json({ error: 'participantId, statType and key are required' }, { status: 400 });
  }
  if (typeof gain !== 'number' || !Number.isFinite(gain) || gain < 0 || gain > 500_000_000) {
    return NextResponse.json({ error: 'gain must be a non-negative number' }, { status: 400 });
  }
  if (baseline != null && (typeof baseline !== 'number' || !Number.isFinite(baseline) || baseline < 0)) {
    return NextResponse.json({ error: 'baseline must be a non-negative number' }, { status: 400 });
  }
  try {
    const result = await simulateStatGain(event.id, {
      participantId: participantId as number,
      statType,
      key: key.trim(),
      baseline: baseline as number | undefined,
      gain,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
