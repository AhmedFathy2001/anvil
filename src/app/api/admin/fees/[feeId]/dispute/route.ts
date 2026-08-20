import { NextResponse } from 'next/server';
import { db } from '@/db';
import { signupFees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator, verifyEventTreasurer } from '@/lib/auth';
import { eventIdForFee } from '@/lib/feeConfirmations';

// Manually flag a fee as disputed — e.g. a player says they paid but no collector claim
// exists, or the amount is contested. Any staff member can raise a dispute; an admin
// clears it with Reset (or by re-marking it paid). Distinct from the auto-dispute the
// collect route raises when a player's self-report names a different collector.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ feeId: string }> },
) {
  const { feeId } = await params;
  const id = parseInt(feeId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });
  }

  // Clan staff anywhere, or the treasurer of the board this fee belongs to. Raising a dispute is
  // the one money action that has to stay available to whoever noticed the problem.
  const eventId = await eventIdForFee(id);
  const session =
    (await verifyAdminOrModerator()) ?? (eventId != null ? await verifyEventTreasurer(eventId) : null);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
