// Event players — the seats viewers get for ONE streamed event (rules: lib/seatKinds).
//
// A viewer who joins a streamed event (a creator space's, or a clan's with Streaming on) is seated
// here as kind 'event' with the event's id: enough for sign-ups, teams, scoring and the plugin (all of
// which key on the seat id), and nothing more — the seat opens no other event, is on no roster or
// guest list, and counts toward no member cap. When the event ends the seat closes; the row stays,
// with the sign-up, team and result beside it, as the host's "Past viewers".
//
// The host can promote one to a guest ("Make guest") and send a guest back to being an event player
// of one event. Bans stay clan-wide (lib/clanBans closes every live seat, event seats included).

import { and, asc, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanAuditLog,
  clanMemberships,
  eventParticipants,
  eventSignups,
  events,
  playerEventFacts,
  teams,
} from '@/db/schema';
import { isBannedFromClan } from '@/lib/clanBans';
import { eventTimeState } from '@/lib/eventTime';

function eventOver(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }, now = Date.now()): boolean {
  const phase = eventTimeState({ startDate: e.startDate, endDate: e.endDate, forceEndedAt: e.forceEndedAt, now }).phase;
  return phase === 'ended' || phase === 'force-ended';
}

/**
 * Seat this account as an event player of this event, or re-open its seat there. Returns the seat id.
 *
 * Idempotent: one event seat per (clan, account, event) — the partial unique index in drizzle/0203 —
 * so a double press, or two tabs, end on the same row. The caller has already decided the person may
 * enter (lib/eventEntry: visibility, ban, gates, approval, room).
 */
export async function seatEventPlayer(opts: { clanId: number; eventId: number; accountId: number }): Promise<number> {
  const find = () =>
    db.query.clanMemberships.findFirst({
      where: and(
        eq(clanMemberships.clanId, opts.clanId),
        eq(clanMemberships.accountId, opts.accountId),
        eq(clanMemberships.kind, 'event'),
        eq(clanMemberships.eventId, opts.eventId),
      ),
      columns: { id: true, leftAt: true },
    });
  const existing = await find();
  if (existing) {
    if (existing.leftAt) await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, existing.id));
    return existing.id;
  }
  const [made] = await db
    .insert(clanMemberships)
    .values({ clanId: opts.clanId, accountId: opts.accountId, kind: 'event', eventId: opts.eventId, source: 'application' })
    .onConflictDoNothing()
    .returning({ id: clanMemberships.id });
  if (made) return made.id;
  // Lost a race with the same press from another tab: theirs is the seat.
  const raced = await find();
  if (!raced) throw new Error('event seat vanished');
  if (raced.leftAt) await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, raced.id));
  return raced.id;
}

/**
 * Close the event seats of events that are over. The row stays (Past viewers); only `left_at` is set,
 * so the seat stops offering sign-ups, the plugin stops treating it as live, and nothing reopens it
 * but the viewer entering again. Run from the lifecycle cron; cheap — it only reads live event seats.
 */
