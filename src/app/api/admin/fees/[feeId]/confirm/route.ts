import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { applyFeeConfirmation } from '@/lib/feeConfirmations';

// A confirmation vote. Admin-only, and separation of duties still holds: the collector
// can't confirm their own collection, and each admin can only confirm once. The fee only
// flips to 'confirmed' (and its proof is deleted) once it has collected enough distinct
// confirmations to meet the `fee_confirmations_required` setting (default 1 = today's
// behaviour). Below the threshold the vote is just recorded and the fee stays 'collected'.
//
// The rules themselves live in lib/feeConfirmations so this route, the bulk "confirm all" action
// and the end-of-event auto-close all apply exactly the same ones.
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

  // FORCE: settle it now, whatever the rule says. An admin who is the only person handling money
  // can otherwise never close a fee they collected themselves — the second signature is never
  // coming, and the alternatives are lying about who collected it or leaving it open forever. It
  // stays deliberate (a separate button, admin only) and it lands in the audit line below.
  const force = (await _request.json().catch(() => null))?.force === true;
  const result = await applyFeeConfirmation(id, session.userId, force ? { auto: true } : undefined);
  if (result.outcome === 'own-collection') {
    return NextResponse.json(
      { error: "You collected this fee, so another admin must confirm it." },
      { status: 403 },
    );
  }
  if (result.outcome === 'not-collected') {
    return NextResponse.json({ error: 'No one has marked this fee paid yet' }, { status: 400 });
  }

  const updated = await db.query.signupFees.findFirst({ where: eq(signupFees.id, id) });
  return NextResponse.json({
    fee: updated,
    confirmationsCount: result.confirmations,
    required: result.required,
  });
}
