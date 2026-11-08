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
