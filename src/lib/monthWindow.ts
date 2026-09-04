// Calendar months, as half-open ISO windows over `completedAt`.
//
// A ladder's monthly board is not a table that gets wiped — it is the all-time computation run over
// one month's completions (see lib/ladderStandings). So "this month" and "the month that just
// closed" are the same question with different bounds, and both live here: no database, so a page,
// a test and the month-end pass can all agree on where a month starts without importing @/db.
//
// UTC, deliberately. A clan playing in Sydney does roll over at 10am local, but every completedAt in
// the database is UTC text and comparing them as strings is what makes the monthly board a filter
// rather than a second scoring pass. A per-clan month boundary would mean parsing every timestamp.

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
