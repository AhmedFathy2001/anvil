import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyFeeCollector } from '@/lib/auth';
import { markFeeCollected } from '@/lib/feeConfirmations';

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

  // The dispute rule, the settle-on-collect rule and the audit line live in lib/feeConfirmations,
  // shared with the team-staff route so the two can't drift apart.
  const { fee: updated, settled } = await markFeeCollected(fee, session.userId, {
    proofUrl,
    notes: body?.notes ?? null,
  });

  return NextResponse.json({ fee: updated, settled });
}
