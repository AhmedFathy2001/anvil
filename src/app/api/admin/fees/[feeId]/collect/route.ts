import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyFeeCollector } from '@/lib/auth';
import { del } from '@/lib/storage';
import { getRequiredConfirmations, recordFeeSettled, settlesOnCollect } from '@/lib/feeConfirmations';

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
  // Proof is now OPTIONAL — "Mark paid" can be a single tap, with a screenshot attached
  // only if the collector has one. A provided proofUrl must be a non-empty string.
  const proofUrl = typeof body?.proofUrl === 'string' && body.proofUrl ? body.proofUrl : null;

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

  // If we're replacing an existing proof with a different one, clean up the previous blob
  // first. Best-effort — a failed delete shouldn't block the collection from being recorded.
  if (fee.proofBlobUrl && proofUrl && fee.proofBlobUrl !== proofUrl) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  // Status: dispute when player's reported collector disagrees; collected otherwise.
  const playerReport = fee.reportedCollectorUserId;
  const disputed = playerReport !== null && playerReport !== session.userId;

  // A clan that requires no second signature is saying "marking it paid IS the sign-off", so the
  // fee settles here rather than landing in a queue nobody else can clear. A dispute still stops
  // it: that is a disagreement about who took the money, and it needs a human either way.
  const required = await getRequiredConfirmations();
  const settleNow = !disputed && settlesOnCollect(required);
  const status = disputed ? 'disputed' : settleNow ? 'confirmed' : 'collected';

  const now = new Date().toISOString();
  const [updated] = await db
    .update(signupFees)
    .set({
      collectedByUserId: session.userId,
      collectedAt: now,
      // Keep any existing proof when marking paid without a new upload. Note it is NOT dropped on
      // settling here: with no reviewer, the screenshot is the only record the money moved.
      proofBlobUrl: proofUrl ?? fee.proofBlobUrl,
      status,
      // Re-marking paid resets any confirmation tally — the fee changed hands again.
      confirmations: null,
      confirmedByUserId: settleNow ? session.userId : null,
      confirmedAt: settleNow ? now : null,
      notes: body?.notes ?? fee.notes,
    })
    .where(eq(signupFees.id, id))
    .returning();

  if (settleNow) {
    await recordFeeSettled(id, fee.signupId, fee.amount, session.userId, session.userId, {
      noSignature: true,
    });
  }

  return NextResponse.json({ fee: updated, settled: settleNow });
}
