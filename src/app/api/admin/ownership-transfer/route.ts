import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { clanGrant } from '@/lib/clanGrants';
import { actOnOwnershipTransfer, pendingTransferForClan } from '@/lib/ownershipTransfers';

/** This clan's pending ownership transfer, for its admins (null when there is none). */
export async function GET(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const grant = await clanGrant(clan.id, session.userId);
  if (grant?.role !== 'admin' && grant?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ transfer: await pendingTransferForClan(clan.id) });
}

/**
 * POST { action: 'cancel' | 'decline' } — on THIS clan's pending transfer. Cancel is the owner who
 * asked; decline is the person it is going to (lib/ownershipTransferRules decides, off the row).
 * Blocking is Anvil staff's, on /api/staff/ownership-transfers.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'cancel' && action !== 'decline') {
    return NextResponse.json({ error: "action must be 'cancel' or 'decline'" }, { status: 400 });
  }
  const res = await actOnOwnershipTransfer({ action, actorUserId: session.userId, isPlatformStaff: false, clanId: clan.id });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, status: res.transfer.status });
}
