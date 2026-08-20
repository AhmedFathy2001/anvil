import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { approveRequest, pendingRequests, rejectRequest } from '@/lib/guestAdmission';

/**
 * The guest queue: who has asked to join this clan, and staff's answer.
 *
 * Moderator-or-better, because deciding who is on the roster is roster work rather than
 * administration — the same tier that can already remove someone.
 */

export async function GET(request: Request) {
  const actor = await verifyAdminOrModerator();
  if (!actor) return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const clan = await requireClanFromRequest(request);
  return NextResponse.json({ requests: await pendingRequests(clan.id) });
}

export async function POST(request: Request) {
  const actor = await verifyAdminOrModerator();
  if (!actor) return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const clan = await requireClanFromRequest(request);
  const body = await request.json().catch(() => null);

  const id = Number(body?.id);
  const decision = body?.decision;
  if (!Number.isInteger(id) || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'id and decision (approve|reject) required' }, { status: 400 });
  }

  if (decision === 'approve') {
    const r = await approveRequest(id, clan.id, actor.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, seatId: r.seatId });
  }

  const done = await rejectRequest(id, clan.id, actor.userId, body?.note ?? null);
  if (!done) return NextResponse.json({ error: 'No pending request with that id' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
