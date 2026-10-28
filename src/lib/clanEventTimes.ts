import { addLocalDays, dayKeyFields, localDayKey, zonedFields, zonedTimeToUtcMs } from '@/lib/zonedTime';

// When a clan event happens. Pure, so it is tested without a database (tests/clan-events.test.ts).
//
// A one-off is its start and its length. A weekly repeats on the same weekday at the same wall time
// in the event's own zone — a 20:00 London mass stays at 20:00 London across the clock change — so
// each occurrence is worked out in local days, not by adding 7 × 24 hours.

export interface ClanEventTiming {
  startsAt: string;
  durationMin: number;
  repeat: string;
  repeatUntil: string | null;
  timezone: string;
  cancelledAt: string | null;
}

export interface Occurrence {
  /** ISO UTC; also the key an RSVP and a reminder are kept under. */
  start: string;
  end: string;
}

const MINUTE = 60_000;

/** The `n`th occurrence's start (0 = the first), in ms. */
function nthStart(e: ClanEventTiming, n: number): number {
  const first = Date.parse(e.startsAt);
  if (n === 0 || e.repeat !== 'weekly') return first;
  const local = zonedFields(first, e.timezone);
  const day = dayKeyFields(addLocalDays(localDayKey(first, e.timezone), 7 * n));
  return zonedTimeToUtcMs({ year: day.year, month: day.month, day: day.day, hour: local.hour, minute: local.minute }, e.timezone);
}

/**
 * The occurrence on now or next: the first whose end is still ahead. Null when there is none — the
 * one-off is over, the series ran past `repeatUntil`, or the event was cancelled.
 */
export function currentOccurrence(e: ClanEventTiming, now: number): Occurrence | null {
  if (e.cancelledAt) return null;
  const first = Date.parse(e.startsAt);
  if (!Number.isFinite(first)) return null;
  const length = Math.max(1, e.durationMin) * MINUTE;
  // Weeks already past, give or take one either side of a clock change.
  let n = e.repeat === 'weekly' ? Math.max(0, Math.floor((now - first - length) / (7 * 24 * 60 * MINUTE))) : 0;
  for (let guard = 0; guard < 3; guard++, n++) {
    const start = nthStart(e, n);
    if (e.repeat === 'weekly' && e.repeatUntil && start > Date.parse(e.repeatUntil)) return null;
    if (start + length > now) return { start: new Date(start).toISOString(), end: new Date(start + length).toISOString() };
    if (e.repeat !== 'weekly') return null;
  }
  return null;
}

export type Phase = 'upcoming' | 'soon' | 'live';

/** Where an occurrence stands: within 15 minutes of its start is `soon`. */
export function phaseOf(o: Occurrence, now: number): Phase {
  const start = Date.parse(o.start);
  if (now >= start) return 'live';
  return start - now <= 15 * MINUTE ? 'soon' : 'upcoming';
}

/**
 * The Discord post an occurrence is owed now, given what already went out for it: the 15-minute
 * reminder, then "starting now". A reminder the cron missed (the box was down) is skipped once the
 * start has passed — "starting now" covers it.
 */
export function dueNotice(o: Occurrence, now: number, remindedFor: string | null, startedFor: string | null): 'reminder' | 'start' | null {
  const phase = phaseOf(o, now);
  if (phase === 'live') return startedFor === o.start ? null : 'start';
  if (phase === 'soon') return remindedFor === o.start ? null : 'reminder';
  return null;
}

/**
 * Occurrences that have ended, most recent first, up to `limit` — what payouts and the survey look
 * back at once the mass is over. A one-off has at most one.
 */
export function pastOccurrences(e: ClanEventTiming, now: number, limit = 8): Occurrence[] {
  const first = Date.parse(e.startsAt);
  if (!Number.isFinite(first)) return [];
  const length = Math.max(1, e.durationMin) * MINUTE;
  const out: Occurrence[] = [];
  if (e.repeat !== 'weekly') {
    if (first + length <= now) out.push({ start: new Date(first).toISOString(), end: new Date(first + length).toISOString() });
    return out;
  }
  const until = e.repeatUntil ? Date.parse(e.repeatUntil) : Infinity;
  // The last week that could have ended, one past for a clock change, then walk back.
  let n = Math.max(0, Math.floor((now - first) / (7 * 24 * 60 * MINUTE)) + 1);
  for (; n >= 0 && out.length < limit; n--) {
    const start = nthStart(e, n);
    if (start > until || start + length > now) continue;
    out.push({ start: new Date(start).toISOString(), end: new Date(start + length).toISOString() });
  }
  return out;
}

/** The occurrence a key names (its ISO start), if the event really has one there. */
export function occurrenceAt(e: ClanEventTiming, start: string): Occurrence | null {
  const at = Date.parse(start);
  const first = Date.parse(e.startsAt);
  if (!Number.isFinite(at) || !Number.isFinite(first) || at < first) return null;
  const length = Math.max(1, e.durationMin) * MINUTE;
  const n = e.repeat === 'weekly' ? Math.round((at - first) / (7 * 24 * 60 * MINUTE)) : 0;
  for (const k of [n - 1, n, n + 1]) {
    if (k < 0) continue;
    const s = nthStart(e, k);
    if (s !== at) continue;
    if (e.repeat === 'weekly' && e.repeatUntil && s > Date.parse(e.repeatUntil)) return null;
    return { start: new Date(s).toISOString(), end: new Date(s + length).toISOString() };
  }
  return null;
}
