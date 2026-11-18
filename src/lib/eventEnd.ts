import { eventTimeState } from '@/lib/eventTime';

// When an event stopped counting. Pure, so tests/event-ended-stats.test.ts runs it without a database.

interface EndableEvent {
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

/**
 * When the event ended (its force-end, else its end date), or null while it is still to run or
 * running. Stat progress stops here: what a player gains afterwards is not the event's.
 */
export function eventEndedAtMs(e: EndableEvent, now: number = Date.now()): number | null {
  const phase = eventTimeState({ startDate: e.startDate, endDate: e.endDate, forceEndedAt: e.forceEndedAt, now }).phase;
  if (phase !== 'ended' && phase !== 'force-ended') return null;
  return stampOf(e.forceEndedAt) ?? stampOf(e.endDate) ?? now;
}

/** A starting line read after the event had already ended: it measures nothing the event counted. */
export function startedAfterEnd(snapshotAt: string | null | undefined, endMs: number | null): boolean {
  const t = stampOf(snapshotAt);
  return endMs != null && t != null && t > endMs;
}

function stampOf(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = Date.parse(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
  return Number.isNaN(t) ? null : t;
}
