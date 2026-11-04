// How someone the clan does not already have comes to have a seat in it.
//
// Four paths used to create one as a side effect — a plugin login, an account link, a verification
// check, a manual-review request. None of them asked anybody. Turning up once put you on a roster,
// which makes "membership is granted, never assumed" false at the guest tier, and a clan's roster
// is not a log of who has visited.
//
// So there is one function, `admit`, and every one of those paths calls it. What it does depends on
// the clan's policy, and the policy is a decision the clan made rather than a default nobody chose.

import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanJoinRequests, clanMemberships, clanRoster, clanStaff, clans, eventInvites, events, users } from '@/db/schema';
import { isBannedFromClan } from '@/lib/clanBans';
import { findOrCreateSeat } from '@/lib/roster';
import { clanKindOf, declinedRequestText, isCreatorSpace, seatsEventPlayers } from '@/lib/creatorSpaces';
import { seatEventPlayer } from '@/lib/eventPlayers';

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
  /** The clan takes no guests, or has barred this person — or (`fileRequest: false`) it would
   *  need a join request that the caller chose not to file. */
  | { outcome: 'refused'; reason: 'closed' | 'banned' | 'approval' | 'removed' };

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
  /**
   * False for BACKGROUND callers (a plugin play seating an alt): under `approval` they get
   * `refused/approval` instead of a join request nobody asked for — staff would otherwise see a
   * request every time somebody logged in a character.
   */
  fileRequest?: boolean;
  /**
   * The admission rule for THIS entry, when it is the event's to decide rather than the clan's: a
   * creator space's event says `open` or `approval` per event (lib/creatorSpaces). A clan that is
   * `closed` stays closed whatever is passed.
   */
  policy?: Exclude<GuestPolicy, 'closed'>;
}): Promise<AdmitResult> {
  const { clanId, accountId } = opts;

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  const playerId = account?.playerId ?? null;

  if (await isBannedFromClan(clanId, playerId)) {
    return { outcome: 'refused', reason: 'banned' };
  }

  // Already seated here? Then there is nothing to admit — including when the seat is departed, which
  // is a decision this function must not quietly undo.
  // Member and guest seats: an event player's seat (lib/eventPlayers) opens one event and is not a
  // place in the clan, so it neither counts as "already seated" here nor gets turned into one.
  const existing = await db.query.clanMemberships.findFirst({
    where: and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.accountId, accountId), ne(clanMemberships.kind, 'event')),
  });
  if (existing && !existing.leftAt) return { outcome: 'seated', seatId: existing.id };
  // A seat ended ON PURPOSE (`manual`: the person left, or staff said "not our member") stays ended
  // for everything automatic — a plugin login, a link, a verification. Only the person explicitly
  // asking again on the site (`source: 'web'`: apply, enter an event) reopens the question.
  if (existing?.leftAt && existing.source === 'manual' && opts.source !== 'web') {
    return { outcome: 'refused', reason: 'removed' };
  }

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
  //
  // In a CREATOR SPACE the seat is a guest one, like every other player's: there is no in-game clan
  // to be a member of, and a member seat would collide with the creator's real clan membership (an
  // account is a member of one clan at a time — `clan_memberships_one_member_seat`).
  const hostKind = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } });
  if (playerId != null && (await staffsThisClan(clanId, playerId))) {
    const seatId = await findOrCreateSeat(clanId, accountId, {
      // A friends host (lib/friendEventRules) the same: nobody is ever a member of one.
      kind: clanKindOf(hostKind?.kind) === 'clan' ? 'member' : 'guest',
      source: 'admin',
    });
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));
    return { outcome: 'seated', seatId };
  }

  const clanPolicy = await guestPolicyOf(clanId);
  if (clanPolicy === 'closed') return { outcome: 'refused', reason: 'closed' };
  const policy: GuestPolicy = opts.policy ?? clanPolicy;

  if (policy === 'open') {
    const seatId = await findOrCreateSeat(clanId, accountId, { kind: 'guest', source: 'application' });
    // findOrCreateSeat returns a departed row untouched, so bring it back explicitly — under `open`
    // that IS the clan's stated position on people turning up.
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));
    return { outcome: 'seated', seatId };
  }

  // approval — a request, and only one.
  if (opts.fileRequest === false) return { outcome: 'refused', reason: 'approval' };
  const live = await db.query.clanJoinRequests.findFirst({
    where: and(
      eq(clanJoinRequests.clanId, clanId),
      eq(clanJoinRequests.accountId, accountId),
      eq(clanJoinRequests.status, 'pending'),
      // Clan-wide requests only; a request to play one event is a different question.
      isNull(clanJoinRequests.eventId),
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

/**
 * Ask to play ONE event — a creator space's `approval` event (lib/eventEntry). No seat now; the host
 * answers it in the same queue as any request, and approving it seats them and invites them to
 * that event alone. One live request per account per event.
 */
export async function requestEventEntry(opts: {
  clanId: number;
  eventId: number;
  accountId: number;
  playerId: number;
  message?: string | null;
}): Promise<{ outcome: 'requested' | 'pending'; requestId: number }> {
  const live = await db.query.clanJoinRequests.findFirst({
    where: and(
      eq(clanJoinRequests.clanId, opts.clanId),
      eq(clanJoinRequests.accountId, opts.accountId),
      eq(clanJoinRequests.eventId, opts.eventId),
      eq(clanJoinRequests.status, 'pending'),
    ),
  });
  if (live) return { outcome: 'pending', requestId: live.id };
  const [created] = await db
    .insert(clanJoinRequests)
    .values({
      clanId: opts.clanId,
      accountId: opts.accountId,
      playerId: opts.playerId,
      eventId: opts.eventId,
      source: 'web',
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
    const kind = (await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } }))?.kind;
    return { ok: false, error: `That person is banned from this ${isCreatorSpace({ kind }) ? 'space' : 'clan'} — lift the ban first` };
  }

  // A request to play ONE streamed event (lib/eventEntry: a creator space's, or a Streaming clan's
  // event open to viewers) seats them as that event's PLAYER — an event seat, never a guest one. A
  // clan-wide request (no event) is a guest, as it always was.
  // clan-scope: this clan -- the request's own event, and only on this clan.
  const reqEvent =
    req.eventId != null
      ? await db.query.events.findFirst({ where: and(eq(events.id, req.eventId), eq(events.clanId, clanId)), columns: { id: true, openToViewers: true } })
      : undefined;
  const host = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true, streaming: true } });
  let seatId: number;
  if (reqEvent && seatsEventPlayers(host, reqEvent)) {
    seatId = await seatEventPlayer({ clanId, eventId: reqEvent.id, accountId: req.accountId });
  } else {
    seatId = await findOrCreateSeat(clanId, req.accountId, { kind: 'guest', source: 'application' });
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, seatId));
  }

  // The yes is also an invitation to that event, so its entry gates (lib/entryGatesDb) do not turn
  // away somebody the host has just accepted by name — and nothing wider.
  if (req.eventId != null && req.playerId != null) {
    const invited = await db.query.eventInvites.findFirst({
      where: and(eq(eventInvites.eventId, req.eventId), eq(eventInvites.playerId, req.playerId)),
    });
    if (!invited) {
      await db.insert(eventInvites).values({ eventId: req.eventId, playerId: req.playerId, invitedByUserId: byUserId, note: 'Approved request' });
    }
  }

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
  // A decline used to be silent: the row flipped and the person kept waiting on a request nobody
  // would ever answer. Their profile and the clan page now show it (latestDeclines); this tells them
  // directly when the clan's bot can reach them. Best effort and never awaited — a closed DM or a
  // clan with no bot must not fail the moderator's click.
  void notifyDeclined(clanId, row.accountId, row.playerId, row.eventId).catch(() => {});
  return true;
}

