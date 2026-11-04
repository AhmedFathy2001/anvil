// Creator-space plans — the reads (rules: lib/creatorPlans). What the meters count.

import { and, count, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventSignups, events } from '@/db/schema';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { eventStage } from '@/lib/eventStage';

/** The creator setting behind "Hide the Anvil mark" on the OBS overlay ('on' | absent). */
export const OVERLAY_HIDE_MARK_SETTING = 'creator_overlay_hide_mark';

/** Sign-up rows that are ON the board: pending and approved. Withdrawn and declined are not. */
const ON_BOARD = ['pending', 'approved'] as const;

/** How many players an event has — its live sign-ups (one per character on a multi-account event). */
export async function eventPlayerCount(eventId: number): Promise<number> {
  // clan-scope: global -- one event's sign-ups by its id; every caller has already resolved the event.
  const [row] = await db
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

/** Events of this space that have not ended (not yet started, or running) — "live" for the plan. */
export async function liveEventCount(clanId: number, now = Date.now()): Promise<number> {
  // clan-scope: this clan -- the space's own events.
  const rows = await db
    .select({ startDate: events.startDate, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(events)
    .where(eq(events.clanId, clanId));
  return rows.filter((r) => eventStage(r, now) !== 'wrap').length;
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
