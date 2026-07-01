import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// Manually flag a fee as disputed — e.g. a player says they paid but no collector claim
// exists, or the amount is contested. Any staff member can raise a dispute; an admin
// clears it with Reset (or by re-marking it paid). Distinct from the auto-dispute the
// collect route raises when a player's self-report names a different collector.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ feeId: string }> },
) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { feeId } = await params;
  const id = parseInt(feeId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { note?: string } | null;

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, id) });
  if (!fee) {
    return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  }
  if (fee.status === 'confirmed') {
    return NextResponse.json(
      { error: 'This fee is already confirmed — reset it before disputing.' },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(signupFees)
    .set({
      status: 'disputed',
      notes: body?.note?.trim() || fee.notes,
    })
    .where(eq(signupFees.id, id))
    .returning();

  return NextResponse.json({ fee: updated });
}
