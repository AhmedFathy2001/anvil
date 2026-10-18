// A repeating Skill / Boss of the Week: what the next one is. Pure — tests/weekly-repeat.test.ts.
//
// A repeating competition starts its successor the moment it ends: same kind, same length, the next
// skill or boss in its rotation (or the same one when there is no rotation). If the cron was down
// across one or more whole weeks, the successor starts in the window that contains now, rather than
// in the past where it would be born already finished.

import { BOSSES, EFFICIENCY_METRICS, SKILL_LABELS } from '@/lib/constants';

export interface RepeatConfig {
  /** The metrics to cycle through, in order. Null or empty = repeat the same one every time. */
  rotation: string[] | null;
}

export function parseRepeat(raw: string | null | undefined): RepeatConfig | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const rotation = Array.isArray(v.rotation) ? v.rotation.filter((m: unknown) => typeof m === 'string' && m) : null;
    return { rotation: rotation && rotation.length > 0 ? rotation : null };
  } catch {
    return null;
  }
}

/** 'SOTW: Agility' — what a competition calls itself when nobody renamed it. */
export function defaultWeeklyTitle(type: string, metric: string): string {
  const label =
    type === 'skill'
      ? SKILL_LABELS[metric] ?? metric
      : type === 'boss'
        ? BOSSES.find((b) => b.key === metric)?.label ?? metric
        : EFFICIENCY_METRICS.find((m) => m.key === metric)?.label ?? metric.toUpperCase();
  return `${type === 'boss' ? 'BOTW' : type === 'efficiency' ? 'Efficiency' : 'SOTW'}: ${label}`;
}

export function nextMetric(current: string, cfg: RepeatConfig): string {
  const r = cfg.rotation;
  if (!r || r.length === 0) return current;
  const i = r.indexOf(current);
  return r[(i + 1) % r.length];
}

export function nextWindow(prev: { startDate: string; endDate: string }, now: number): { startDate: string; endDate: string } {
  const start = Date.parse(prev.startDate);
  const end = Date.parse(prev.endDate);
  const length = Math.max(3_600_000, end - start); // never a zero-length competition
  let s = end;
  while (s + length <= now) s += length;
  return { startDate: new Date(s).toISOString(), endDate: new Date(s + length).toISOString() };
}
