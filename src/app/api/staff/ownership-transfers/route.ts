import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { actOnOwnershipTransfer, listOwnershipTransfers, staffTransferNow } from '@/lib/ownershipTransfers';

/** Clan ownership transfers waiting out their 3-day hold (and, with ?status=all, history). Support may read. */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') === 'all' ? 'all' : 'pending';
  const clanId = Number(url.searchParams.get('clanId'));
  const items = await listOwnershipTransfers({ status, clanId: Number.isInteger(clanId) && clanId > 0 ? clanId : undefined });
  return NextResponse.json({ items });
}

/**
 * POST { id, action: 'block' | 'clear', reason? } — block stops the transfer (a reason is required,
 * and both people are told it); clear lets it through, completing it now.
 * POST { action: 'transfer-now', clanId, toUserId, reason } — recovery: hand the clan to one of its
 * admins now, no request or hold.
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  if (body?.action === 'transfer-now') {
    const clanId = Number(body.clanId);
    const toUserId = Number(body.toUserId);
    if (!Number.isInteger(clanId) || !Number.isInteger(toUserId)) {
      return NextResponse.json({ error: 'clanId and toUserId are required' }, { status: 400 });
    }
    const res = await staffTransferNow({ clanId, toUserId, actorUserId: gate.actor.user.userId, reason: typeof body.reason === 'string' ? body.reason : '' });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, status: res.transfer.status });
  }
  const id = Number(body?.id);
  const action = body?.action;
  if (!Number.isInteger(id) || (action !== 'block' && action !== 'clear')) {
    return NextResponse.json({ error: "id and action ('block' | 'clear') are required" }, { status: 400 });
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (action === 'block' && !reason) {
    return NextResponse.json({ error: 'Say why it is blocked — both people are told.' }, { status: 400 });
  }
  const res = await actOnOwnershipTransfer({
    action,
    actorUserId: gate.actor.user.userId,
    isPlatformStaff: true,
    clanId: null,
    transferId: id,
    reason,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, status: res.transfer.status });
}
