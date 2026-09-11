// How someone the clan does not already have comes to have a seat in it.
//
// Four paths used to create one as a side effect — a plugin login, an account link, a verification
// check, a manual-review request. None of them asked anybody. Turning up once put you on a roster,
// which makes "membership is granted, never assumed" false at the guest tier, and a clan's roster
// is not a log of who has visited.
//
// So there is one function, `admit`, and every one of those paths calls it. What it does depends on
// the clan's policy, and the policy is a decision the clan made rather than a default nobody chose.

import { and, count, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanJoinRequests, clanMemberships, clanRoster, clanStaff, clans, users } from '@/db/schema';
import { isBannedFromClan } from '@/lib/clanBans';
import { findOrCreateSeat } from '@/lib/roster';

export type GuestPolicy = 'approval' | 'open' | 'closed';

export function isGuestPolicy(v: string | null | undefined): v is GuestPolicy {
  return v === 'approval' || v === 'open' || v === 'closed';
}

export async function guestPolicyOf(clanId: number): Promise<GuestPolicy> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { guestPolicy: true } });
  return isGuestPolicy(row?.guestPolicy) ? row.guestPolicy : 'approval';
}

/**
 * Does the person behind this account hold a staff seat in this clan?
 *
 * Asked through `users`, because staff is granted to a LOGIN and admission is about an ACCOUNT —
 * the two meet at the person. One indexed read, and only on the path that is about to file a
 * request, so it costs nothing for the members who are already seated.
 */
async function staffsThisClan(clanId: number, playerId: number): Promise<boolean> {
  const rows = await db
    .select({ id: clanStaff.id })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), eq(users.playerId, playerId)))
    .limit(1);
  return rows.length > 0;
}

export type AdmitResult =
  /** They already had a seat, or the clan is open and now they do. */
  | { outcome: 'seated'; seatId: number }
  /** A request is waiting for staff. No seat exists. */
  | { outcome: 'requested'; requestId: number }
  /** Already asked; still waiting. */
  | { outcome: 'pending'; requestId: number }
  /** The clan takes no guests, or has barred this person. */
  | { outcome: 'refused'; reason: 'closed' | 'banned' };

/**
 * Get this account a seat in this clan, or a request for one, or neither.
 *
 * IDEMPOTENT AND SIDE-EFFECT-SHY. Every caller is something that happens repeatedly — a login, a
 * poll — so asking twice must not produce two requests, and must not resurrect a seat someone
 * deliberately removed.
 *
 * An EXISTING seat is returned as-is, including a departed one: a person who left and came back is
 * the clan's decision to make again, and quietly re-seating them on their next login is how a
 * removal fails to stick.
 */
