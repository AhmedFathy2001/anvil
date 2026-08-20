import { NextResponse } from 'next/server';

import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';
import { unverify, verifyManually } from '@/lib/clanVerification';

/**
 * Verifying a clan by hand, and withdrawing a badge.
 *
 * The automatic path — an owner-tier account pushing the clan's roster — covers the ordinary case
 * and should stay the ordinary case. This is for the ones it cannot reach:
 *
 *   - a clan that renamed its owner rank, since the check reads the title and OSRS lets clans call
 *     their ranks anything
 *   - a clan whose owner has stopped playing
 *   - a dispute, where two clans claim one name and somebody has to decide
 *
 * PLATFORM-SIDE ONLY. A clan verifying itself would be the entire point missed, so this lives under
 * /api/staff behind a platform role that no clan grant can confer.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const clanId = Number((await params).id);
  if (!Number.isInteger(clanId) || clanId <= 0) {
    return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  if (body.verified === false) {
    await unverify(clanId, actor.user.userId, body.reason ?? null);
    return NextResponse.json({ ok: true, verified: false });
  }

  const result = await verifyManually(clanId, String(body.inGameName ?? ''), actor.user.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true });
}
