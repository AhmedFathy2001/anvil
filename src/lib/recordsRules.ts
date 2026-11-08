// Records: best gain per account, metric and calendar period. The PURE half (no `@/db`) — period
// boundaries, baseline rollover and "did this beat the best" — so it can be tested without a database.
//
// The model is baselines, not history. For each account we keep ONE value-set per period: the totals
// at the start of the current day, ISO week, month and year (UTC). A gain is simply "now minus the
// baseline". When a period rolls over, the baseline is replaced by the last totals we saw before the
// rollover; nothing older is kept. A record row is only written when a gain beats the stored best.

import type { HiscoresSnapshot } from '@/lib/hiscores';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';

export const RECORD_PERIODS = ['day', 'week', 'month', 'year'] as const;
export type RecordPeriod = (typeof RECORD_PERIODS)[number];

/** Derived metrics recorded alongside every skill and boss. Our names, in hours. */
export const HOURS_PLAYED = 'hours_played';
export const HOURS_BOSSED = 'hours_bossed';

/** Metric → value. Skills are XP, bosses are KC, the two hours metrics are hours. */
export type MetricValues = Record<string, number>;

/** UTC start of the period containing `now`, as an ISO string. Weeks start on Monday. */
export function periodStart(period: RecordPeriod, now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  let t: number;
  switch (period) {
    case 'day':
      t = Date.UTC(y, m, d);
      break;
    case 'week': {
      const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
      t = Date.UTC(y, m, d - dow);
      break;
    }
    case 'month':
      t = Date.UTC(y, m, 1);
      break;
    case 'year':
      t = Date.UTC(y, 0, 1);
      break;
  }
  return new Date(t).toISOString();
}

/**
 * Flatten a snapshot to metric values. Unranked (-1) and missing entries are left out rather than
 * read as 0, so a boss that drops off the hiscores never looks like a negative gain.
 */
export function metricValues(
  snapshot: HiscoresSnapshot | null,
  hours?: { played: number; bossed: number } | null,
): MetricValues {
  const out: MetricValues = {};
  if (!snapshot) return out;
  for (const [k, v] of Object.entries(snapshot.skills ?? {})) {
    if (v && Number.isFinite(v.xp) && v.xp >= 0) out[k] = v.xp;
  }
  for (const [k, v] of Object.entries(snapshot.bosses ?? {})) {
    if (v && Number.isFinite(v.score) && v.score >= 0) out[k] = v.score;
  }
  if (hours) {
    if (Number.isFinite(hours.played)) out[HOURS_PLAYED] = hours.played;
    if (Number.isFinite(hours.bossed)) out[HOURS_BOSSED] = hours.bossed;
  }
  return out;
}

export interface Baseline {
  period: RecordPeriod;
  /** ISO start of the period this baseline belongs to. */
  periodStart: string;
  values: MetricValues;
}

/**
 * Which baselines need (re)writing for an update at `now`. A missing baseline or one from an
 * earlier period is replaced by `previous` — the last totals seen before this update, i.e. our best
 * knowledge of where the account stood when the period began. On an account's very first update
 * (`previous` empty) the baseline is the current totals, so nothing counts as gained.
 */
export function baselinesToRoll(
  existing: Baseline[],
  previous: MetricValues,
  current: MetricValues,
  now: Date,
): Baseline[] {
  const byPeriod = new Map(existing.map((b) => [b.period, b]));
  const start = Object.keys(previous).length > 0 ? previous : current;
  const out: Baseline[] = [];
  for (const period of RECORD_PERIODS) {
    const want = periodStart(period, now);
    const have = byPeriod.get(period);
    if (!have || have.periodStart !== want) out.push({ period, periodStart: want, values: { ...start } });
  }
  return out;
}

/**
 * Gains in one period for the metrics that moved. A metric absent from the baseline (new boss on the
 * hiscores, or a value that was unranked at period start) gains nothing this period: we can't tell
 * how much of its total is new.
 */
export function periodGains(baseline: MetricValues, current: MetricValues, metrics: Iterable<string>): MetricValues {
  const out: MetricValues = {};
  for (const m of metrics) {
    const from = baseline[m];
    const to = current[m];
    if (from === undefined || to === undefined) continue;
    const gain = to - from;
    if (gain > 0) out[m] = gain;
  }
  return out;
}

/** Metrics whose value changed between two value-sets (only these can set a record). */
export function movedMetrics(previous: MetricValues, current: MetricValues): string[] {
  return Object.keys(current).filter((k) => previous[k] !== undefined && current[k] !== previous[k]);
}

export interface RecordCandidate {
  metric: string;
  period: RecordPeriod;
  value: number;
  startedAt: string;
}

