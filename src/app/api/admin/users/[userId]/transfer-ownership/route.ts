import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { requestOwnershipTransfer } from '@/lib/ownershipTransfers';

// ASK to hand the protected owner seat to another admin. Only the current owner may call this. It no
// longer moves anything on the spot: it opens a request with a 3-day hold (lib/ownershipTransfers) —
// the owner can cancel, the target can decline and Anvil staff can block it, and the lifecycle tick
// moves ownership when the hold runs out. The new owner must already be an admin of THIS clan.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ownership is OF A CLAN, so the clan comes from the host and the caller must own that one (read
  // live from the grant inside the lib, so a stale token cannot start one).
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { userId } = await params;
  const targetId = parseInt(userId, 10);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const res = await requestOwnershipTransfer({ clanId: clan.id, fromUserId: session.userId, toUserId: targetId });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ success: true, pending: true, completesAt: res.transfer.completesAt });
}
