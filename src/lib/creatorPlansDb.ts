// Creator-space plans — the reads (rules: lib/creatorPlans). What the meters count.

import { and, count, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventSignups, events } from '@/db/schema';
import {
  ON_BOARD_STATUSES,
  datesRoomVerdict,
  eventRoomVerdict,
  isLiveEvent,
  newEventVerdict,
  seatMeter,
  streamPlanId,
  type HostEventSeats,
  type RoomVerdict,
  type SeatMeter,
} from '@/lib/creatorPlans';
import { isCreatorSpace, streamedEvent } from '@/lib/creatorSpaces';
import { freemiumEnforced } from '@/lib/entitlements';
import type { DatedEvent } from '@/lib/concurrentSeats';

/** The creator setting behind "Hide the Anvil mark" on the OBS overlay ('on' | absent). */
export const OVERLAY_HIDE_MARK_SETTING = 'creator_overlay_hide_mark';

/** Sign-up rows that are ON the board: pending and approved. Withdrawn and rejected are not. */
const ON_BOARD = ON_BOARD_STATUSES;

/** A transaction handle (or the db itself) — the counts run inside the caller's transaction. */
export type Executor = Pick<typeof db, 'select' | 'execute'>;

// Advisory-lock namespaces (pg_advisory_xact_lock(ns, id)). Held to the end of the transaction, so
// "count, then write" is one step for everybody else taking the same lock.
//
// Lock order, so no two writers can wait on each other: LIVE_EVENTS_LOCK before HOST_ROOM_LOCK. A
// date change takes both (withLiveEventSlot); a sign-up takes only the room (withEventRoom).
const HOST_ROOM_LOCK = 1129336659; // per host: players at once across the host's events
const LIVE_EVENTS_LOCK = 1129336658; // per space: how many events are live

/**
 * Serialise every write that could put more players on at once ANYWHERE in this host's events — a
 * sign-up on any of them, or one of them moving its dates onto another — until the tx ends. Per host,
 * not per event: two joins to two overlapping events share one cap, so they must not both pass.
 */
export async function lockHostRoom(tx: Executor, clanId: number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${HOST_ROOM_LOCK}, ${clanId})`);
}

/** Serialise every write that could make one more of this space's events live, until the tx ends. */
export async function lockLiveEvents(tx: Executor, clanId: number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LIVE_EVENTS_LOCK}, ${clanId})`);
}

/** Thrown inside a transaction to roll back a write that took a plan over its limit. */
export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

/** How many players an event has — its live sign-ups (one per character on a multi-account event). */
export async function eventPlayerCount(eventId: number, tx: Executor = db): Promise<number> {
  // clan-scope: global -- one event's sign-ups by its id; every caller has already resolved the event.
  const [row] = await tx
    .select({ n: count() })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), inArray(eventSignups.status, [...ON_BOARD])));
  return Number(row?.n ?? 0);
}

/**
 * The host's plan when the host is a creator space, else null — the creator meters apply to creator
 * spaces only; an ordinary clan is metered by its roster (lib/plans memberCap), unchanged.
 */
export async function creatorPlanOfClan(clanId: number): Promise<string | null> {
  // clan-scope: this clan -- the host's own kind and plan.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true, plan: true } });
  return row && isCreatorSpace(row) ? row.plan : null;
}

/**
 * The plan that meters players on THIS event, else null: a creator space's event, or a Streaming
 * clan's event open to viewers (lib/creatorSpaces streamedEvent) — both seat outsiders as event
 * players, so both are capped by players at once across the host's such events (hostEventSeats). A
 * clan's members-only events are metered by its roster as before, so null — and they never count
 * towards a Streaming clan's viewer-event cap either.
 */
export async function streamPlanOfEvent(eventId: number): Promise<string | null> {
  // clan-scope: global -- the event by its own id; its host is read back from it.
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { clanId: true, openToViewers: true } });
  if (!ev) return null;
  // clan-scope: this clan -- the event's own host.
  const host = await db.query.clans.findFirst({ where: eq(clans.id, ev.clanId), columns: { kind: true, plan: true, streaming: true } });
  // A Streaming clan's clan tier, read as the creator tier it equals (lib/creatorPlans streamPlanId).
  return host && streamedEvent(host, ev) ? streamPlanId(host) : null;
}

