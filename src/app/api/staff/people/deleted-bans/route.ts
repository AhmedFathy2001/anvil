import { NextResponse } from 'next/server';

import { liftDeletedAccountPlatformBan } from '@/lib/deletedAccountBans';
import { requirePlatformApi, CAN_WRITE } from '@/lib/platformAccess';

// DELETE { id } — lift a platform ban kept from a deleted account (lib/deletedAccountBans). The same
// bar as banning a person from /staff. The list itself is read by the People page on the server.
export async function DELETE(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  if (!(await liftDeletedAccountPlatformBan(id, gate.actor.user.userId))) {
    return NextResponse.json({ error: 'That ban is no longer there.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
