// Which detected milestones may be ANNOUNCED, as opposed to only recorded.
//
// detectMilestones (lib/statHistory) answers "which thresholds lie between these two snapshots".
// That is not the same as "which thresholds did this person cross just now": the previous snapshot
// can be weeks old (a seeded or restored database, an account the sweep had not reached, a deploy
// that left an environment unpolled), and then every step crossed in that time looks brand new. A
// clan channel then hears that someone at 10.5M Woodcutting "has reached 10M" — a crossing that
// happened long ago. That is what this gate stops.
//
// A milestone is announced only when it was crossed between two CONSECUTIVE, RECENT observations:
//
//   - there is a previous observation, and we know when it was taken;
//   - it is no older than MAX_SAMPLE_GAP_MS (the sweep's slowest idle cadence is 2h, a plugin
//     account is reconciled every few hours; a day is generous);
//   - the previous value of that metric is known and above zero (a skill or boss missing from the
//     old snapshot would otherwise "cross" every threshold up to today's value);
//   - the gain is physically possible in the time between the samples, at RATE_HEADROOM times the
//     best documented rate (lib/efficiency, src/data/hourRates.json).
//
// Everything else is still RECORDED (member_milestones), so the profile is complete and the same
// step can never be announced later either — "seen" is the dedupe. Pure: no DB.

import type { HiscoresSnapshot } from '@/lib/hiscores';
import type { Milestone } from '@/lib/statHistory';
import { bossKillsPerHour, computeEhpEhb, rateTableFor, xpPerHourAt, type RateTable } from '@/lib/efficiency';
import { SKILLS } from '@/lib/constants';
import { totalXpOf } from '@/lib/totalXpMilestones';

const HOUR_MS = 60 * 60 * 1000;

/** The oldest previous observation a crossing may be announced from. */
export const MAX_SAMPLE_GAP_MS = 24 * HOUR_MS;

/** How far above the best documented rate a gain may run before it is called impossible. */
export const RATE_HEADROOM = 3;

/**
 * The shortest time span a rate is judged over. The hiscores update when a player logs out, so one
 * poll a few minutes after the last can carry a whole session's gains; judging those against the
 * minutes between polls would refuse every honest long session. A session longer than this whose
 * gains beat three times the best rate is still refused, which is the point.
 */
export const MIN_RATE_WINDOW_MS = 6 * HOUR_MS;

export interface GateInput {
  before: HiscoresSnapshot | null;
  after: HiscoresSnapshot;
  /** When `before` was observed (ISO), or null when unknown. */
  previousAt: string | null | undefined;
  /** When `after` was observed. */
  now?: Date;
  /** The account type, for the ironman vs main rate table. */
  accountType?: string | null;
}

export interface GateResult {
  /** Crossed between two recent consecutive samples at a believable rate: post these. */
  announce: Milestone[];
  /** Real but not news (old gap, unknown previous value, impossible rate): record only. */
  silent: Milestone[];
  /** Why the silent ones are silent, for the log line. Null when everything is announced. */
  reason: string | null;
}

const xpOf = (s: HiscoresSnapshot | null, skill: string) => Math.max(0, s?.skills?.[skill]?.xp ?? 0);
const kcOf = (s: HiscoresSnapshot | null, boss: string) => Math.max(0, s?.bosses?.[boss]?.score ?? 0);

/** The best XP/hour this skill has in any band of the table, or null without a rate. */
export function bestXpPerHour(skill: string, table: RateTable): number | null {
  let best: number | null = null;
  for (let level = 1; level <= 99; level++) {
    const r = xpPerHourAt(skill, level, table);
    if (r != null && r > 0 && (best == null || r > best)) best = r;
  }
  return best;
}

/** The fastest skill's best rate: the ceiling for overall XP, which a person can pour into any skill. */
function bestAnyXpPerHour(table: RateTable): number | null {
  let best: number | null = null;
  for (const skill of SKILLS as readonly string[]) {
    if (skill === 'overall') continue;
    const r = bestXpPerHour(skill, table);
    if (r != null && (best == null || r > best)) best = r;
  }
  return best;
}

/** Why one milestone may not be announced from this pair of samples, or null if it may. */
function refuse(m: Milestone, input: GateInput, hours: number, table: RateTable): string | null {
  const { before, after } = input;
  const cap = (perHour: number | null, gained: number) =>
    perHour != null && perHour > 0 && gained > perHour * RATE_HEADROOM * hours ? 'impossible-rate' : null;

  switch (m.kind) {
    case 'xp':
    case 'level': {
      const skill = m.metric ?? '';
      const was = xpOf(before, skill);
      if (was <= 0) return 'no-previous-value';
      return cap(bestXpPerHour(skill, table), xpOf(after, skill) - was);
    }
    case 'kc': {
      const boss = m.metric ?? '';
      const was = kcOf(before, boss);
      if (was <= 0) return 'no-previous-value';
      return cap(bossKillsPerHour(boss, table), kcOf(after, boss) - was);
    }
    case 'totalxp': {
      const was = totalXpOf(before);
      if (!(was > 0)) return 'no-previous-value';
      return cap(bestAnyXpPerHour(table), totalXpOf(after) - was);
    }
    case 'ehp':
    case 'ehb': {
      const was = computeEhpEhb(before as HiscoresSnapshot)[m.kind];
      if (!(was > 0)) return 'no-previous-value';
      // Efficient hours are hours at the best rates: gaining more of them than RATE_HEADROOM times
      // the real hours that passed is impossible by definition.
      const gained = computeEhpEhb(after)[m.kind] - was;
      return gained > RATE_HEADROOM * hours ? 'impossible-rate' : null;
    }
    default:
      return 'unknown-kind';
  }
}

/** Split detected milestones into the ones to post and the ones to record silently. */
export function gateMilestones(found: Milestone[], input: GateInput): GateResult {
  if (found.length === 0) return { announce: [], silent: [], reason: null };
  const now = (input.now ?? new Date()).getTime();
  const prevMs = input.previousAt ? Date.parse(input.previousAt) : NaN;

  let whole: string | null = null;
  if (!input.before) whole = 'no-previous-sample';
  else if (!Number.isFinite(prevMs) || !Number.isFinite(now)) whole = 'previous-sample-time-unknown';
  else if (now - prevMs > MAX_SAMPLE_GAP_MS) whole = 'sample-gap-too-large';
  else if (now < prevMs) whole = 'previous-sample-in-future';
  if (whole) return { announce: [], silent: found, reason: whole };

  const hours = Math.max(now - prevMs, MIN_RATE_WINDOW_MS) / HOUR_MS;
  const table = rateTableFor(input.accountType);
  const announce: Milestone[] = [];
  const silent: Milestone[] = [];
  let reason: string | null = null;
  for (const m of found) {
    const why = refuse(m, input, hours, table);
    if (why) {
      silent.push(m);
      reason = reason ?? why;
    } else {
      announce.push(m);
    }
  }
  return { announce, silent, reason };
}
