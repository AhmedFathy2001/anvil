import { NextResponse } from 'next/server';

import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';
import { dismissDecision, restoreDecisions } from '@/lib/staffDismissed';

/**
 * Dismiss one line of the staff Today page's "Needs a decision" list, or (`restore`) bring them all
 * back. The size it had is stored with it, so it returns when it grows (lib/staffDecisions).
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { key?: unknown; size?: unknown; restore?: unknown } | null;
  if (body?.restore === true) {
    await restoreDecisions();
    return NextResponse.json({ ok: true });
  }
  const key = typeof body?.key === 'string' ? body.key : '';
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) && body.size >= 0 ? Math.floor(body.size) : -1;
  if (!/^[a-z-]{1,40}$/.test(key) || size < 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  await dismissDecision(key, size);
  return NextResponse.json({ ok: true });
}
