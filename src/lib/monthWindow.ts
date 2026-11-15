// Calendar months, as half-open ISO windows over `completedAt`.
//
// A ladder's monthly board is not a table that gets wiped — it is the all-time computation run over
// one month's completions (see lib/ladderStandings). So "this month" and "the month that just
// closed" are the same question with different bounds, and both live here: no database, so a page,
// a test and the month-end pass can all agree on where a month starts without importing @/db.
//
// UTC, deliberately. A clan playing in Sydney does roll over at 10am local, but every completedAt in
// the database is UTC text. A per-clan month boundary would mean a second scoring pass.
//
// COMPARE WITH `inWindow`, NEVER AS STRINGS. The bounds are ISO ("2026-08-01T00:00:00.000Z") and a
// stored completedAt is usually the column default ("2026-08-01 09:30:00"). Space sorts below T, so
// a raw `>=` dropped every completion made on the 1st and counted the next month's 1st instead
// (lib/dbTime has the whole story).

import { parseStamp } from '@/lib/dbTime';

export interface MonthWindow {
  /** Inclusive lower bound, ISO UTC. */
  start: string;
  /** EXCLUSIVE upper bound — the first instant of the next month. */
  end: string;
}

/** The UTC calendar month containing `now`. */
export function monthWindowUtc(now: Date = new Date()): MonthWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The 'YYYY-MM' key of the month BEFORE the one containing `now` — the one that just closed. */
export function previousMonthKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The window a 'YYYY-MM' key names. December rolls the year rather than producing a month 13. */
export function monthKeyWindow(key: string): MonthWindow {
  const [y, m] = key.split('-').map((n) => parseInt(n, 10));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Is this stored timestamp inside the window? Reads either stored format (lib/dbTime parseStamp).
 * An open side (`undefined`) is unbounded; a stamp that cannot be read is in no window.
 */
export function inWindow(stamp: string | null | undefined, window: { start?: string; end?: string }): boolean {
  const at = parseStamp(stamp);
  if (at == null) return false;
  const start = window.start === undefined ? null : parseStamp(window.start);
  const end = window.end === undefined ? null : parseStamp(window.end);
  if (window.start !== undefined && start == null) return false;
  if (window.end !== undefined && end == null) return false;
  return (start == null || at >= start) && (end == null || at < end);
}