/**
 * The host's player-capped events — every event of a creator space, or a Streaming clan's events open
 * to viewers (lib/creatorSpaces streamedEvent) — with their dates and on-board sign-ups. The cap
 * counts these together wherever their dates overlap (lib/creatorPlans eventRoomVerdict). Seats, not
 * people: somebody signed up to two of them counts on both.
 */
export async function hostEventSeats(clanId: number, tx: Executor = db): Promise<HostEventSeats[]> {
  // clan-scope: this clan -- the host's own kind, to know which of its events are capped.
  const [host] = await tx.select({ kind: clans.kind, streaming: clans.streaming }).from(clans).where(eq(clans.id, clanId));
  if (!host) return [];
  // clan-scope: this clan -- the host's own events, with how many are on each board.
  const rows = await tx
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      openToViewers: events.openToViewers,
      seats: count(eventSignups.id),
    })
    .from(events)
    .leftJoin(eventSignups, and(eq(eventSignups.eventId, events.id), inArray(eventSignups.status, [...ON_BOARD])))
    .where(eq(events.clanId, clanId))
    .groupBy(events.id, events.name, events.startDate, events.endDate, events.forceEndedAt, events.openToViewers);
  return rows
    .filter((r) => streamedEvent(host, r))
    .map((r) => ({ id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate, forceEndedAt: r.forceEndedAt, seats: Number(r.seats) }));
}

/** The host (clan id) of an event, or null. */
async function hostOf(eventId: number, tx: Executor = db): Promise<number | null> {
  // clan-scope: global -- the event by its own id; its host is read back from it.
  const [row] = await tx.select({ clanId: events.clanId }).from(events).where(eq(events.id, eventId));
  return row?.clanId ?? null;
}

/**
 * The plan that caps players on this event right now, or null when nothing would ever be refused:
 * FREEMIUM_ENFORCED off, or an event that is not player-capped (streamPlanOfEvent).
 */
export async function roomPlanOfEvent(eventId: number): Promise<string | null> {
  return freemiumEnforced() ? streamPlanOfEvent(eventId) : null;
}

/**
 * May `adding` more players join this event, counting every overlapping event of its host
 * (lib/creatorPlans eventRoomVerdict)? `clanPlan` from streamPlanOfEvent / roomPlanOfEvent. The cheap
 * early check; withEventRoom repeats it under the host's lock.
 *
 * `included`: the write is already in the counts (withEventRoom's re-count), so it is taken back off.
 */
export async function hostRoomVerdict(opts: {
  eventId: number;
  clanPlan: string | null;
  adding: number;
  tx?: Executor;
  included?: boolean;
  now?: number;
  audience?: 'player' | 'host';
}): Promise<RoomVerdict> {
  if (opts.clanPlan == null || opts.adding <= 0) return { ok: true };
  const clanId = await hostOf(opts.eventId, opts.tx);
  const rows = clanId == null ? [] : await hostEventSeats(clanId, opts.tx);
  const self = rows.find((r) => r.id === opts.eventId);
  // An event the host list did not return (not capped) is judged on its own board.
  const players = (self?.seats ?? (await eventPlayerCount(opts.eventId, opts.tx))) - (opts.included ? opts.adding : 0);
  return eventRoomVerdict({
    clanPlan: opts.clanPlan,
    players,
    adding: opts.adding,
    eventId: opts.eventId,
    dates: self ?? null,
    others: rows,
    now: opts.now,
    audience: opts.audience,
  });
}

