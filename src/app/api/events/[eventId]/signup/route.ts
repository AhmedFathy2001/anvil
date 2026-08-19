import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, events, players, signupFees, teamInvites, teams } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { generatePlayerToken, verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { parseProfile, sanitizeProfile, serializeProfile, signupWindowState, signupEditState } from '@/lib/signup';
import { checkInvite, isWellFormedToken } from '@/lib/teamInvites';
import { parseEventRules } from '@/lib/eventRules';

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

  // Team-choice events (rules.teamChoice): the host built the teams up front and applicants name
  // the one they're joining. Sent only when the rule is on, so a drafted event's form is unchanged.
  const rules = parseEventRules(event.rules);
  const choosableTeams = rules.teamChoice
    ? await db
        .select({ id: teams.id, name: teams.name, color: teams.color })
        .from(teams)
        .where(eq(teams.eventId, id))
        .orderBy(teams.name)
    : [];

  return NextResponse.json({
    teamChoice: rules.teamChoice,
    teams: choosableTeams,
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
  const rl = await rateLimit(request, 'signup', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

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
    clanMemberId?: number;      // legacy single-account form (still accepted)
    clanMemberIds?: number[];   // multi-account selection (up to event.maxAccountsPerPerson)
    profile?: Record<string, unknown>;
    inviteToken?: string;       // arrived through a team's invite link (lib/teamInvites)
    requestedTeamId?: number | null; // team-choice events: the team they're asking to join
  } | null;

  // Resolve the picked accounts: prefer the multi-account array, fall back to the legacy single id.
  const rawIds = Array.isArray(body?.clanMemberIds)
    ? body!.clanMemberIds
    : typeof body?.clanMemberId === 'number'
      ? [body!.clanMemberId]
      : [];
  const selectedIds = [...new Set(rawIds.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))];
  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one account' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const maxAccounts = event.maxAccountsPerPerson ?? 1;
  if (selectedIds.length > maxAccounts) {
    return NextResponse.json(
      { error: `This event allows at most ${maxAccounts} account${maxAccounts === 1 ? '' : 's'} per person.` },
      { status: 400 },
    );
  }

  // Every existing sign-up row this user has for the event (multi-account: possibly several).
  const existingRows = await db.query.eventSignups.findMany({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  // Editing (any active row present) gets the payment-deadline grace; a first sign-up or a re-join
  // after full withdrawal must be inside the normal window.
  const isEditingActive = existingRows.some((r) => r.status !== 'withdrawn');

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

  // AN INVITE (lib/teamInvites) re-checked here, never trusted from the page that rendered it: the
  // link may have been revoked, filled or expired between the form loading and this submit. It
  // decides two things and nothing else — the entry is approved without a host looking at it, and
  // every account in this submission lands on that team instead of the draft pool.
  let invite: typeof teamInvites.$inferSelect | null = null;
  const inviteToken = body?.inviteToken;
  if (isWellFormedToken(inviteToken)) {
    const row = await db.query.teamInvites.findFirst({ where: eq(teamInvites.token, inviteToken!) });
    const verdict = checkInvite(row, { now: Date.now(), eventId: id, signupsOpen: window.open });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.message, reason: verdict.refusal }, { status: 403 });
    }
    const team = row ? await db.query.teams.findFirst({ where: eq(teams.id, row.teamId) }) : null;
    if (!team || team.eventId !== id) {
      return NextResponse.json({ error: 'That invite is for a team that no longer exists.' }, { status: 403 });
    }
    invite = row!;
  }

  // Confirm every chosen account belongs to this user, is verified, and still in clan.
  const myAccounts = await db.query.clanMembers.findMany({
    where: and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
  });
  const accountById = new Map(myAccounts.map((a) => [a.id, a]));
  for (const cid of selectedIds) {
    const acc = accountById.get(cid);
    if (!acc) {
      return NextResponse.json({ error: 'Account not linked to your user' }, { status: 403 });
    }
    if (!acc.verifiedAt) {
      return NextResponse.json({ error: `${acc.rsn} must be verified before signing up` }, { status: 403 });
    }
  }

  // Deselected accounts (previously signed up, now unchecked) get withdrawn — but only when their fee
  // is untouched. A paid fee means money changed hands, so it needs an admin (mirrors DELETE). Check
  // up front so we never half-apply.
  const deselected = existingRows.filter((r) => !selectedIds.includes(r.clanMemberId) && r.status !== 'withdrawn');
  for (const r of deselected) {
    const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, r.id) });
    if (fee && fee.status !== 'pending') {
      const rsn = accountById.get(r.clanMemberId)?.rsn ?? 'An account';
      return NextResponse.json(
        { error: `${rsn}'s fee is already paid — contact an admin to remove that account.` },
        { status: 403 },
      );
    }
  }

  // One profile PER PERSON (option A): the answers live on the PRIMARY account's row; siblings carry
  // '{}' and inherit at read time. Primary = the user's primary account if it's among the picks, else
  // the first pick.
  const primaryId = selectedIds.find((cid) => accountById.get(cid)?.isPrimary === 1) ?? selectedIds[0];
  const profile = sanitizeProfile((body?.profile ?? {}) as Record<string, unknown>);
  const profileJson = serializeProfile(profile);
  const now = new Date().toISOString();
  const existingByMember = new Map(existingRows.map((r) => [r.clanMemberId, r]));
  const feePerAccount = (event.feeMode ?? 'per-person') === 'per-account';

  // 1) Withdraw the deselected accounts: soft-withdraw the row, drop the untouched fee + pool player.
  for (const r of deselected) {
    await db.update(eventSignups).set({ status: 'withdrawn', updatedAt: now }).where(eq(eventSignups.id, r.id));
    await db.delete(signupFees).where(eq(signupFees.signupId, r.id));
    await db.delete(players).where(and(eq(players.eventId, id), eq(players.clanMemberId, r.clanMemberId), isNull(players.teamId)));
  }

  // The team they asked for, on a team-choice event. Validated against THIS event's teams — an id
  // from another board would otherwise seat them somewhere they were never offered. It stays a
  // request either way: nothing here touches their player row, approval does that.
  const postRules = parseEventRules(event.rules);
  let requestedTeamId: number | null = null;
  if (postRules.teamChoice && typeof body?.requestedTeamId === 'number') {
    const wanted = await db.query.teams.findFirst({ where: eq(teams.id, body.requestedTeamId) });
    if (!wanted || wanted.eventId !== id) {
      return NextResponse.json({ error: 'That team is not in this event.' }, { status: 400 });
    }
    requestedTeamId = wanted.id;
  }

  // 2) Upsert each selected account (profile only on the primary), reactivating a withdrawn row.
  const rows: { row: typeof eventSignups.$inferSelect; account: (typeof myAccounts)[number] }[] = [];
  for (const cid of selectedIds) {
    const account = accountById.get(cid)!;
    const data = cid === primaryId ? profileJson : '{}';
    const prior = existingByMember.get(cid);
    let row;
    if (prior) {
      [row] = await db
        .update(eventSignups)
        .set({
          profileData: data,
          // Only ever written on a team-choice event; null elsewhere leaves a drafted sign-up alone.
          ...(postRules.teamChoice ? { requestedTeamId } : {}),
          updatedAt: now,
          ...(invite && prior.status !== 'approved'
            ? { status: 'approved' as const }
            : prior.status === 'withdrawn'
              ? { status: 'pending' as const }
              : {}),
        })
        .where(eq(eventSignups.id, prior.id))
        .returning();
    } else {
      [row] = await db
        .insert(eventSignups)
        .values({
          eventId: id,
          userId: session.userId,
          clanMemberId: cid,
          profileData: data,
          requestedTeamId,
          // The team that invited them already decided; there is nobody left to approve it.
          status: invite ? 'approved' : 'pending',
          signedUpAt: now,
          updatedAt: now,
        })
        .returning();
    }
    rows.push({ row, account });
  }

  // 3) For each active row: ensure its pool player (one per account) and its fee per feeMode.
  //    per-account → every account owes a fee; per-person → only the primary's row carries it.
  for (const { row, account } of rows) {
    if (row.status !== 'pending' && row.status !== 'approved') continue;

    const existingPlayer = await db.query.players.findFirst({
      where: and(eq(players.eventId, id), eq(players.clanMemberId, account.id)),
    });
    if (!existingPlayer) {
      await db.insert(players).values({
        eventId: id,
        clanMemberId: account.id,
        name: account.rsn,
        // An invite is a seat on ONE team, so the entry skips the pool entirely.
        teamId: invite ? invite.teamId : null,
        timezone: profile.timezone ?? null, // the person's tz applies to all their accounts
        playerToken: generatePlayerToken(),
      });
    } else if (invite && existingPlayer.teamId == null) {
      // Already in the pool (signed up first, invited after) — the link moves them onto the team.
      await db.update(players).set({ teamId: invite.teamId }).where(eq(players.id, existingPlayer.id));
    }

    if (event.signupFee && event.signupFee > 0) {
      const owesFee = feePerAccount || account.id === primaryId;
      const existingFee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, row.id) });
      if (owesFee && !existingFee) {
        await db.insert(signupFees).values({ signupId: row.id, amount: event.signupFee, status: 'pending' });
      } else if (!owesFee && existingFee && existingFee.status === 'pending') {
        // per-person mode: a sibling account shouldn't carry a fee — clear an untouched leftover.
        await db.delete(signupFees).where(eq(signupFees.id, existingFee.id));
      }
    }
  }

  // Spend a seat once per PERSON, not per account and not per edit: someone entering two accounts
  // through one link took one of the seats the host offered, and coming back to fix an answer took
  // none. `isEditingActive` is exactly "they were already in before this request".
  if (invite && !isEditingActive) {
    await db
      .update(teamInvites)
      .set({ uses: invite.uses + 1 })
      .where(eq(teamInvites.id, invite.id));
  }

  const primaryRow = rows.find((r) => r.account.id === primaryId)?.row ?? rows[0].row;
  return NextResponse.json({
    signup: { ...primaryRow, profile: parseProfile(primaryRow.profileData) },
    signups: rows.map(({ row }) => ({ ...row, profile: parseProfile(row.profileData) })),
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

  // Withdraw pulls the WHOLE person out — every account they entered (multi-account: possibly several).
  const existingRows = await db.query.eventSignups.findMany({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });
  const active = existingRows.filter((r) => r.status !== 'withdrawn');
  if (active.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // A fee that's been touched (reported/collected/confirmed/disputed) on ANY account means money has
  // changed hands — they can't just self-withdraw and vanish. Check them all first so we never leave
  // the person half-withdrawn. Only untouched 'pending' fees let them bail on their own.
  const feeBySignup = new Map<number, typeof signupFees.$inferSelect>();
  for (const r of active) {
    const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, r.id) });
    if (fee) {
      if (fee.status !== 'pending') {
        return NextResponse.json(
          { error: 'Your fee has already been paid — contact an admin to withdraw.' },
          { status: 403 },
        );
      }
      feeBySignup.set(r.id, fee);
    }
  }

  const now = new Date().toISOString();
  for (const r of active) {
    // Soft "withdraw" keeps the row for roster/audit history; drop the untouched fee + pool player.
    await db.update(eventSignups).set({ status: 'withdrawn', updatedAt: now }).where(eq(eventSignups.id, r.id));
    const fee = feeBySignup.get(r.id);
    if (fee) {
      await db.delete(signupFees).where(eq(signupFees.id, fee.id));
    }
    await db.delete(players).where(and(eq(players.eventId, id), eq(players.clanMemberId, r.clanMemberId), isNull(players.teamId)));
  }

  return NextResponse.json({ ok: true });
}
