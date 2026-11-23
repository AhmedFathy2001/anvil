import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { clanGrant } from '@/lib/clanGrants';
import { setPlanPayer } from '@/lib/planPayers';

/**
 * POST { userId, on } — the OWNER lets one of the clan's admins, treasurers or moderators pay for the
 * plan, or stops them (lib/planPayers). Taking it from the person paying now never touches their
 * membership; they are told it keeps charging until they cancel.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClanFromRequest(request);
  const grant = await clanGrant(clan.id, session.userId);
  if (!grant?.isOwner) return NextResponse.json({ error: 'Only the owner decides who pays for the plan.' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { userId?: unknown; on?: unknown } | null;
  const userId = typeof body?.userId === 'number' && Number.isInteger(body.userId) ? body.userId : null;
  if (userId == null || typeof body?.on !== 'boolean') return NextResponse.json({ error: 'userId and on are required' }, { status: 400 });
  if (userId === session.userId) return NextResponse.json({ error: 'The owner can always pay.' }, { status: 400 });
  const res = await setPlanPayer(clan.id, session.userId, userId, body.on);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