/** DM the person behind a declined request, through the clan's own bot. Returns whether it sent. */
async function notifyDeclined(
  clanId: number,
  accountId: number,
  playerId: number | null,
  eventId: number | null,
): Promise<boolean> {
  if (playerId == null) return false;
  const [clan, account, login, event] = await Promise.all([
    db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { name: true, slug: true, kind: true } }),
    db.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { rsn: true } }),
    db.query.users.findFirst({ where: eq(users.playerId, playerId), columns: { discordId: true } }),
    // clan-scope: the request's own event, and only on this clan (a creator space's per-event ask).
    eventId != null
      ? db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.clanId, clanId)), columns: { name: true } })
      : Promise.resolve(undefined),
  ]);
  if (!clan || !login?.discordId) return false;
  // Loaded here rather than at the top: the Discord client pulls in auth and settings, and every
  // admission path imports this file.
  const { discordRest, getBotTokenOnly } = await import('@/lib/discord-roles');
  const { absoluteUrl } = await import('@/lib/seo');
  const bot = await getBotTokenOnly(clanId);
  if (!bot) return false;
  const dm = await discordRest(bot.token, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: login.discordId }),
  });
  if (!dm.ok) return false;
  const channel = (await dm.json()) as { id: string };
  const res = await discordRest(bot.token, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      // A creator space says "your request to play", never "as a guest" (lib/creatorSpaces).
      content: declinedRequestText({
        kind: clan.kind,
        hostName: clan.name,
        rsn: account?.rsn,
        eventName: event?.name,
        clansUrl: absoluteUrl('/clans'),
      }),
      allowed_mentions: { parse: [] },
    }),
  });
  return res.ok;
}

export interface DoorState {
  /** Waiting on this clan's staff. */
  pending: boolean;
  /** When this clan last said no, if that is still the newest answer. */
  declinedAt: string | null;
}

/**
 * Where each of these characters stands at one clan's door, for the person's own pages — so a
 * request survives a reload as "asked", and a decline reads "Declined on <date>" instead of going
 * quiet. The NEWEST request per character decides: asking again after a no is pending again.
 * Characters with no request at all are absent from the map.
 */