export async function closeFinishedEventSeats(now = Date.now()): Promise<number> {
  // clan-scope: global -- the sweep runs for every clan; each seat is closed against its own event.
  const live = await db
    .select({
      eventId: clanMemberships.eventId,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(clanMemberships)
    .innerJoin(events, eq(events.id, clanMemberships.eventId))
    .where(and(eq(clanMemberships.kind, 'event'), isNull(clanMemberships.leftAt)))
    .groupBy(clanMemberships.eventId, events.startDate, events.endDate, events.forceEndedAt);
  const over = live.filter((e) => e.eventId != null && eventOver(e, now)).map((e) => e.eventId!);
  if (over.length === 0) return 0;
  // clan-scope: global -- by the event ids just read, each seat in its own event's clan.
  const closed = await db
    .update(clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(and(eq(clanMemberships.kind, 'event'), inArray(clanMemberships.eventId, over), isNull(clanMemberships.leftAt)))
    .returning({ id: clanMemberships.id });
  return closed.length;
}

export type SeatChange = { ok: true; seatId: number } | { ok: false; error: string };

/**
 * "Make guest": an event player becomes a guest of the clan. Their event seat stays as it is (it is
 * still the seat their sign-up for that event sits on, and the record in Past viewers); what changes
 * is that they now also hold a guest seat, which lets them into the clan's other guest-open events.
 * An earlier member/guest seat they left is brought back as a guest one rather than duplicated.
 */
export async function makeGuest(clanId: number, eventSeatId: number, byUserId: number | null): Promise<SeatChange> {
  // clan-scope: this clan -- the seat must be this clan's own.
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(clanMemberships.id, eventSeatId), eq(clanMemberships.clanId, clanId)),
  });
  if (!seat || seat.kind !== 'event') return { ok: false, error: 'That is not one of your viewers.' };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, seat.accountId), columns: { playerId: true, rsn: true } });
  if (await isBannedFromClan(clanId, account?.playerId)) return { ok: false, error: 'That person is banned. Lift the ban first.' };

  // clan-scope: this clan -- the account's member/guest seat here, if it ever had one.
  const clanRow = await db.query.clanMemberships.findFirst({
    where: and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.accountId, seat.accountId), ne(clanMemberships.kind, 'event')),
  });
  let guestSeatId: number;
  if (clanRow && !clanRow.leftAt) {
    return { ok: false, error: clanRow.kind === 'member' ? 'Already a member.' : 'Already a guest.' };
  } else if (clanRow) {
    // A departed seat — a departed MEMBER comes back as a guest: only the in-game roster makes members.
    await db.update(clanMemberships).set({ kind: 'guest', leftAt: null, source: 'admin' }).where(eq(clanMemberships.id, clanRow.id));
    guestSeatId = clanRow.id;
  } else {
    const [made] = await db
      .insert(clanMemberships)
      .values({ clanId, accountId: seat.accountId, kind: 'guest', source: 'admin' })
      .returning({ id: clanMemberships.id });
    guestSeatId = made.id;
  }
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      clanMemberId: guestSeatId,
      eventType: 'viewer_made_guest',
      actorUserId: byUserId,
      newValue: JSON.stringify({ eventSeatId, eventId: seat.eventId, rsn: account?.rsn ?? null }),
    })
    .catch(() => {});
  return { ok: true, seatId: guestSeatId };
}

/**
 * The other way: a GUEST goes back to being an event player of one of the clan's events. Their guest
 * seat closes (so it opens nothing else); the event seat is theirs for that event — an earlier one
 * re-opened, or the guest seat itself turned into it when they never had one, so a sign-up they made
 * on it for that event still stands.
 */
export async function makeEventPlayer(
  clanId: number,
  guestSeatId: number,
  eventId: number,
  byUserId: number | null,
): Promise<SeatChange> {
  // clan-scope: this clan -- the seat and the event must both be this clan's own.
  const [seat, event] = await Promise.all([
    db.query.clanMemberships.findFirst({ where: and(eq(clanMemberships.id, guestSeatId), eq(clanMemberships.clanId, clanId)) }),
    db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.clanId, clanId)), columns: { id: true, name: true } }),
  ]);
  if (!seat || seat.kind !== 'guest' || seat.leftAt) return { ok: false, error: 'That is not one of your guests.' };
  if (!event) return { ok: false, error: 'Pick one of your events.' };

  // clan-scope: this clan -- the account's event seat for that event, if it already has one.
  const prior = await db.query.clanMemberships.findFirst({
    where: and(
      eq(clanMemberships.clanId, clanId),
      eq(clanMemberships.accountId, seat.accountId),
      eq(clanMemberships.kind, 'event'),
      eq(clanMemberships.eventId, eventId),
    ),
  });
  let eventSeatId: number;
  if (prior) {
    await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, prior.id));
    await db.update(clanMemberships).set({ leftAt: new Date().toISOString(), source: 'manual' }).where(eq(clanMemberships.id, seat.id));
    eventSeatId = prior.id;
  } else {
    await db.update(clanMemberships).set({ kind: 'event', eventId, source: 'admin' }).where(eq(clanMemberships.id, seat.id));
    eventSeatId = seat.id;
  }
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      clanMemberId: eventSeatId,
      eventType: 'guest_made_viewer',
      actorUserId: byUserId,
      newValue: JSON.stringify({ guestSeatId, eventId }),
    })
    .catch(() => {});
  return { ok: true, seatId: eventSeatId };
}

export interface PastViewer {
  seatId: number;
  accountId: number;
  rsn: string;
  joinedAt: string;
  /** Closed: the event ended (or the host removed them). */
  closed: boolean;
  /** Also holds a live guest or member seat here now (made a guest since). */
  nowGuest: boolean;
  signupStatus: string | null;
  teamName: string | null;
  /** The team's final place, once the event's facts are written (lib/playerEventFacts). */
  teamRank: number | null;
  teamsTotal: number | null;
}

