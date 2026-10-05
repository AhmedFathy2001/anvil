import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { listCharacterReports, resolveCharacterReport } from '@/lib/characterReports';

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
  return NextResponse.json({ ok: true });
}
