// The filters that keep a practice board (lib/practice, events.practice) out of everything real.
//
// A practice board lives in its real clan, so the clan scoping that hides the tile lab's boards does
// not hide it: every listing, feed, points table, recap, award and clan channel that reads events has
// to say "not practice" itself. These are the two ways to say it — on a query that has `events`
// joined, and on one that holds only an event id column.

import { eq, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { db } from '@/db';
import { events, practiceBoards } from '@/db/schema';

/** WHERE fragment for a query with `events` in it: not a practice board. */
export function notPractice(): SQL {
  return eq(events.practice, false);
}

/**
 * WHERE fragment for a query that holds an event id but not the events row (moments.event_id, …):
 * the id is null or names a real board. Not correlated, so it can't bind to the wrong `id`.
 */
export function notPracticeEventId(eventIdColumn: SQLWrapper): SQL {
  return sql`coalesce(${eventIdColumn} not in (select "id" from "events" where "practice" = true), true)`;
}

/** The flag never changes after an event is created, so a found row is remembered (bounded). */
const flagMemo = new Map<number, boolean>();

/**
 * Is this event a practice board? Only an event that EXISTS is remembered: a miss is asked again,
 * so an id looked up before its row was written can never be cached as "real".
 */
export async function isPracticeEvent(eventId: number | null | undefined): Promise<boolean> {
  if (eventId == null || !Number.isInteger(eventId)) return false;
  const hit = flagMemo.get(eventId);
  if (hit !== undefined) return hit;
  // clan-scope: global -- reads one event's own flag by id, to keep that event out of things.
  const [row] = await db.select({ practice: events.practice }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!row) return false;
  if (flagMemo.size > 5000) flagMemo.clear();
  flagMemo.set(eventId, row.practice === true);
  return row.practice === true;
}

/** Drop practice boards from a list of rows that carry the flag. */
export function withoutPractice<T extends { practice?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.practice !== true);
}

/** The test webhook of a practice board, or null for none / not a practice board. Read by lib/discord. */
export async function practiceHookFor(eventId: number): Promise<string | null> {
  // clan-scope: global -- one board's own settings row, by its event id, for its own posts.
  const [row] = await db.select({ url: practiceBoards.webhookUrl }).from(practiceBoards).where(eq(practiceBoards.eventId, eventId)).limit(1);
  return row?.url ?? null;
}