export interface PastViewersEvent {
  eventId: number;
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  over: boolean;
  viewers: PastViewer[];
}

/** Every event player this clan has had, by event, newest event first — the "Past viewers" page. */
export async function pastViewers(clanId: number, opts: { eventId?: number } = {}): Promise<PastViewersEvent[]> {
  // clan-scope: this clan -- its own event seats and their events.
  const seats = await db
    .select({
      seatId: clanMemberships.id,
      accountId: clanMemberships.accountId,
      eventId: clanMemberships.eventId,
      joinedAt: clanMemberships.joinedAt,
      leftAt: clanMemberships.leftAt,
      rsn: accounts.rsn,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(events, and(eq(events.id, clanMemberships.eventId), eq(events.clanId, clanId)))
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.kind, 'event'),
        isNotNull(clanMemberships.eventId),
        opts.eventId != null ? eq(clanMemberships.eventId, opts.eventId) : undefined,
      ),
    )
    .orderBy(desc(events.id), asc(accounts.rsn));
  if (seats.length === 0) return [];
  const seatIds = seats.map((s) => s.seatId);
  const accountIds = [...new Set(seats.map((s) => s.accountId))];

  const [signups, parts, facts, clanSeats] = await Promise.all([
    // clan-scope: this clan -- sign-ups on its own seats, read by seat id.
    db
      .select({ seatId: eventSignups.clanMemberId, eventId: eventSignups.eventId, status: eventSignups.status })
      .from(eventSignups)
      .where(inArray(eventSignups.clanMemberId, seatIds)),
    // clan-scope: this clan -- board entries on its own seats.
    db
      .select({ seatId: eventParticipants.clanMemberId, eventId: eventParticipants.eventId, teamName: teams.name })
      .from(eventParticipants)
      .leftJoin(teams, eq(teams.id, eventParticipants.teamId))
      .where(inArray(eventParticipants.clanMemberId, seatIds)),
    // clan-scope: this clan -- the written facts for its own seats.
    db
      .select({ seatId: playerEventFacts.clanMemberId, eventId: playerEventFacts.eventId, teamRank: playerEventFacts.teamRank, teamsTotal: playerEventFacts.teamsTotal })
      .from(playerEventFacts)
      .where(inArray(playerEventFacts.clanMemberId, seatIds)),
    // clan-scope: this clan -- which of these accounts hold a live member/guest seat here now.
    db
      .select({ accountId: clanMemberships.accountId })
      .from(clanMemberships)
      .where(
        and(
          eq(clanMemberships.clanId, clanId),
          inArray(clanMemberships.accountId, accountIds),
          ne(clanMemberships.kind, 'event'),
          isNull(clanMemberships.leftAt),
        ),
      ),
  ]);
  const key = (seatId: number | null, eventId: number | null) => `${seatId}:${eventId}`;
  const signupBy = new Map(signups.map((r) => [key(r.seatId, r.eventId), r.status]));
  const teamBy = new Map(parts.map((r) => [key(r.seatId, r.eventId), r.teamName]));
  const factBy = new Map(facts.map((r) => [key(r.seatId, r.eventId), r]));
  const inClan = new Set(clanSeats.map((r) => r.accountId));

  const byEvent = new Map<number, PastViewersEvent>();
  for (const s of seats) {
    const eventId = s.eventId!;
    let group = byEvent.get(eventId);
    if (!group) {
      group = { eventId, eventName: s.eventName, startDate: s.startDate, endDate: s.endDate, over: eventOver(s), viewers: [] };
      byEvent.set(eventId, group);
    }
    const fact = factBy.get(key(s.seatId, eventId));
    group.viewers.push({
      seatId: s.seatId,
      accountId: s.accountId,
      rsn: s.rsn,
      joinedAt: s.joinedAt,
      closed: s.leftAt != null,
      nowGuest: inClan.has(s.accountId),
      signupStatus: signupBy.get(key(s.seatId, eventId)) ?? null,
      teamName: teamBy.get(key(s.seatId, eventId)) ?? null,
      teamRank: fact?.teamRank ?? null,
      teamsTotal: fact?.teamsTotal ?? null,
    });
  }
  return [...byEvent.values()];
}
