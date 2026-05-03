import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, events, signupFees } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { parseProfile, sanitizeProfile, serializeProfile, signupWindowState } from '@/lib/signup';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Verified, currently-in-clan accounts the user owns. Unverified accounts can't be
  // used to sign up — verification is the gate that proves "this user controls this RSN".
  const myAccounts = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      isPrimary: clanMembers.isPrimary,
      verifiedAt: clanMembers.verifiedAt,
      verificationMethod: clanMembers.verificationMethod,
      provisional: clanMembers.provisional,
    })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.userId, session.userId),
        isNull(clanMembers.leftAt),
      ),
    )
    .orderBy(desc(clanMembers.isPrimary), desc(clanMembers.verifiedAt));

  // Existing signup for this user/event (if any).
  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });

  const fee = signup
    ? await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) })
    : null;

  // Prefill from the user's most recent prior signup (different event), so a returning
  // signup-form view shows their last answers as the starting point. Only computed when
  // the user hasn't already submitted for THIS event.
  let prefill: { clanMemberId: number | null; profile: ReturnType<typeof parseProfile> } | null =
    null;
  if (!signup) {
    const prior = await db.query.eventSignups.findFirst({
      where: eq(eventSignups.userId, session.userId),
      orderBy: (s, { desc }) => [desc(s.signedUpAt)],
    });
    if (prior) {
      prefill = {
        clanMemberId: prior.clanMemberId,
        profile: parseProfile(prior.profileData),
      };
    }
  }

  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
  });

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      signupFee: event.signupFee,
      signupOpensAt: event.signupOpensAt,
      signupDeadline: event.signupDeadline,
      captainSelectionDeadline: event.captainSelectionDeadline,
      startDate: event.startDate,
    },
    window,
    myAccounts,
    signup: signup
      ? {
          ...signup,
          profile: parseProfile(signup.profileData),
        }
      : null,
    fee,
    prefill,
  });
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
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    clanMemberId?: number;
    profile?: Record<string, unknown>;
  } | null;

  if (!body || typeof body.clanMemberId !== 'number') {
    return NextResponse.json({ error: 'clanMemberId is required' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
  });
  if (!window.open) {
    return NextResponse.json(
      { error: 'Signups are not open', reason: window.reason },
      { status: 403 },
    );
  }

  // Confirm the chosen RSN belongs to this user, is verified, and still in clan.
  const account = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.id, body.clanMemberId),
      eq(clanMembers.userId, session.userId),
      isNull(clanMembers.leftAt),
    ),
  });
  if (!account) {
    return NextResponse.json({ error: 'Account not linked to your user' }, { status: 403 });
  }
  if (!account.verifiedAt) {
    return NextResponse.json(
      { error: 'Account must be verified before signing up' },
      { status: 403 },
    );
  }

  const profile = sanitizeProfile((body.profile ?? {}) as Record<string, unknown>);
  const profileJson = serializeProfile(profile);
  const now = new Date().toISOString();

  // Upsert: edit if a signup already exists, else insert. We don't allow status changes
  // through this endpoint — admin/mod actions live elsewhere.
  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });

  let signupRow;
  if (existing) {
    [signupRow] = await db
      .update(eventSignups)
      .set({
        clanMemberId: body.clanMemberId,
        profileData: profileJson,
        updatedAt: now,
      })
      .where(eq(eventSignups.id, existing.id))
      .returning();
  } else {
    [signupRow] = await db
      .insert(eventSignups)
      .values({
        eventId: id,
        userId: session.userId,
        clanMemberId: body.clanMemberId,
        profileData: profileJson,
        status: 'pending',
        signedUpAt: now,
        updatedAt: now,
      })
      .returning();

    // Auto-create a fee row when the event has a fee. Keeping a 1:1 row even for free
    // events would be noise — easier to gate on event.signupFee everywhere if it's null.
    if (event.signupFee && event.signupFee > 0) {
      await db.insert(signupFees).values({
        signupId: signupRow.id,
        amount: event.signupFee,
        status: 'pending',
      });
    }
  }

  return NextResponse.json({
    signup: {
      ...signupRow,
      profile: parseProfile(signupRow.profileData),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Withdrawal is only permitted before signups close. After that the user has to
  // talk to a mod — preserves the audit trail when fees are involved.
  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
  });
  if (!window.open) {
    return NextResponse.json(
      { error: 'Signups are closed; contact a moderator to withdraw', reason: window.reason },
      { status: 403 },
    );
  }

  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  // Soft "withdraw" instead of delete: we keep the row so the event roster and audit
  // history stay intact even after a player drops. Fee row (if any) hangs around for
  // refund tracking; only admin can clear it.
  await db
    .update(eventSignups)
    .set({ status: 'withdrawn', updatedAt: new Date().toISOString() })
    .where(eq(eventSignups.id, existing.id));

  return NextResponse.json({ ok: true });
}
