import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventSignups, signupFees, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// Returns the list of staff who can collect fees, plus the authenticated user's
// own existing payment report (if any) so the form can pre-populate.
//
// The picker intentionally surfaces all staff who *could* collect — admins and
// treasurers — so a player who handed off gp to whoever happened to be online
// can pick that person without guessing the role.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const collectors = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.role, ['admin', 'treasurer']));

  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });

  const fee = signup
    ? await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) })
    : null;

  return NextResponse.json({ collectors, fee });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  // body.collectorUserId === null clears a previous report (player retracts the claim).
  const body = (await request.json().catch(() => null)) as {
    collectorUserId: number | null;
  } | null;
  if (!body || (body.collectorUserId !== null && typeof body.collectorUserId !== 'number')) {
    return NextResponse.json(
      { error: 'collectorUserId must be a number or null' },
      { status: 400 },
    );
  }

  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  if (!signup) {
    return NextResponse.json({ error: 'Sign up first before reporting a payment' }, { status: 404 });
  }

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) });
  if (!fee) {
    return NextResponse.json({ error: 'No fee on this sign-up' }, { status: 404 });
  }

  if (body.collectorUserId !== null) {
    const collector = await db.query.users.findFirst({ where: eq(users.id, body.collectorUserId) });
    if (!collector || (collector.role !== 'admin' && collector.role !== 'treasurer')) {
      return NextResponse.json(
        { error: 'Selected user is not authorized to collect fees' },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();
  // Status transitions for player reports:
  //   pending → reported           (no collector claim yet)
  //   collected → disputed         (collector already claimed; player report disagrees)
  //   collected → collected        (player confirms the same collector — clears any dispute)
  //   confirmed → confirmed        (admin already finalized; report is informational)
  //   any → reported (cleared)     (player retracts: only allowed when not collected/confirmed)
  let nextStatus = fee.status;
  if (body.collectorUserId === null) {
    if (fee.status === 'reported') nextStatus = 'pending';
  } else if (fee.status === 'pending' || fee.status === 'reported') {
    nextStatus = 'reported';
  } else if (fee.status === 'collected' || fee.status === 'disputed') {
    nextStatus =
      fee.collectedByUserId !== null && fee.collectedByUserId === body.collectorUserId
        ? 'collected'
        : 'disputed';
  }

  const [updated] = await db
    .update(signupFees)
    .set({
      reportedCollectorUserId: body.collectorUserId,
      reportedAt: body.collectorUserId === null ? null : now,
      status: nextStatus,
    })
    .where(eq(signupFees.id, fee.id))
    .returning();

  return NextResponse.json({ fee: updated });
}
