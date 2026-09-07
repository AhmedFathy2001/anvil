import { NextResponse } from 'next/server';

import { resolveErrorEvent } from '@/lib/errorEvents';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

/**
 * Tick a failure off the operator list.
 *
 * `CAN_WRITE`, not 'support': support is read-only by design, and marking things resolved is exactly
 * the kind of small mutation that quietly erodes that if the guard is chosen by habit.
 *
 * The guard runs HERE and not only in the /staff layout — the proxy never covers /api/*, so a page
 * gate protects pages and nothing else.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  }

  const ok = await resolveErrorEvent(id, gate.actor.user.userId);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
