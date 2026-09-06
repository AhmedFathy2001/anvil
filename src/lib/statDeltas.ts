// What moved between two hiscores snapshots, and how two of those combine.
//
// Split out of lib/statHistory, which writes the rows and so imports `@/db`. Both functions here are
// arithmetic over a pair of JSON blobs — they open nothing — so testing them should not need a
// connection string. Same split lib/cofferMath already makes from lib/coffer.
//
// lib/statHistory re-exports them, so importers do not need to know this file exists.

import type { HiscoresSnapshot } from '@/lib/hiscores';

export interface StatDeltas {
  skills?: Record<string, number>;
  bosses?: Record<string, number>;
}

/**
 * What moved between two snapshots. Only changed metrics appear — that's the difference between a
 * ~150-byte row and a 3 KB one, repeated for every member every day.
 */
export function computeDeltas(before: HiscoresSnapshot | null, after: HiscoresSnapshot): StatDeltas {
  const deltas: StatDeltas = {};
  for (const [key, entry] of Object.entries(after.skills ?? {})) {
    if (key === 'overall') continue; // the total is stored as a column; repeating it here is noise
    const now = Math.max(0, entry?.xp ?? 0);
    const then = Math.max(0, before?.skills?.[key]?.xp ?? 0);
    if (before && now > then) (deltas.skills ??= {})[key] = now - then;
  }
  for (const [key, entry] of Object.entries(after.bosses ?? {})) {
    const now = Math.max(0, entry?.score ?? 0);
    const then = Math.max(0, before?.bosses?.[key]?.score ?? 0);
    if (before && now > then) (deltas.bosses ??= {})[key] = now - then;
  }
  return deltas;
}

/**
 * Add one tick's deltas onto the day's running ones.
 *
 * WHY THIS EXISTS. A day is many ticks, and each one only reports what moved SINCE THE LAST FETCH.
 * The row's numeric columns accumulate in SQL, but this JSON used to be overwritten every tick, so a
 * day's per-metric detail collapsed to whatever happened in its final 15 minutes. That biased the
 * data against exactly the people it was meant to celebrate: an idle member polled once every two
 * hours had a whole session land in one delta and kept it, while someone playing all evening — polled
 * every tick, because gaining XP resets the backoff — kept only their last slice. Their per-skill
 * totals came out SMALLER than a quieter member's, which is how a competition leader ends up drawn
 * underneath the people he's beating.
 */
export function mergeDeltas(before: StatDeltas | null, add: StatDeltas): StatDeltas {
  const out: StatDeltas = {};
  for (const group of ['skills', 'bosses'] as const) {
    const merged = { ...(before?.[group] ?? {}) };
    for (const [key, value] of Object.entries(add[group] ?? {})) {
      merged[key] = (merged[key] ?? 0) + value;
    }
    if (Object.keys(merged).length > 0) out[group] = merged;
  }
  return out;
}
