// Implausible-gain detection for weekly competitions (SOTW / BOTW).
//
// WHY THIS EXISTS
// OSRS hiscores only refresh when a player logs out. If someone is grinding a
// skill across the moment a competition starts and stays logged in, the baseline
// we capture at the start is *stale* (their last logout total). When they finally
// log out mid-competition, hiscores jump by the WHOLE session — including the XP
// earned before the comp began — and `current - baseline` sweeps that pre-event XP
// into their "gained". There is no way to separate pre- vs in-window XP from
// hiscores data alone (Wise Old Man has the same limitation for non-plugin users).
//
// So instead of trying to *prevent* it, we *detect* it: if the CUMULATIVE gained amount
// could not physically have been earned in the elapsed competition time, flag the row so
// an admin can correct the baseline by hand.
//
// IMPORTANT: measure over the whole competition, NOT the 15-min sweep interval. Because
// hiscores only move on logout, a legit multi-hour grind lands in a SINGLE sweep — so
// `delta / sweep-interval` looks impossibly fast (e.g. 542K fishing in one 15-min tick =
// 2.1M xp/hr) and false-flags honest play. `totalGain / hours-since-comp-start` is the
// real rate: 542K over two days is ~11K xp/hr — trivially plausible. Only a total that
// exceeds the metric's max sustained rate for the ELAPSED comp time is physically
// impossible, which is the genuine stale-baseline tell.
//
// This module is pure (no server/db imports) so it can run in the admin client too.

// Realistic maximum sustained XP/hour per skill. These are intentionally GENEROUS
// (set above the best-known meta rates, with headroom) so we only ever flag the
// physically-impossible, never an elite-but-legit grinder. Tune as methods change.
//
// Notes on the spiky ones:
//  - farming/overall are effectively unbounded in short windows (a single tree run
//    dumps huge instant XP), so their caps are very high — practically "don't flag".
//  - ranged/construction/herblore/fletching/cooking have genuinely high meta rates
//    (chinning, mahogany homes, dart fletching, 1-tick wines), hence the big numbers.
export const SKILL_MAX_XP_PER_HOUR: Record<string, number> = {
  overall: 5_000_000,
  attack: 350_000,
  defence: 350_000,
  strength: 350_000,
  hitpoints: 350_000,
  ranged: 1_200_000,
  prayer: 1_200_000,
  magic: 700_000,
  cooking: 1_200_000,
  woodcutting: 250_000,
  fletching: 1_500_000,
  fishing: 150_000,
  firemaking: 700_000,
  crafting: 600_000,
  smithing: 600_000,
  mining: 200_000,
  herblore: 1_500_000,
  agility: 150_000,
  thieving: 400_000,
  slayer: 200_000,
  farming: 5_000_000,
  runecraft: 150_000,
  hunter: 400_000,
  construction: 2_000_000,
  sailing: 500_000,
};

// Default boss KC/hour cap — generous enough to never flag normal farming of fast
// bosses, low enough to catch absurd jumps. Slow / long-form content is overridden
// below because even a modest KC there is impossible in a short window.
export const DEFAULT_BOSS_MAX_KC_PER_HOUR = 100;

export const BOSS_MAX_KC_PER_HOUR: Record<string, number> = {
  // Raids (long runs)
  chambersOfXeric: 12,
  chambersOfXericChallengeMode: 8,
  theatreOfBlood: 12,
  theatreOfBloodHardMode: 10,
  tombsOfAmascut: 14,
  tombsOfAmascutExpertMode: 12,
  // Solo gauntlet
  gauntlet: 12,
  corruptedGauntlet: 10,
  // Inferno / fight caves / colosseum (very long)
  tzKalZuk: 2,
  tzTokJad: 5,
  solHeredit: 4,
  doomOfMokhaiotl: 6,
  // Heavy duos / trios / long solos
  nex: 12,
  nightmare: 15,
  phosanisNightmare: 10,
  corporealBeast: 20,
};

// Efficiency is the one metric whose ceiling isn't a guess: an efficient hour is DEFINED as an hour
// of play at the best known rates, so nobody can gain more than 1.0 per hour elapsed. Stored in
// milli-hours, that's 1000/hour. The headroom absorbs a rate table that lags a new method (a fresh
// best-in-slot can briefly beat the published rate) rather than flagging honest play.
export const EFFICIENCY_MAX_MILLI_PER_HOUR = 1200;

