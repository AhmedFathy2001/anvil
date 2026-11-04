// Creator-space plans — the reads (rules: lib/creatorPlans). What the meters count.

import { and, count, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventSignups, events } from '@/db/schema';
import { ON_BOARD_STATUSES, eventRoomVerdict, isLiveEvent, newEventVerdict, streamPlanId } from '@/lib/creatorPlans';
import { isCreatorSpace, streamedEvent } from '@/lib/creatorSpaces';
import { eventStage } from '@/lib/eventStage';

/** The creator setting behind "Hide the Anvil mark" on the OBS overlay ('on' | absent). */
export const OVERLAY_HIDE_MARK_SETTING = 'creator_overlay_hide_mark';

/** Sign-up rows that are ON the board: pending and approved. Withdrawn and rejected are not. */
const ON_BOARD = ON_BOARD_STATUSES;

/** A transaction handle (or the db itself) — the counts run inside the caller's transaction. */
export type Executor = Pick<typeof db, 'select' | 'execute'>;

// Advisory-lock namespaces (pg_advisory_xact_lock(ns, id)). Held to the end of the transaction, so
// "count, then write" is one step for everybody else taking the same lock.
const EVENT_ROOM_LOCK = 1129336657; // per event: players on one event's board
const LIVE_EVENTS_LOCK = 1129336658; // per space: how many events are live

/** Serialise every write that could add a player to this event (sign-ups), until the tx ends. */
export async function lockEventRoom(tx: Executor, eventId: number): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${EVENT_ROOM_LOCK}, ${eventId})`);
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
 * players, so both are capped per event (Plan.playersPerEvent). A clan's members-only events are
 * metered by its roster as before, so null.
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

/**
 * The event the meter shows: the biggest one that has not ended, or — when none is live — the
 * biggest ever, so a creator between events still sees how big they run.
 */
export async function biggestCreatorEvent(clanId: number, now = Date.now()): Promise<{ id: number; name: string; players: number } | null> {
  // clan-scope: this clan -- the space's own events, with how many are on each board.
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      players: count(eventSignups.id),
    })
    .from(events)
    .leftJoin(eventSignups, and(eq(eventSignups.eventId, events.id), inArray(eventSignups.status, [...ON_BOARD])))
    .where(eq(events.clanId, clanId))
    .groupBy(events.id, events.name, events.startDate, events.endDate, events.forceEndedAt);
  if (rows.length === 0) return null;
  const live = rows.filter((r) => eventStage(r, now) !== 'wrap');
  const pool = live.length > 0 ? live : rows;
  const top = pool.reduce((a, b) => (Number(b.players) > Number(a.players) ? b : a));
  return { id: top.id, name: top.name, players: Number(top.players) };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a sign-up write that may put `adding` more players on an event, race-safely.
 *
 * One transaction. When the host is metered (`clanPlan` non-null — lib/creatorPlans meteredPlan) and
 * the write adds anybody, the event's advisory lock is held from before the write to the re-count
 * after it, so two writes racing for the last place serialise: the second counts the first's
 * committed row and rolls its own back with a PlanLimitError. Otherwise a plain transaction.
 */
export async function withEventRoom<T>(
  opts: { eventId: number; clanPlan: string | null; adding: number },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const metered = opts.clanPlan != null && opts.adding > 0;
    if (metered) await lockEventRoom(tx, opts.eventId);
    const out = await write(tx);
    if (metered) {
      // Re-counted under the lock with this write in it: "before" is the count minus what it added.
      const players = (await eventPlayerCount(opts.eventId, tx)) - opts.adding;
      const room = eventRoomVerdict({ clanPlan: opts.clanPlan, players, adding: opts.adding });
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
 * check and is a plain transaction.
 */
export async function withLiveEventSlot<T>(
  opts: { clanId: number; clanPlan: string | null; exceptEventId?: number },
  write: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (opts.clanPlan != null) {
      await lockLiveEvents(tx, opts.clanId);
      const liveEvents = await liveEventCount(opts.clanId, { exceptEventId: opts.exceptEventId, tx });
      const more = newEventVerdict({ clanPlan: opts.clanPlan, liveEvents });
      if (!more.ok) throw new PlanLimitError(more.error);
    }
    return write(tx);
  });
}
