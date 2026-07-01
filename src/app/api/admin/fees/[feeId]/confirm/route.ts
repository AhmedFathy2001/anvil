import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, eventSignups, signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { del } from '@/lib/storage';
import { getRequiredConfirmations, parseConfirmations } from '@/lib/feeConfirmations';

// A confirmation vote. Admin-only, and separation of duties still holds: the collector
// can't confirm their own collection, and each admin can only confirm once. The fee only
// flips to 'confirmed' (and its proof is deleted) once it has collected enough distinct
// confirmations to meet the `fee_confirmations_required` setting (default 1 = today's
// behaviour). Below the threshold the vote is just recorded and the fee stays 'collected'.
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
      { error: 'No one has marked this fee paid yet' },
      { status: 400 },
    );
  }
  // Separation of duties — the person who collected can't also sign off on it.
  if (fee.collectedByUserId === session.userId) {
    return NextResponse.json(
      { error: "You collected this fee, so another admin must confirm it." },
      { status: 403 },
    );
  }

  const required = await getRequiredConfirmations();
  const confirmations = parseConfirmations(fee.confirmations);

  if (confirmations.some((c) => c.userId === session.userId)) {
    return NextResponse.json({ fee }); // already confirmed by this admin — no double count
  }

  confirmations.push({ userId: session.userId, at: new Date().toISOString() });
  const met = confirmations.length >= required;

  // Below threshold: record the vote, stay 'collected'. At/above: settle + clean up proof.
  if (fee.proofBlobUrl && met) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  const [updated] = await db
    .update(signupFees)
    .set({
      confirmations: JSON.stringify(confirmations),
      status: met ? 'confirmed' : fee.status,
      confirmedByUserId: met ? session.userId : null,
      confirmedAt: met ? new Date().toISOString() : null,
      proofBlobUrl: met ? null : fee.proofBlobUrl,
    })
    .where(eq(signupFees.id, id))
    .returning();

  if (met) {
    // Central audit entry so the dashboard/audit feed names who signed off on the fee.
    const signup = await db.query.eventSignups.findFirst({
      where: eq(eventSignups.id, fee.signupId),
    });
    db.insert(clanAuditLog)
      .values({
        clanMemberId: signup?.clanMemberId ?? null,
        eventType: 'fee_confirmed',
        newValue: JSON.stringify({ feeId: id, amount: fee.amount, collectedByUserId: fee.collectedByUserId }),
        actorUserId: session.userId > 0 ? session.userId : null,
      })
      .catch(() => {});
  }

  return NextResponse.json({ fee: updated, confirmationsCount: confirmations.length, required });
}
