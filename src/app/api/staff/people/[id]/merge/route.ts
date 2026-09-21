import { NextResponse } from 'next/server';

import { mergePeople } from '@/lib/mergePeople';
import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';

/**
 * Fold one person record into another.
 *
 * WHY AN OPERATOR NEEDS THIS. The site mints a person for a character the moment a roster sync sees
 * it, and another when a human signs in. Claiming the character joins them, and now tidies up after
 * itself — but the rows that predate that, or that never got claimed because the character was
 * already established on a roster, are still out there as two halves of one human.
 *
 * The id in the URL is the one that DISAPPEARS. `into` survives, because the surviving row is the one
 * that should keep the login: a login cannot be re-minted from a roster sync, and everything that
 * knows this person by their Discord identity is pointing at it.
 *
 * Staff-tier, not root: it moves nothing between humans that the operator could not already move by
 * hand with the ban and the roster tools, and it is written to the operator log either way.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sourcePlayerId = Number((await params).id);
  if (!Number.isInteger(sourcePlayerId) || sourcePlayerId <= 0) {
    return NextResponse.json({ error: 'Bad person id' }, { status: 400 });
  }

  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const body = (await request.json().catch(() => null)) as { into?: unknown } | null;
  const targetPlayerId = Number(body?.into);
  if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0) {
    return NextResponse.json({ error: 'Give the person id to merge into.' }, { status: 400 });
  }

  const result = await mergePeople({
    sourcePlayerId,
    targetPlayerId,
    actorUserId: actor.user.userId,
    reason: 'merged by an operator',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(result);
}
