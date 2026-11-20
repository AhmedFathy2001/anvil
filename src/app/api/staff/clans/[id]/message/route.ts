import { NextResponse } from 'next/server';

import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';
import { messageClanOwner } from '@/lib/staffMessage';

/** Send a clan's owner a note from staff, as a Discord DM or an email (lib/staffMessage). Staff write it; this sends it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const clanId = Number((await params).id);
  if (!Number.isInteger(clanId) || clanId <= 0) return NextResponse.json({ error: 'Bad clan id' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { text?: unknown; via?: unknown } | null;
  const via = body?.via === 'email' ? 'email' : 'discord';
  const result = await messageClanOwner(clanId, gate.actor.user.userId, typeof body?.text === 'string' ? body.text : '', via);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, via: result.via });
}
