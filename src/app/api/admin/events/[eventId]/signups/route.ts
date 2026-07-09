import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, events, eventSignups, players, signupFees, teams, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { generatePlayerToken, verifyAdminOrModerator, verifyUser } from '@/lib/auth';
import { parseProfile, sanitizeProfile, serializeProfile } from '@/lib/signup';
import { parseConfirmations } from '@/lib/feeConfirmations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const rows = await db
    .select({
      signup: eventSignups,
      fee: signupFees,
      user: {
        id: users.id,
        displayName: users.displayName,
        discordUsername: users.discordUsername,
        role: users.role,
      },
      account: {
        id: clanMembers.id,
        rsn: clanMembers.rsn,
      },
    })
    .from(eventSignups)
    // LEFT join so guest sign-ups (no linked user) still list — they show by RSN from `account`.
    .leftJoin(users, eq(eventSignups.userId, users.id))
    .innerJoin(clanMembers, eq(eventSignups.clanMemberId, clanMembers.id))
    .leftJoin(signupFees, eq(signupFees.signupId, eventSignups.id))
    .where(eq(eventSignups.eventId, id));

  // Look up which signup users captain a team in this event so the UI can render
  // captain-only actions (demote) without an extra round-trip.
  const eventTeams = await db
    .select({ id: teams.id, name: teams.name, color: teams.color, captainUserId: teams.captainUserId })
    .from(teams)
    .where(eq(teams.eventId, id));
  const captainTeamByUser = new Map<number, { id: number; name: string; color: string }>();
  for (const t of eventTeams) {
    if (t.captainUserId !== null) {
      captainTeamByUser.set(t.captainUserId, { id: t.id, name: t.name, color: t.color });
    }
  }

  const signups = rows.map((r) => ({
    id: r.signup.id,
    status: r.signup.status,
    signedUpAt: r.signup.signedUpAt,
    updatedAt: r.signup.updatedAt,
    profile: parseProfile(r.signup.profileData),
    // Guest sign-ups have no user row (left join → null fields); surface user as null.
    user: r.user && r.user.id != null ? r.user : null,
    account: r.account,
    captainTeam: r.user && r.user.id != null ? captainTeamByUser.get(r.user.id) ?? null : null,
    fee: r.fee
      ? {
          id: r.fee.id,
          amount: r.fee.amount,
          status: r.fee.status,
          collectedByUserId: r.fee.collectedByUserId,
          reportedCollectorUserId: r.fee.reportedCollectorUserId,
          proofBlobUrl: r.fee.proofBlobUrl,
          confirmedAt: r.fee.confirmedAt,
          // Number of distinct staff confirmations so far (for the "x/N" pill).
          confirmationsCount: parseConfirmations(r.fee.confirmations).length,
          notes: r.fee.notes,
        }
      : null,
  }));

  return NextResponse.json({ signups });
}

// Admin-only: sign a member up on their behalf and fill in their answers. Exists for the
// "they told me their availability on Discord but won't touch the site" case — so it
// deliberately skips the sign-up window checks and the account-verification requirement
// that gate the self-serve flow. Defaults straight to 'approved' (the admin adding them IS
// the approval), and mirrors the self-serve side effects: fee row when the event has a
// fee, draft-pool player row, audit-log entry.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    clanMemberId?: number;
    profile?: Record<string, unknown>;
    status?: 'pending' | 'approved';
  } | null;
  if (!body || typeof body.clanMemberId !== 'number') {
    return NextResponse.json({ error: 'clanMemberId is required' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const account = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.id, body.clanMemberId), isNull(clanMembers.leftAt)),
  });
  if (!account) {
    return NextResponse.json({ error: 'Clan member not found' }, { status: 404 });
  }
  // A linked member's sign-up hangs off their users row; an unlinked in-game member gets a
  // GUEST sign-up (userId null) so they still show up + stay consistent with the draft pool.
  const userId = account.userId; // may be null → guest sign-up

  // Dedup: linked → one per (event, user); guest → one per (event, clan member).
  const existing = await db.query.eventSignups.findFirst({
    where:
      userId != null
        ? and(eq(eventSignups.eventId, id), eq(eventSignups.userId, userId))
        : and(eq(eventSignups.eventId, id), eq(eventSignups.clanMemberId, body.clanMemberId)),
  });
  if (existing && existing.status !== 'withdrawn') {
    return NextResponse.json(
      { error: `This member already has a ${existing.status} sign-up — edit their answers instead.` },
      { status: 409 },
    );
  }

  const status = body.status === 'pending' ? 'pending' : 'approved';
  const profile = sanitizeProfile((body.profile ?? {}) as Record<string, unknown>);
  const profileJson = serializeProfile(profile);
  const now = new Date().toISOString();

  // A withdrawn sign-up is revived in place (the unique (event, user) index means we
  // can't insert a second row) — same as the self-serve re-join path.
  let signupRow;
  if (existing) {
    [signupRow] = await db
      .update(eventSignups)
      .set({ clanMemberId: body.clanMemberId, profileData: profileJson, status, updatedAt: now })
      .where(eq(eventSignups.id, existing.id))
      .returning();
  } else {
    [signupRow] = await db
      .insert(eventSignups)
      .values({
        eventId: id,
        userId,
        clanMemberId: body.clanMemberId,
        profileData: profileJson,
        status,
        signedUpAt: now,
        updatedAt: now,
      })
      .returning();
  }

  // Mirror the self-serve flow's side effects (see /api/events/[eventId]/signup POST):
  // fee row only when the event charges one, draft-pool row idempotently.
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

  const existingPlayer = await db.query.players.findFirst({
    where: and(eq(players.eventId, id), eq(players.clanMemberId, body.clanMemberId)),
  });
  if (!existingPlayer) {
    await db.insert(players).values({
      eventId: id,
      clanMemberId: body.clanMemberId,
      name: account.rsn,
      timezone: profile.timezone ?? null,
      playerToken: generatePlayerToken(),
    });
  }

  db.insert(clanAuditLog)
    .values({
      clanMemberId: body.clanMemberId,
      eventType: 'signup_admin_added',
      newValue: JSON.stringify({ eventId: id, signupId: signupRow.id, status }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  return NextResponse.json({
    signup: { ...signupRow, profile: parseProfile(signupRow.profileData) },
  });
}
