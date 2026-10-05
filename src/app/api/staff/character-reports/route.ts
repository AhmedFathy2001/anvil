import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { listCharacterReports, resolveCharacterReport, settleRenameRequests } from '@/lib/characterReports';
import { db } from '@/db';
import { characterReports } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** The platform's queue of characters clans have raised. Support may read it. */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const status = new URL(request.url).searchParams.get('status') === 'all' ? 'all' : 'open';
  return NextResponse.json({ items: await listCharacterReports({ status }) });
}

/** Close a report — resolved (something was done) or dismissed (nothing needed doing). */
export async function PATCH(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const status = body?.status;
  if (!Number.isInteger(id) || (status !== 'resolved' && status !== 'dismissed')) {
    return NextResponse.json({ error: 'id and status (resolved | dismissed) are required' }, { status: 400 });
  }
  const ok = await resolveCharacterReport(id, gate.actor.user.userId, status, typeof body?.resolution === 'string' ? body.resolution : null);
  if (!ok) return NextResponse.json({ error: 'That report is not open.' }, { status: 409 });
  // A rename turned down here answers the player's own request on their profile too.
  if (status === 'dismissed') {
    const [r] = await db.select().from(characterReports).where(eq(characterReports.id, id));
    if (r?.kind === 'rename') {
      await settleRenameRequests(r.accountId, r.requestedRsn, 'denied', typeof body?.resolution === 'string' && body.resolution.trim() ? body.resolution.trim() : 'Not applied by Anvil staff');
    }
  }
  return NextResponse.json({ ok: true });
}
