// What a week of a competition actually looked like, day by day.
//
// The competition board has only ever known two numbers per person: the baseline and the current
// value. That's enough to rank them and nothing else — it can't say whether the leader won it on
// Monday or came back from fourth on Saturday, who is still training, or whether the clan is having
// a bigger week than last time.
//
// It doesn't have to stay that way, because the 15-minute sweep already writes a row per member per
// UTC day (`member_daily_stats`) carrying that day's gain and a `deltas` JSON of exactly which
// skills and bosses moved. Every read below is over rows that already exist — no new tracking, no
// extra hiscores traffic.
//
// Pure and dependency-free (like lib/eventRules and lib/ladderInsights) so it's directly testable.

/** What a competition is scored on. Mirrors weekly_competitions.type. */
export type CompetitionType = 'skill' | 'boss' | 'efficiency';

/** One member's day, already reduced to the competition's own metric. */
export interface DaySeries {
  /** Participant key — the RSN, since guests have no clanMemberId. */
  rsn: string;
  /** Gain per day, index-aligned with {@link dayRange}. Missing days are 0. */
  days: number[];
}

const DAY_MS = 86_400_000;

/** UTC calendar day key, 'YYYY-MM-DD'. */
export function dayKey(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
}

/**
 * Every UTC day the competition covers, oldest first — the x-axis of the whole page.
 *
 * Capped at the competition's end, so a finished week doesn't grow a tail of empty days, and never
 * longer than `maxDays` (a mis-entered end date shouldn't render a thousand columns).
 */
export function dayRange(startIso: string, endIso: string, maxDays = 31): string[] {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const out: string[] = [];
  // A day belongs to the competition when the competition is still running at the START of it. An
  // end of "Aug 17, 00:00" therefore means the week finishes on the 16th — otherwise every board
  // grows an eighth column that nothing can ever be scored in.
  for (let t = Date.parse(`${dayKey(new Date(start))}T00:00:00Z`); t < end && out.length < maxDays; t += DAY_MS) {
    out.push(dayKey(new Date(t)));
  }
  return out.length > 0 ? out : [dayKey(new Date(start))];
}

/** How many of those days have actually happened. A finished competition is all of them. */
export function daysElapsed(days: string[], now: Date = new Date()): number {
  const today = dayKey(now);
  const n = days.filter((d) => d <= today).length;
  return Math.max(1, Math.min(days.length, n));
}

export interface DailyRow {
  rsn: string;
  day: string;
  /** Whole-day XP across every skill — the fallback for an overall/efficiency competition. */
  xpGained: number;
  ehpMilliGained: number;
  ehbMilliGained: number;
  /** Parsed `member_daily_stats.deltas`: only the metrics that moved that day. */
  deltas: { skills?: Record<string, number>; bosses?: Record<string, number> } | null;
}

/**
 * Pull the competition's own metric out of a day row.
 *
 * A day row holds every skill and boss that moved, so an Agility week has to read `skills.agility`
 * and nothing else — using the day's total XP would credit a member's Slayer grind to the Agility
 * board. Efficiency weeks read the milli-hour columns, which are already metric-specific.
 */
export function metricGain(row: DailyRow, type: CompetitionType, metric: string): number {
  if (type === 'efficiency') return metric === 'ehb' ? row.ehbMilliGained : row.ehpMilliGained;
  if (type === 'boss') return row.deltas?.bosses?.[metric] ?? 0;
  if (metric === 'overall') return row.xpGained;
  return row.deltas?.skills?.[metric] ?? 0;
}

/** Per-member day series over the competition's day range, in the given member order. */
export function buildSeries(
  rsns: string[],
  rows: DailyRow[],
  days: string[],
  type: CompetitionType,
  metric: string,
): DaySeries[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const byRsn = new Map<string, number[]>(rsns.map((r) => [r, days.map(() => 0)]));
  for (const row of rows) {
    const series = byRsn.get(row.rsn);
    const i = index.get(row.day);
    if (!series || i === undefined) continue;
    series[i] += metricGain(row, type, metric);
  }
  return rsns.map((rsn) => ({ rsn, days: byRsn.get(rsn) ?? days.map(() => 0) }));
}

/** Clan-wide total per day. */
export function dailyTotals(series: DaySeries[], dayCount: number): number[] {
  const out = new Array(dayCount).fill(0);
  for (const s of series) for (let i = 0; i < dayCount; i++) out[i] += s.days[i] ?? 0;
  return out;
}

/** Who gained the most on each day, or null for a day nobody scored. */
export function dailyLeaders(series: DaySeries[], dayCount: number): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < dayCount; i++) {
    let best: DaySeries | null = null;
    for (const s of series) if ((s.days[i] ?? 0) > (best?.days[i] ?? 0)) best = s;
    out.push(best && (best.days[i] ?? 0) > 0 ? best.rsn : null);
  }
  return out;
}

/** Running totals, for the race chart. */
export function cumulative(days: number[], upto: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < upto; i++) {
    sum += days[i] ?? 0;
    out.push(sum);
  }
  return out;
}

/** Longest run of consecutive days with any gain. */
export function activeStreak(days: number[], upto: number): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < upto; i++) {
    run = (days[i] ?? 0) > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Where the clan lands if the current pace holds. Null before a full day has passed — a projection
 * off four hours of data is a made-up number, and this one gets compared to the last competition.
 */
export function projectTotal(
  totalSoFar: number,
  elapsedDays: number,
  totalDays: number,
): number | null {
  if (elapsedDays < 1 || totalDays <= 0 || totalSoFar <= 0) return null;
  if (elapsedDays >= totalDays) return totalSoFar;
  return Math.round((totalSoFar / elapsedDays) * totalDays);
}

/**
 * Shade for one cell of the who-trained-when grid, 0–4.
 *
 * Log-scaled on purpose: one member doing 300k in a day and everyone else doing 5–20k is the normal
 * shape of a clan competition, and on a linear scale that flattens everybody but the leader into a
 * single shade — which is exactly the information the grid exists to show.
 */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (max <= 1) return 4;
  const f = Math.log(value) / Math.log(max);
  if (f > 0.94) return 4;
  if (f > 0.86) return 3;
  if (f > 0.74) return 2;
  return 1;
}

/**
 * The steadiest scorer — lowest spread across the days they could have played, among people who
 * actually turned up. Null when nobody has enough of a week to judge.
 */
export function mostConsistent(series: DaySeries[], upto: number): DaySeries | null {
  let best: { s: DaySeries; spread: number } | null = null;
  for (const s of series) {
    const days = s.days.slice(0, upto);
    const total = days.reduce((a, b) => a + b, 0);
    if (total <= 0 || days.length < 2) continue;
    const avg = total / days.length;
    const variance = days.reduce((acc, v) => acc + (v - avg) ** 2, 0) / days.length;
    const spread = Math.sqrt(variance) / avg;
    if (!best || spread < best.spread) best = { s, spread };
  }
  return best?.s ?? null;
}