export async function doorStates(clanId: number, accountIds: number[]): Promise<Map<number, DoorState>> {
  const out = new Map<number, DoorState>();
  if (accountIds.length === 0) return out;
  const rows = await db
    .select({
      accountId: clanJoinRequests.accountId,
      status: clanJoinRequests.status,
      decidedAt: clanJoinRequests.decidedAt,
    })
    .from(clanJoinRequests)
    .where(and(eq(clanJoinRequests.clanId, clanId), inArray(clanJoinRequests.accountId, accountIds)))
    .orderBy(desc(clanJoinRequests.id));
  for (const r of rows) {
    if (out.has(r.accountId)) continue;
    out.set(r.accountId, {
      pending: r.status === 'pending',
      declinedAt: r.status === 'rejected' ? r.decidedAt : null,
    });
  }
  return out;
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
  /** The one event they asked to play (a creator space's approval event); null = the whole clan. */
  eventId: number | null;
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

/** Waiting event-scoped requests, per event — the creator dashboard's "N waiting" badges. */
export async function pendingRequestCountsByEvent(clanId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ eventId: clanJoinRequests.eventId, n: count() })
    .from(clanJoinRequests)
    .where(and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.status, 'pending'), isNotNull(clanJoinRequests.eventId)))
    .groupBy(clanJoinRequests.eventId);
  return new Map(rows.flatMap((r) => (r.eventId == null ? [] : [[r.eventId, r.n] as [number, number]])));
}

/** What is waiting for this clan's staff; with `eventId`, only the requests to play that event. */
export async function pendingRequests(clanId: number, opts: { eventId?: number } = {}): Promise<PendingRequest[]> {
  const rows = await db
    .select({
      id: clanJoinRequests.id,
      accountId: clanJoinRequests.accountId,
      playerId: clanJoinRequests.playerId,
      message: clanJoinRequests.message,
      source: clanJoinRequests.source,
      requestedAt: clanJoinRequests.requestedAt,
      rsn: accounts.rsn,
      eventId: clanJoinRequests.eventId,
    })
    .from(clanJoinRequests)
    .innerJoin(accounts, eq(accounts.id, clanJoinRequests.accountId))
    .where(
      and(
        eq(clanJoinRequests.clanId, clanId),
        eq(clanJoinRequests.status, 'pending'),
        opts.eventId != null ? eq(clanJoinRequests.eventId, opts.eventId) : undefined,
      ),
    )
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
 * The OTHER clan this account is a member of, if any.
 *
 * An account is a member of one clan at a time (the `clan_memberships_one_member_seat` index). A
 * roster sync used to settle a conflict by demoting the other clan's seat to guest — "the later sync
 * is the more current truth". That made every sync a lever on OTHER clans: a clan created under a
 * real clan's name could push that clan's roster and quietly demote its members everywhere else.
 *
 * So a sync never moves a membership any more. Someone listed by this roster who is a member
 * elsewhere is seated here as a GUEST, and becomes a member here when they leave the other clan —
 * themselves (`leaveClan`), by that clan's own roster dropping them, or by platform staff. The next
 * sync then promotes them.
 */
export async function memberSeatElsewhere(clanId: number, accountId: number): Promise<number | null> {
  // clan-scope: global -- the one-member-seat rule spans clans by definition; this only reads which clan holds it.
  const elsewhere = await db.query.clanMemberships.findFirst({
    where: and(
      eq(clanMemberships.accountId, accountId),
      eq(clanMemberships.kind, 'member'),
      isNull(clanMemberships.leftAt),
    ),
    columns: { clanId: true },
  });
  return elsewhere && elsewhere.clanId !== clanId ? elsewhere.clanId : null;
}

/**
 * Someone leaving a clan themselves, one character at a time. Their own seats only.
 *
 * SAME RULE AS lib/leaveClan, which does it for the whole person: a seat the in-game roster is
 * holding open is not theirs to end — the next sync would put it straight back — and a seat they do
 * end is marked `source: 'manual'`, which is what stops the plugin's seat-keeping reviving it the
 * next time they log in. This one had neither, so leaving through it did not stick and nothing said
 * why. Two doors onto one decision have to agree about what the decision means.
 */
export async function leaveClan(seatId: number, playerId: number): Promise<boolean> {
  // Read through the view — it is what carries the person and the RSN alongside the seat — but
  // select, not db.query: clan_roster is a view and drizzle's relational API only knows tables.
  const [seat] = await db
    .select({
      id: clanRoster.id,
      clanId: clanRoster.clanId,
      rsn: clanRoster.rsn,
      kind: clanRoster.kind,
      source: clanRoster.source,
    })
    .from(clanRoster)
    .where(and(eq(clanRoster.id, seatId), eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt)))
    .limit(1);
  if (!seat) return false;
  // The in-game roster put them here, so the in-game roster is what takes them away.
  if (seat.kind === 'member' && seat.source === 'roster') return false;

  await db
    .update(clanMemberships)
    .set({ leftAt: new Date().toISOString(), source: 'manual' })
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