export function getMaxRatePerHour(type: string, metric: string): number {
  if (type === 'efficiency') return EFFICIENCY_MAX_MILLI_PER_HOUR;
  if (type === 'boss') {
    return BOSS_MAX_KC_PER_HOUR[metric] ?? DEFAULT_BOSS_MAX_KC_PER_HOUR;
  }
  return SKILL_MAX_XP_PER_HOUR[metric] ?? 1_500_000;
}

// Below these absolute cumulative gains we never flag, regardless of rate — keeps small
// honest totals from lighting up the board while a comp is only minutes old.
const SKILL_GAIN_FLOOR = 50_000;
const BOSS_GAIN_FLOOR = 30;
// Half an efficient hour. Below that the elapsed-time divisor is doing all the work and every
// early-comp reading looks like a spike.
const EFFICIENCY_GAIN_FLOOR = 500;

export interface RateCheckInput {
  type: string; // 'skill' | 'boss'
  metric: string;
  gained: number; // CUMULATIVE gain so far (current - baseline): xp for skills, KC for bosses
  sinceIso: string | null; // elapsed-time anchor — the competition start (baseline-capture proxy)
  toIso: string; // "now" for this check
  now?: number; // injectable for tests / fallback when toIso is unparseable
}

export interface RateCheckResult {
  flagged: boolean;
  ratePerHour: number;
  maxRatePerHour: number;
  hours: number;
}

const NOT_FLAGGED: RateCheckResult = {
  flagged: false,
  ratePerHour: 0,
  maxRatePerHour: 0,
  hours: 0,
};

/**
 * Decide whether a participant's CUMULATIVE gain is physically impossible for the elapsed
 * competition time. Rate = totalGain / hours-since-comp-start; if it beats the metric's max
 * sustained rate, the total couldn't have been earned since the comp began — the stale-baseline
 * tell. Measuring over the whole comp (not the sweep interval) is what stops honest logout
 * flushes from false-flagging: the XP lands in one tick but was earned over hours.
 */
export function checkRateSpike(input: RateCheckInput): RateCheckResult {
  const { type, metric, gained } = input;
  if (!(gained > 0)) return NOT_FLAGGED;

  const floor =
    type === 'efficiency' ? EFFICIENCY_GAIN_FLOOR : type === 'boss' ? BOSS_GAIN_FLOOR : SKILL_GAIN_FLOOR;
  if (gained < floor) return NOT_FLAGGED;

  if (!input.sinceIso) return NOT_FLAGGED; // no comp-start anchor to measure against
  const fromMs = Date.parse(input.sinceIso);
  const toMs = Number.isNaN(Date.parse(input.toIso)) ? (input.now ?? Date.now()) : Date.parse(input.toIso);
  if (Number.isNaN(fromMs)) return NOT_FLAGGED;

  const hours = (toMs - fromMs) / 3_600_000;
  if (!(hours > 0)) return NOT_FLAGGED;

  const maxRatePerHour = getMaxRatePerHour(type, metric);
  const ratePerHour = gained / hours;

  return {
    flagged: ratePerHour > maxRatePerHour,
    ratePerHour,
    maxRatePerHour,
    hours,
  };
}

/**
 * Human-readable summary stored in weekly_participants.flag_reason and shown in the
 * admin UI tooltip.
 */
export function describeRateSpike(type: string, result: RateCheckResult): string {
  const unit = type === 'efficiency' ? 'EH/hr' : type === 'boss' ? 'KC/hr' : 'xp/hr';
  const elapsed = result.hours >= 1 ? `${Math.round(result.hours)}h` : `${Math.round(result.hours * 60)}m`;
  // Efficiency rates are carried in milli-hours; nobody wants to read "1200 EH/hr".
  const fmt = (n: number) =>
    type === 'efficiency' ? (n / 1000).toFixed(2) : Math.round(n).toLocaleString();
  return `~${fmt(result.ratePerHour)} ${unit} averaged over ${elapsed} (max ~${fmt(result.maxRatePerHour)} ${unit}) — more than the metric allows for the elapsed comp time; likely a stale baseline swept in pre-event progress`;
}
