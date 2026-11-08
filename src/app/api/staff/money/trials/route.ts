import { NextResponse } from 'next/server';

import { requireOwnerApi } from '@/lib/ownerAccess';
import { TrialError, grantTrial, listTrials } from '@/lib/ownerTrials';

// Owner only. GET the pipeline; POST { kind: 'supporter'|'boost', userId|clanId, tier, days, note? }.
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json(await listTrials(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || (b.kind !== 'supporter' && b.kind !== 'boost')) return NextResponse.json({ error: 'Pick supporter or boost.' }, { status: 400 });
  try {
    const row = await grantTrial({
      kind: b.kind,
      userId: typeof b.userId === 'number' ? b.userId : undefined,
      clanId: typeof b.clanId === 'number' ? b.clanId : undefined,
      tier: typeof b.tier === 'string' || typeof b.tier === 'number' ? b.tier : '',
      days: typeof b.days === 'number' ? b.days : NaN,
      note: typeof b.note === 'string' ? b.note : null,
      actorUserId: gate.actor.user.userId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    if (e instanceof TrialError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
