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

/** Above any real queue, and low enough that one request cannot loop for a minute. */
const MAX_BULK = 100;

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

  const decision = body?.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision (approve|reject) required' }, { status: 400 });
  }

  // ONE OR MANY, same route. Deciding on a queue is naturally a bulk act — a mod clearing a morning's
  // requests should not press a button twenty times — and making the many-case a second endpoint
  // would be a second place for the clan check and the authority check to drift.
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((n: unknown): n is number => Number.isInteger(n))
    : Number.isInteger(body?.id)
      ? [Number(body.id)]
      : [];
  if (ids.length === 0) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
  // A bound, so one request cannot sit in a loop for a minute. Well above any real queue.
  if (ids.length > MAX_BULK) {
    return NextResponse.json({ error: `Too many at once — ${MAX_BULK} is the limit.` }, { status: 400 });
  }

  // Each is decided on its own and reported on its own: a stale id in a batch (somebody else
  // answered it while this page was open) must not throw away the decisions either side of it.
  const done: number[] = [];
  const failed: { id: number; error: string }[] = [];
  for (const id of ids) {
    if (decision === 'approve') {
      const r = await approveRequest(id, clan.id, actor.userId);
      if (r.ok) done.push(id);
      else failed.push({ id, error: r.error });
    } else {
      const ok = await rejectRequest(id, clan.id, actor.userId, body?.note ?? null);
      if (ok) done.push(id);
      else failed.push({ id, error: 'No longer pending' });
    }
  }

  // 207 when a batch is partly through: the caller has to look, and a flat 200 would say it all
  // worked. A single-id call keeps the plain shape it always had.
  const status = failed.length > 0 && done.length > 0 ? 207 : failed.length > 0 ? 400 : 200;
  return NextResponse.json({ ok: failed.length === 0, done, failed }, { status });
}
