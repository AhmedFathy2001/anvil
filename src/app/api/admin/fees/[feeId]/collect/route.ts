import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyFeeCollector } from '@/lib/auth';
import { del } from '@vercel/blob';

// A treasurer/admin claims they collected the fee in-game and uploads proof.
//
// If the player previously self-reported a different collector → status flips to
// `disputed` so an admin reviews. Matching reports clear the dispute.
//
// Re-running collect (e.g. updating the screenshot) replaces the old proof and
// updates collectedByUserId — the latest collector is canonical.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ feeId: string }> },
) {
  const session = await verifyFeeCollector();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { feeId } = await params;
  const id = parseInt(feeId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    proofUrl?: string;
    notes?: string;
  } | null;
  if (!body || typeof body.proofUrl !== 'string' || !body.proofUrl) {
    return NextResponse.json({ error: 'proofUrl is required' }, { status: 400 });
  }

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, id) });
  if (!fee) {
    return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  }
  if (fee.status === 'confirmed') {
    return NextResponse.json(
      { error: 'Fee is already confirmed; reset before re-collecting' },
      { status: 409 },
    );
  }

  // If we're replacing an existing proof, clean up the previous blob first. Best-effort —
  // a failed delete shouldn't block the new collection from being recorded.
  if (fee.proofBlobUrl && fee.proofBlobUrl !== body.proofUrl) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  // Status: dispute when player's reported collector disagrees; collected otherwise.
  const playerReport = fee.reportedCollectorUserId;
  const status =
    playerReport !== null && playerReport !== session.userId ? 'disputed' : 'collected';

  const now = new Date().toISOString();
  const [updated] = await db
    .update(signupFees)
    .set({
      collectedByUserId: session.userId,
      collectedAt: now,
      proofBlobUrl: body.proofUrl,
      status,
      notes: body.notes ?? fee.notes,
    })
    .where(eq(signupFees.id, id))
    .returning();

  return NextResponse.json({ fee: updated });
}
