// What a Skill or Boss of the Week may be asked to count. Pure — tests/weekly-metric-input.test.ts.
//
// A competition's `metric` is one hiscores key, or several comma-separated that are read as their
// SUM (lib/constants metricKeys): a raid across its modes, several bosses, several skills. The
// create form builds that list, but the list is just text in a request, so the server checks it
// here: a key the hiscores do not have makes a competition that never scores (every read of it is a
// failed read — lib/weeklyMetric), and nothing would say why.

import { BOSSES, SKILLS, bossMetricPicks, metricKeys } from '@/lib/constants';

/** The most skills or bosses one competition adds together. Every one is read for every entrant. */
export const MAX_WEEKLY_METRIC_KEYS = 10;

export type WeeklyMetricCheck = { ok: true; metric: string } | { ok: false; error: string };

/**
 * Check a skill or boss metric as sent, and return it tidied: trimmed, no repeats, comma-joined.
 * Other competition types have their own rules (efficiency is ehp|ehb, a hunt writes its own) and
 * pass through untouched.
 */
export function checkWeeklyMetric(type: string, raw: unknown): WeeklyMetricCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Pick what the competition counts.' };
  if (type !== 'skill' && type !== 'boss') return { ok: true, metric: raw };
  const noun = type === 'skill' ? 'skill' : 'boss';
  const keys = [...new Set(metricKeys(raw))];
  if (keys.length === 0) return { ok: false, error: `Pick a ${noun}.` };
  if (keys.length > MAX_WEEKLY_METRIC_KEYS) {
    return { ok: false, error: `One competition can add up ${MAX_WEEKLY_METRIC_KEYS} ${type === 'skill' ? 'skills' : 'bosses'} at most.` };
  }
  const known: readonly string[] = type === 'skill' ? SKILLS : BOSSES.map((b) => b.key);
  const unknown = keys.find((k) => !known.includes(k));
  if (unknown) return { ok: false, error: `"${unknown}" is not a ${noun} the hiscores list.` };
  // Overall already IS every skill added together: beside another skill it would count that
  // skill's XP twice.
  if (type === 'skill' && keys.length > 1 && keys.includes('overall')) {
    return { ok: false, error: 'Overall already counts every skill. Pick it alone, or pick the skills you want without it.' };
  }
  return { ok: true, metric: keys.join(',') };
}

/**
 * A metric as the entries of the create form's picker, and back. A boss entry is one boss or one
 * raid "any mode" (lib/constants bossMetricPicks); a skill entry is one skill.
 */
export function weeklyMetricPicks(type: string, metric: string): string[] {
  if (type === 'boss') return bossMetricPicks(metric);
  if (type === 'skill') return [...new Set(metricKeys(metric))];
  return metric ? [metric] : [];
}

export function joinWeeklyMetricPicks(picks: string[]): string {
  return [...new Set(picks.flatMap(metricKeys))].join(',');
}
