import { NextResponse } from 'next/server';

import { CAN_BILL, requirePlatformApi } from '@/lib/platformAccess';
import { attachToSpace, attachToUser, dismissPurchase, type ActionResult } from '@/lib/unmatchedPurchaseActions';

export const dynamic = 'force-dynamic';

// /api/staff/unmatched-purchases/<id> — resolve one unmatched Gumroad purchase (lib/unmatchedPurchaseActions).
//   POST { action: 'attach-space', clanId, confirmReplace?, note? }   plan / creator purchases
//   POST { action: 'attach-user', userId, note? }                     Supporter purchases
//   POST { action: 'dismiss', note }                                  note required
// Root only (CAN_BILL): attaching hands out what people pay for. Each action is in /staff/audit.
// Nothing here refunds or writes to Gumroad.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_BILL);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const who = { actorUserId: actor.user.userId, actorRole: actor.role };
  let result: ActionResult;
  switch (body.action) {
    case 'attach-space': {
      const clanId = Number(body.clanId);
      if (!Number.isInteger(clanId) || clanId <= 0) return NextResponse.json({ error: 'Pick a space.' }, { status: 400 });
      result = await attachToSpace({ id, clanId, confirmReplace: body.confirmReplace === true, note: body.note, ...who });
      break;
    }
    case 'attach-user': {
      const userId = Number(body.userId);
      if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ error: 'Pick a person.' }, { status: 400 });
      result = await attachToUser({ id, userId, note: body.note, ...who });
      break;
    }
    case 'dismiss':
      result = await dismissPurchase({ id, note: body.note, ...who });
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error, needsConfirm: result.needsConfirm ?? false }, { status: result.status });
  }
  return NextResponse.json(result);
}
