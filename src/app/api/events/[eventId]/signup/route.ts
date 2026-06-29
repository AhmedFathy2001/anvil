import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, events, players, signupFees } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { generatePlayerToken, verifyUser } from '@/lib/auth';
import { parseProfile, sanitizeProfile, serializeProfile, signupWindowState, signupEditState } from '@/lib/signup';

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

  // Whether this is an edit of an existing active sign-up decides the window: editing gets
  // the payment-deadline grace period (keep tweaking answers + pay until then); a new
  // sign-up or a re-join after withdrawal must be inside the normal sign-up window.
  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  const isEditingActive = !!existing && existing.status !== 'withdrawn';

  const window = isEditingActive
    ? signupEditState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
        paymentDeadline: event.paymentDeadline,
      })
    : signupWindowState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
      });
  if (!window.open) {
    return NextResponse.json(
      {
        error: isEditingActive ? 'Editing is closed for this sign-up' : 'Signups are not open',
        reason: window.reason,
      },
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
  //
  // Re-signing up after a withdrawal flips the row back to 'pending'. Other statuses
  // (approved/rejected) are left to admin actions — editing answers shouldn't silently
  // re-open a rejected sign-up or downgrade an approved one.
  const isReactivation = !!existing && existing.status === 'withdrawn';

  let signupRow;
  if (existing) {
    [signupRow] = await db
      .update(eventSignups)
      .set({
        clanMemberId: body.clanMemberId,
        profileData: profileJson,
        updatedAt: now,
        ...(isReactivation ? { status: 'pending' as const } : {}),
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
  }

  // For an active sign-up (new or re-activated), make sure the fee request and the
  // draft-pool player row both exist. Withdrawal deletes the pending fee + pool row, so
  // this is what restores them on a re-signup. Both inserts are idempotent (skip when a
  // row already exists), so this is also a no-op for ordinary answer edits. Skipped for
  // rejected sign-ups so a rejected user can't re-add themselves by editing the form.
  const isActive = signupRow.status === 'pending' || signupRow.status === 'approved';
  if (isActive) {
    // Auto-create a fee row when the event has a fee. Keeping a 1:1 row even for free
    // events would be noise — easier to gate on event.signupFee everywhere if it's null.
    if (event.signupFee && event.signupFee > 0) {
      const existingFee = await db.query.signupFees.findFirst({
        where: eq(signupFees.signupId, signupRow.id),
      });
      if (!existingFee) {
        await db.insert(signupFees).values({
          signupId: signupRow.id,
          amount: event.signupFee,
          status: 'pending',
        });
      }
    }

    // Auto-add the signed-up player to the event's draft pool. Mirrors the bulk
    // promote-pool admin action, just at signup time so the pool fills itself as
    // the form is filled. Idempotent: skip when a player row already exists for
    // this clan member in this event (e.g. captain promoted directly, or the
    // admin manually added them earlier).
    const existingPlayer = await db.query.players.findFirst({
      where: and(eq(players.eventId, id), eq(players.clanMemberId, body.clanMemberId)),
    });
    if (!existingPlayer) {
      await db.insert(players).values({
        eventId: id,
        clanMemberId: body.clanMemberId,
        name: account.rsn,
        // Seed the per-player timezone from the signup so captains see it on the draft
        // board. Only set at creation — later admin edits to the player row win.
        timezone: profile.timezone ?? null,
        playerToken: generatePlayerToken(),
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

  // Self-withdrawal is only available until teams get picked. Once the draft is under
  // way (or done), the roster is locked — they have to contact a mod to be removed.
  if (event.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams have already been picked; contact a moderator to withdraw' },
      { status: 403 },
    );
  }

  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  // A fee that's been touched (reported/collected/confirmed/disputed) means money has
  // changed hands — they can't just self-withdraw and vanish. They contact an admin, who
  // removes them manually and handles the refund. Only an untouched 'pending' fee lets
  // them bail on their own.
  const fee = await db.query.signupFees.findFirst({
    where: eq(signupFees.signupId, existing.id),
  });
  if (fee && fee.status !== 'pending') {
    return NextResponse.json(
      { error: 'Your fee has already been paid — contact an admin to withdraw.' },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  // Soft "withdraw" instead of delete: we keep the sign-up row so the roster and audit
  // history stay intact even after a player drops.
  await db
    .update(eventSignups)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(eq(eventSignups.id, existing.id));

  // Remove the (untouched) fee request entirely — nothing to track once they're out, and
  // it keeps the fee queue clean. A re-signup before the deadline re-creates it.
  if (fee) {
    await db.delete(signupFees).where(eq(signupFees.id, fee.id));
  }

  // Pull them back out of the pool. Pre-draft they can't be on a team yet, but we keep
  // the teamId guard for safety/consistency with the admin path.
  await db
    .delete(players)
    .where(
      and(
        eq(players.eventId, id),
        eq(players.clanMemberId, existing.clanMemberId),
        isNull(players.teamId),
      ),
    );

  return NextResponse.json({ ok: true });
}
