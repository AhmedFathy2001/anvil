import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { del } from '@vercel/blob';

// Final approval. Admin-only: even a treasurer who collected the fee can't sign off
// on their own collection — separation of duties.
//
// Side effect: deletes the proof blob and nulls `proofBlobUrl` so storage doesn't
// accumulate. Once confirmed there's no further dispute path that needs the
// screenshot, and the fee row keeps the audit trail (who collected, when, who
// confirmed).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ feeId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  if (fee.status === 'confirmed') {
    return NextResponse.json({ fee }); // idempotent
  }
  if (!fee.collectedByUserId) {
    return NextResponse.json(
      { error: 'No one has claimed collection on this fee yet' },
      { status: 400 },
    );
  }

  if (fee.proofBlobUrl) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  const [updated] = await db
    .update(signupFees)
    .set({
      status: 'confirmed',
      confirmedByUserId: session.userId,
      confirmedAt: new Date().toISOString(),
      proofBlobUrl: null,
    })
    .where(eq(signupFees.id, id))
    .returning();

  return NextResponse.json({ fee: updated });
}