export async function admit(opts: {
  clanId: number;
  accountId: number;
  source?: 'web' | 'plugin';
  message?: string | null;
}): Promise<AdmitResult> {
  const { clanId, accountId } = opts;

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  const playerId = account?.playerId ?? null;

  if (await isBannedFromClan(clanId, playerId)) {
    return { outcome: 'refused', reason: 'banned' };
  }

  // Already seated here? Then there is nothing to admit — including when the seat is departed, which
  // is a decision this function must not quietly undo.
  const existing = await db.query.clanMemberships.findFirst({
    where: and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.accountId, accountId)),
  });
  if (existing && !existing.leftAt) return { outcome: 'seated', seatId: existing.id };

  // THE CLAN'S OWN STAFF ARE NOT GUESTS OF IT, and this is where that was being forgotten.
  //
  // `createClan` grants a clan_staff seat and no roster seat — it cannot grant one, since a roster
  // seat needs an ACCOUNT and a founder may not have linked a character yet. So the first time the
  // founder's plugin reported in, or they pressed apply on their own clan, they arrived here as
  // somebody nobody had heard of, met the default `approval` policy, and filed a join request
  // against the clan they had made thirty seconds earlier. The clan then sat there "pending" until
  // its owner went into /admin/people and approved themselves.
  //
  // Which is not a decision. Approval means "a human who runs this clan decides", and on a one-person
  // clan that human is the applicant; asking them is theatre with a queue in front of it. It is also
  // the exact first impression a new clan gets, so it reads as the product being broken.
  //
  // Staff, not owner: an admin or moderator the owner appointed is equally not applying to visit.
  if (playerId != null && (await staffsThisClan(clanId, playerId))) {
    const seatId = await findOrCreateSeat(clanId, accountId, { kind: 'member', source: 'admin' });
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));
    return { outcome: 'seated', seatId };
  }

  const policy = await guestPolicyOf(clanId);
  if (policy === 'closed') return { outcome: 'refused', reason: 'closed' };

  if (policy === 'open') {
    const seatId = await findOrCreateSeat(clanId, accountId, { kind: 'guest', source: 'application' });
    // findOrCreateSeat returns a departed row untouched, so bring it back explicitly — under `open`
    // that IS the clan's stated position on people turning up.
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));
    return { outcome: 'seated', seatId };
  }

  // approval — a request, and only one.
  const live = await db.query.clanJoinRequests.findFirst({
    where: and(
      eq(clanJoinRequests.clanId, clanId),
      eq(clanJoinRequests.accountId, accountId),
      eq(clanJoinRequests.status, 'pending'),
    ),
  });
  if (live) return { outcome: 'pending', requestId: live.id };

  const [created] = await db
    .insert(clanJoinRequests)
    .values({
      clanId,
      accountId,
      playerId,
      source: opts.source ?? 'web',
      message: opts.message?.trim().slice(0, 500) || null,
    })
    .returning();

  return { outcome: 'requested', requestId: created.id };
}

/** Accept a request: the seat is created here, and nowhere else. */
export async function approveRequest(
  requestId: number,
  clanId: number,
  byUserId: number,
): Promise<{ ok: true; seatId: number } | { ok: false; error: string }> {
  const req = await db.query.clanJoinRequests.findFirst({
    where: and(eq(clanJoinRequests.id, requestId), eq(clanJoinRequests.clanId, clanId)),
  });
  if (!req) return { ok: false, error: 'No such request' };
  if (req.status !== 'pending') return { ok: false, error: `Already ${req.status}` };

  if (await isBannedFromClan(clanId, req.playerId)) {
    return { ok: false, error: 'That person is banned from this clan — lift the ban first' };
  }

  const seatId = await findOrCreateSeat(clanId, req.accountId, { kind: 'guest', source: 'application' });
  await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));

  await db
    .update(clanJoinRequests)
    .set({ status: 'approved', decidedAt: new Date().toISOString(), decidedByUserId: byUserId })
    .where(eq(clanJoinRequests.id, requestId));

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      clanMemberId: seatId,
      eventType: 'guest_approved',
      actorUserId: byUserId,
      newValue: JSON.stringify({ requestId, accountId: req.accountId }),
    })
    .catch(() => {});

  return { ok: true, seatId };
}

export async function rejectRequest(
  requestId: number,
  clanId: number,
  byUserId: number,
  note?: string | null,
): Promise<boolean> {
  const [row] = await db
    .update(clanJoinRequests)
    .set({
      status: 'rejected',
      decidedAt: new Date().toISOString(),
      decidedByUserId: byUserId,
      decidedNote: note?.trim().slice(0, 500) || null,
    })
    .where(
      and(
        eq(clanJoinRequests.id, requestId),
        eq(clanJoinRequests.clanId, clanId),
        eq(clanJoinRequests.status, 'pending'),
      ),
    )
    .returning();
  if (!row) return false;

  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'guest_rejected',
      actorUserId: byUserId,
      newValue: JSON.stringify({ requestId, accountId: row.accountId, note: note ?? null }),
    })
    .catch(() => {});
  return true;
}

export interface PendingRequest {
  id: number;
  accountId: number;
  rsn: string;
  playerId: number | null;
  message: string | null;
  source: string;
  requestedAt: string;
  /** The clan they are a member of right now, if any — the most useful thing staff can be told. */
  memberOf: string | null;
}

