import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventTimeState } from './eventTime';

// Finished events are read-only. Once an event is over (past its end date or force-ended), every
// event-content mutation — teams, players, draft, tiles, completions, submissions — is refused so
// recorded results can't drift. The admin can explicitly unlock editing on the event Overview
// (events.editUnlockedAt) to make corrections, and lock it again after. Post-end features that are
// SUPPOSED to run after the finish (survey, recap, payouts, Discord teardown) are intentionally
// not guarded.

export interface LockableEvent {
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  editUnlockedAt?: string | null;
}

/** True once the event is over — past its end date or force-ended. */
export function isEventOver(e: LockableEvent): boolean {
  const phase = eventTimeState({
    startDate: e.startDate,
    endDate: e.endDate,
    forceEndedAt: e.forceEndedAt,
  }).phase;
  return phase === 'ended' || phase === 'force-ended';
}

/** Finished + not explicitly unlocked = every event-content mutation is refused. */
export function eventEditLocked(e: LockableEvent): boolean {
  return isEventOver(e) && !e.editUnlockedAt;
}

export const EVENT_LOCKED_ERROR =
  'This event has finished — editing is locked. Use "Unlock editing" on the event Overview to make corrections.';

/**
 * Route guard for event-content mutations. Returns a 409 response to bubble up when the event is
 * locked, or null when the write may proceed. Missing events return null — the route's own 404
 * handling stays authoritative.
 */
export async function assertEventEditable(eventId: number): Promise<NextResponse | null> {
  if (!Number.isFinite(eventId)) return null;
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { startDate: true, endDate: true, forceEndedAt: true, editUnlockedAt: true },
  });
  if (!event) return null;
  if (eventEditLocked(event)) {
    return NextResponse.json({ error: EVENT_LOCKED_ERROR, locked: true }, { status: 409 });
  }
  return null;
}
