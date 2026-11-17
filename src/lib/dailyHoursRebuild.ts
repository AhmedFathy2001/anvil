// Redoing the stored daily hours of the days recorded under the OLD hours model.
//
// member_daily_stats keeps what each account gained per day, in hours, as numbers. When the model
// changed (lib/efficiency: Slayer's combat XP counted once, skilling bosses out of hours bossed,
// wiki rates, bossing no longer counted twice) those stored days kept the old, bigger figures, so
// the roster's 7d column and the week's leaders only came right as old days aged out.
//
// Each row also keeps exactly what moved that day (`deltas`: XP per skill, kills per boss). Walking
// back from the account's snapshot today, taking each day's movement off, gives the account as it
// stood at the start and end of every day, and so the day's hours under today's model.
//
// Pure: lib/dailyHoursRebuildDb reads and writes; the tests drive this directly.

import { EFFICIENCY_SCALE } from './constants.ts';
import { computeEhpEhb } from './efficiency.ts';
import type { HiscoresSnapshot } from './hiscores.ts';
import type { StatDeltas } from './statDeltas.ts';

export interface DayMovement {
  day: string;
  deltas: StatDeltas | null;
}

/** A copy of `after` with one day's movement taken off: the account as that day began. */
export function beforeDay(after: HiscoresSnapshot, deltas: StatDeltas | null): HiscoresSnapshot {
  const skills = { ...after.skills };
  for (const [key, gained] of Object.entries(deltas?.skills ?? {})) {
    const s = skills[key];
    if (s) skills[key] = { ...s, xp: Math.max(0, (s.xp ?? 0) - gained) };
  }
  const bosses = { ...after.bosses };
  for (const [key, gained] of Object.entries(deltas?.bosses ?? {})) {
    const b = bosses[key];
    if (b) bosses[key] = { ...b, score: Math.max(0, (b.score ?? 0) - gained) };
  }
  return { skills, bosses };
}

/** One day's hours under today's model, between the account at its start and at its end. */
export function dayHours(start: HiscoresSnapshot, end: HiscoresSnapshot): { ehpMilliGained: number; ehbMilliGained: number } {
  const a = computeEhpEhb(start);
  const b = computeEhpEhb(end);
  const ehb = Math.max(0, Math.round((b.ehb - a.ehb) * EFFICIENCY_SCALE));
  let ehp = Math.max(0, Math.round((b.ehp - a.ehp) * EFFICIENCY_SCALE));
  // An hour at a boss is hours bossed; the combat XP it gave is not a second hour (lib/statHistory).
  const combat = Math.max(0, Math.round((b.combat - a.combat) * EFFICIENCY_SCALE));
  ehp = Math.max(0, ehp - Math.min(combat, ehb));
  return { ehpMilliGained: ehp, ehbMilliGained: ehb };
}

/**
 * Every given day's hours, from the account's snapshot now and its days NEWEST FIRST (all of them
 * back to the oldest day wanted, with none skipped: a later day's movement has to come off first).
 */
export function rebuildDays(current: HiscoresSnapshot, days: DayMovement[]): Map<string, { ehpMilliGained: number; ehbMilliGained: number }> {
  const out = new Map<string, { ehpMilliGained: number; ehbMilliGained: number }>();
  let end = current;
  for (const d of days) {
    const start = beforeDay(end, d.deltas);
    out.set(d.day, dayHours(start, end));
    end = start;
  }
  return out;
}