/** Events of this space with a start date that have not ended (scheduled or running) — "live" for the plan. Undated drafts don't count (lib/creatorPlans isLiveEvent). */
export async function liveEventCount(
  clanId: number,
  opts: { now?: number; exceptEventId?: number; tx?: Executor } = {},
): Promise<number> {
  const now = opts.now ?? Date.now();
  // clan-scope: this clan -- the space's own events.
  const rows = await (opts.tx ?? db)
    .select({ id: events.id, startDate: events.startDate, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(events)
    .where(eq(events.clanId, clanId));
  return rows.filter((r) => r.id !== opts.exceptEventId && isLiveEvent(r, now)).length;
}

/** The dashboard and portal meter: peak players at once across the host's events (lib/creatorPlans seatMeter). */
export async function creatorSeatMeter(clanId: number, now = Date.now()): Promise<SeatMeter | null> {
  return seatMeter(await hostEventSeats(clanId), now);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * THE way to write a sign-up that may put somebody on an event's board — a new sign-up, a withdrawn
 * or rejected one brought back, an admin add, a captain seated, a bulk add. Every such write goes
 * through here (tests/seat-write-guard keeps it that way), so a new path cannot skip the cap.
 *
 * One transaction. When the event is player-capped — `clanPlan` given, or left out and resolved here
 * by roomPlanOfEvent: a creator space's event, or a Streaming clan's event open to viewers, only while
 * FREEMIUM_ENFORCED is on — the HOST's advisory lock is held around the write. The event's board is
 * counted before and after it under the lock, so the write's own effect is measured, never
 * predicted by the caller: when it put anybody on (after > before), the host-wide verdict is taken
 * for that many (lib/creatorPlans eventRoomVerdict — players at once across the host's overlapping
 * events) and a refusal rolls the write back with a PlanLimitError. Per host, not per event, so two
 * writes racing for the last place — on one event or on two overlapping ones — serialise and the
 * second sees the first. Date changes take the same lock (withLiveEventSlot `dates`). An edit, a
 * swap or a withdrawal adds nobody and is never refused. `clanPlan` null: a plain transaction.
 */
export async function withEventRoom<T>(
  opts: {
    eventId: number;
    clanPlan?: string | null;
    /** 'host' when the host's staff are the ones adding (the refusal is worded for them). */
    audience?: 'player' | 'host';
  },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  const clanPlan = opts.clanPlan === undefined ? await roomPlanOfEvent(opts.eventId) : opts.clanPlan;
  return db.transaction(async (tx) => {
    if (clanPlan == null) return write(tx);
    const clanId = await hostOf(opts.eventId, tx);
    if (clanId != null) await lockHostRoom(tx, clanId);
    const before = await eventPlayerCount(opts.eventId, tx);
    const out = await write(tx);
    const added = (await eventPlayerCount(opts.eventId, tx)) - before;
    if (added > 0) {
      const room = await hostRoomVerdict({ eventId: opts.eventId, clanPlan, adding: added, tx, included: true, audience: opts.audience });
      if (!room.ok) throw new PlanLimitError(room.error);
    }
    return out;
  });
}

/**
 * Run a write that makes one more of this space's events live (create, clone, resume, moving an end
 * date into the future) race-safely: under the space's advisory lock, count the OTHER live events,
 * refuse with a PlanLimitError when the plan runs one at a time, else write — all in one transaction,
 * so two concurrent creates cannot both see "none live". `clanPlan` null (not metered) skips the
 * check.
 *
 * `dates`: the write changes this event's dates to `after`. When `roomPlan` is non-null
 * (roomPlanOfEvent), the host's room lock is taken too and the change is refused when the time the
 * event newly covers would put more players on at once than the plan allows (lib/creatorPlans
 * datesRoomVerdict) — "before" is read under the lock, so a sign-up cannot slip in between.
 */
export async function withLiveEventSlot<T>(
  opts: {
    clanId: number;
    clanPlan: string | null;
    exceptEventId?: number;
    dates?: { eventId: number; roomPlan: string | null; after: DatedEvent };
  },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (opts.clanPlan != null) {
      await lockLiveEvents(tx, opts.clanId);
      const liveEvents = await liveEventCount(opts.clanId, { exceptEventId: opts.exceptEventId, tx });
      const more = newEventVerdict({ clanPlan: opts.clanPlan, liveEvents });
      if (!more.ok) throw new PlanLimitError(more.error);
    }
    const d = opts.dates;
    if (d && d.roomPlan != null) {
      // The event's own host (a co-host's staff may be the ones editing it).
      const hostId = (await hostOf(d.eventId, tx)) ?? opts.clanId;
      await lockHostRoom(tx, hostId);
      const rows = await hostEventSeats(hostId, tx);
      const self = rows.find((r) => r.id === d.eventId);
      if (self) {
        const room = datesRoomVerdict({ clanPlan: d.roomPlan, event: self, before: self, after: d.after, others: rows });
        if (!room.ok) throw new PlanLimitError(room.error);
      }
    }
    return write(tx);
  });
}