/** What is waiting for this clan's staff. */
/**
 * How many are waiting, without building the rows.
 *
 * `pendingRequests` resolves each asker's home clan one query at a time, which is right for a screen
 * that shows them and wasteful for a dashboard that only needs the number.
 */
export async function pendingRequestCount(clanId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(clanJoinRequests)
    .where(and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.status, 'pending')));
  return row?.n ?? 0;
}

export async function pendingRequests(clanId: number): Promise<PendingRequest[]> {
  const rows = await db
    .select({
      id: clanJoinRequests.id,
      accountId: clanJoinRequests.accountId,
      playerId: clanJoinRequests.playerId,
      message: clanJoinRequests.message,
      source: clanJoinRequests.source,
      requestedAt: clanJoinRequests.requestedAt,
      rsn: accounts.rsn,
    })
    .from(clanJoinRequests)
    .innerJoin(accounts, eq(accounts.id, clanJoinRequests.accountId))
    .where(and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.status, 'pending')))
    .orderBy(desc(clanJoinRequests.requestedAt));

  return Promise.all(
    rows.map(async (r) => {
      // Where else this account sits. Visible without any sharing rule, because an account's CLAN is
      // not a private fact — it is on the in-game roster — and a clan deciding whether to admit a
      // guest is entitled to know they are somebody else's member.
      const member = await db
        .select({ name: clans.name })
        .from(clanMemberships)
        .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
        .where(
          and(
            eq(clanMemberships.accountId, r.accountId),
            eq(clanMemberships.kind, 'member'),
            isNull(clanMemberships.leftAt),
          ),
        )
        .limit(1)
        .then((x) => x[0] ?? null);

      return { ...r, memberOf: member?.name ?? null };
    }),
  );
}

/**
 * Claiming an account as a MEMBER of this clan, which it can only be in one place.
 *
 * The in-game roster is the evidence and an account cannot be in two clans, so a later sync is
 * simply the more current truth: the previous clan's seat DEMOTES to guest rather than the write
 * failing. Their history there survives, and that clan can remove them or they can leave.
 *
 * Without this the unique index would reject the sync outright, and a clan would find its roster
 * refusing to import a player who had transferred in — the common case, not an edge one.
 */
export async function claimMemberSeat(clanId: number, accountId: number): Promise<{ demotedFrom: number | null }> {
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const elsewhere = await db.query.clanMemberships.findFirst({
    where: and(
      eq(clanMemberships.accountId, accountId),
      eq(clanMemberships.kind, 'member'),
      isNull(clanMemberships.leftAt),
    ),
  });

  if (elsewhere && elsewhere.clanId !== clanId) {
    await db
      .update(clanMemberships)
      .set({ kind: 'guest' })
      .where(eq(clanMemberships.id, elsewhere.id));

    await db
      .insert(clanAuditLog)
      .values({
        clanId: elsewhere.clanId,
        clanMemberId: elsewhere.id,
        eventType: 'member_left_for_another_clan',
        newValue: JSON.stringify({ nowMemberOf: clanId }),
        notes: 'demoted to guest — an account is a member of one clan at a time',
      })
      .catch(() => {});

    return { demotedFrom: elsewhere.clanId };
  }

  return { demotedFrom: null };
}

/** Someone leaving a clan themselves. Their own seats only. */
export async function leaveClan(seatId: number, playerId: number): Promise<boolean> {
  // Read through the view — it is what carries the person and the RSN alongside the seat — but
  // select, not db.query: clan_roster is a view and drizzle's relational API only knows tables.
  const [seat] = await db
    .select({ id: clanRoster.id, clanId: clanRoster.clanId, rsn: clanRoster.rsn })
    .from(clanRoster)
    .where(and(eq(clanRoster.id, seatId), eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt)))
    .limit(1);
  if (!seat) return false;

  await db
    .update(clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(clanMemberships.id, seatId));

  await db
    .insert(clanAuditLog)
    .values({
      clanId: seat.clanId,
      clanMemberId: seatId,
      eventType: 'left',
      newValue: JSON.stringify({ rsn: seat.rsn, via: 'self' }),
    })
    .catch(() => {});
  return true;
}
