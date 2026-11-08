import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { actOnOwnershipTransfer, listOwnershipTransfers } from '@/lib/ownershipTransfers';

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
 * and both people are told it); clear lets it through: off the queue, and it still waits out the hold.
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
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