/** Keep only candidates that beat the stored best for their (metric, period). */
export function improvements(
  candidates: RecordCandidate[],
  best: Map<string, number>,
): RecordCandidate[] {
  return candidates.filter((c) => {
    const have = best.get(`${c.metric}|${c.period}`);
    // Hours carry float noise from the rate tables; ignore sub-second "improvements".
    const epsilon = c.metric === HOURS_PLAYED || c.metric === HOURS_BOSSED ? 1e-3 : 0;
    return have === undefined || c.value > have + epsilon;
  });
}

export const recordKey = (metric: string, period: RecordPeriod) => `${metric}|${period}`;

/** What a record metric is called on screen. */
export function recordMetricLabel(metric: string): string {
  if (metric === HOURS_PLAYED) return 'Efficient hours played';
  if (metric === HOURS_BOSSED) return 'Efficient hours bossed';
  return SKILL_LABELS[metric] ?? BOSSES.find((b) => b.key === metric)?.label ?? metric;
}

export type RecordKind = 'skill' | 'boss' | 'hours';

export function recordMetricKind(metric: string): RecordKind {
  if (metric === HOURS_PLAYED || metric === HOURS_BOSSED) return 'hours';
  return SKILL_LABELS[metric] ? 'skill' : 'boss';
}

/** "1.2m XP", "34 kills", "5.3 h". */
export function formatRecordValue(metric: string, value: number): string {
  const kind = recordMetricKind(metric);
  if (kind === 'hours') return `${value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString('en-US')} h`;
  if (kind === 'skill') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}m XP`;
    if (value >= 10_000) return `${Math.round(value / 1000)}k XP`;
    return `${Math.round(value).toLocaleString('en-US')} XP`;
  }
  return `${Math.round(value).toLocaleString('en-US')} ${value === 1 ? 'kill' : 'kills'}`;
}

// ── Backfill from daily history ──────────────────────────────────────────────────────────────────

/** The slice of a member_daily_stats row the backfill reads. */
export interface DailyHistoryRow {
  day: string; // 'YYYY-MM-DD' (UTC)
  xpGained: number;
  ehpMilliGained: number;
  ehbMilliGained: number;
  /** JSON `{ skills: { slayer: 412000 }, bosses: { zulrah: 140 } }`, or null. */
  deltas: string | null;
}

export interface BackfillRecord extends RecordCandidate {
  /** ISO of the last day with gains inside the best period. */
  endedAt: string;
}

function dayMetrics(row: DailyHistoryRow): MetricValues {
  const out: MetricValues = {};
  if (row.xpGained > 0) out.overall = row.xpGained;
  if (row.ehpMilliGained > 0) out[HOURS_PLAYED] = row.ehpMilliGained / 1000;
  if (row.ehbMilliGained > 0) out[HOURS_BOSSED] = row.ehbMilliGained / 1000;
  if (row.deltas) {
    try {
      const d = JSON.parse(row.deltas) as { skills?: MetricValues; bosses?: MetricValues };
      for (const group of [d.skills, d.bosses]) {
        for (const [k, v] of Object.entries(group ?? {})) {
          if (Number.isFinite(v) && v > 0) out[k] = (out[k] ?? 0) + v;
        }
      }
    } catch {
      // A corrupt blob loses that day's per-metric detail, not the whole backfill.
    }
  }
  return out;
}

/**
 * Best day / week / month / year per metric from stored daily rows, bucketed on the SAME calendar
 * periods the live records use (UTC days, Monday weeks, months, years) so the two sources compare
 * like with like. Pure: the caller reads the rows and writes the result.
 */
export function backfillRecords(rows: DailyHistoryRow[]): BackfillRecord[] {
  // period → bucket start → metric → { sum, lastDay }
  const buckets = new Map<string, Map<string, { sum: number; lastDay: string }>>();
  for (const row of rows) {
    const at = new Date(`${row.day}T00:00:00Z`);
    if (Number.isNaN(at.getTime())) continue;
    const metrics = dayMetrics(row);
    for (const period of RECORD_PERIODS) {
      const start = periodStart(period, at);
      for (const [metric, value] of Object.entries(metrics)) {
        const key = `${period}|${start}|${metric}`;
        let perPeriod = buckets.get(period);
        if (!perPeriod) buckets.set(period, (perPeriod = new Map()));
        const have = perPeriod.get(key);
        if (have) {
          have.sum += value;
          if (row.day > have.lastDay) have.lastDay = row.day;
        } else perPeriod.set(key, { sum: value, lastDay: row.day });
      }
    }
  }
  const best = new Map<string, BackfillRecord>();
  for (const [period, perPeriod] of buckets) {
    for (const [key, { sum, lastDay }] of perPeriod) {
      const [, start, metric] = key.split('|');
      const id = `${metric}|${period}`;
      const have = best.get(id);
      if (!have || sum > have.value) {
        best.set(id, { metric, period: period as RecordPeriod, value: sum, startedAt: start, endedAt: `${lastDay}T00:00:00.000Z` });
      }
    }
  }
  return [...best.values()].sort((a, b) => (a.metric + a.period).localeCompare(b.metric + b.period));
}
