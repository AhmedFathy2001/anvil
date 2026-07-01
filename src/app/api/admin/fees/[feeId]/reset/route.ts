import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { del } from '@/lib/storage';

// Admin escape hatch — wipes collection state on a fee. Used when a collection was
// recorded against the wrong person, the screenshot was bad, or a confirmed fee needs
// to be reopened (e.g. refund). Player's payment report (reportedCollectorUserId) is
// preserved because that's their own statement — only the staff side gets reset.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ feeId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { feeId } = await params;
  const id = parseInt(feeId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });
  }

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, id) });
  if (!fee) {
    return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  }

  if (fee.proofBlobUrl) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  // Recompute starting status based on whether the player has a standing report.
  const nextStatus = fee.reportedCollectorUserId !== null ? 'reported' : 'pending';

  const [updated] = await db
    .update(signupFees)
    .set({
      status: nextStatus,
      collectedByUserId: null,
      collectedAt: null,
      proofBlobUrl: null,
      confirmedByUserId: null,
      confirmedAt: null,
      confirmations: null,
    })
    .where(eq(signupFees.id, id))
    .returning();

  return NextResponse.json({ fee: updated });
}
