// Luck: how many of a thing someone has, against how many the rate says they should.
//
// The obvious model — "do they have it?" — is wrong in both directions, and a clan will tell you so
// within a day. One enhanced weapon seed at 30,000 Gauntlet is not a lucky player who owns the item;
// it's someone owed about fourteen more. And a player sitting near the rate is not a story at all,
// in either direction.
//
// So there is ONE axis, counts rather than presence: how many drops did the rate owe you by now, how
// many did you get, and how surprising is the gap. Dry and spooned are the two tails of it, with a
// wide neutral band in the middle where most of a clan correctly sits.
//
// This also means the whole existing collection log can be assessed today. The log records how many
// of each item someone has obtained, and the hiscores record the kills — no per-drop history needed,
// which is what made "when exactly did that drop?" a dead end for everything already in the ground.
//
// The maths is a Poisson approximation to the binomial: kills are many, per-kill chance is small,
// and that's precisely where it's near-exact. No pity timers, no bad-luck protection — OSRS has
// neither.

/** One roll's chance, from the wiki dataset's 1-in-N denominator. */
export function chancePerKill(denominator: number, rollsPerKill = 1): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  const single = 1 / denominator;
  const rolls = Number.isFinite(rollsPerKill) && rollsPerKill > 0 ? rollsPerKill : 1;
  // The overwhelmingly common case, returned exactly: 1 - (1 - 1/100)^1 drifts to 0.010000000000009,
  // which is invisible in a percentage and very visible on a threshold comparison.
  if (rolls === 1) return single;
  // Independent rolls per kill: the chance of at least one hit, not rolls × chance (which passes 1).
  return 1 - Math.pow(1 - single, rolls);
}

/** How many you'd expect by now. 1.0 = exactly on rate. */
export function expectedDrops(chance: number, kills: number): number {
  const raw = chance * Math.max(0, kills);
  // Rounded to a place no display shows, so band comparisons against round numbers aren't decided
  // by floating-point drift.
  return Math.round(raw * 1e9) / 1e9;
}

/** Probability of STILL having none after `kills` — the special case people quote for a first drop. */
export function chanceOfNothing(chance: number, kills: number): number {
  if (chance <= 0 || kills <= 0) return 1;
  return Math.pow(1 - chance, kills);
}

/**
 * P(X ≤ k) for X ~ Poisson(expected). The chance of being AT MOST this fortunate.
 *
 * Poisson stands in for the binomial because n is large and p tiny — the error is far below anything
 * this is used to say. Summed term by term from the bottom, which is stable for the small means
 * (single digits) that drop rates produce.
 */
export function poissonAtMost(k: number, expected: number): number {
  if (expected <= 0) return 1;
  if (k < 0) return 0;
  const floor = Math.floor(k);
  let term = Math.exp(-expected);
  let sum = term;
  for (let i = 1; i <= floor; i++) {
    term = (term * expected) / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/** P(X ≥ k) — the chance of being AT LEAST this fortunate. */
export function poissonAtLeast(k: number, expected: number): number {
  if (k <= 0) return 1;
  return Math.max(0, 1 - poissonAtMost(k - 1, expected));
}

export type LuckVerdict = 'dry' | 'on-rate' | 'spooned';

/**
 * How unlikely a result has to be before it's worth saying out loud. At 5% each way, a board of
 * twenty entries is twenty genuine outliers rather than a leaderboard of ordinary people.
 */
export const TAIL_THRESHOLD = 0.05;

export interface LuckAssessment {
  kills: number;
  /** How many they actually have — the collection log's own count, not a presence flag. */
  obtained: number;
  expected: number;
  /** obtained ÷ expected. 1 is on rate; 0.07 is the enhanced seed at 30k. */
  ratio: number;
  /** dry / on-rate / spooned. Most people are on rate, and the model should say so. */
  verdict: LuckVerdict;
  /** How surprising the result is, 0–1. Small = remarkable, whichever tail it's in. */
  tail: number;
  /** True when this is worth a place on a board. */
  notable: boolean;
}

/**
 * Assess one member against one drop.
 *
 * Owning the item does not end the question — quantity is the question. Someone with one seed where
 * the rate owed fifteen is the driest person in the clan, and the old presence-based model called
 * them lucky and moved on.
 */
export function assessLuck(chance: number, kills: number, obtained: number): LuckAssessment {
  const expected = expectedDrops(chance, kills);
  const got = Math.max(0, obtained);
  const dryTail = poissonAtMost(got, expected);
  const spoonTail = poissonAtLeast(got, expected);

  let verdict: LuckVerdict = 'on-rate';
  if (expected > 0) {
    if (dryTail < TAIL_THRESHOLD) verdict = 'dry';
    else if (spoonTail < TAIL_THRESHOLD) verdict = 'spooned';
  }

  return {
    kills,
    obtained: got,
    expected,
    ratio: expected > 0 ? got / expected : 0,
    verdict,
    tail: verdict === 'dry' ? dryTail : verdict === 'spooned' ? spoonTail : Math.min(dryTail, spoonTail),
    // Nothing to say about somebody who has barely started: at fewer than half an expected drop,
    // every result is the same result.
    notable: verdict !== 'on-rate' && expected >= 0.5,
  };
}

/** "1 in 512" — the way a rate is spoken about in game. */
export function formatRate(denominator: number): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return 'unknown';
  return `1 in ${denominator >= 100 ? Math.round(denominator).toLocaleString() : denominator.toFixed(1)}`;
}

/** "3.2×" — the multiple of expectation, which is how players compare these to each other. */
export function formatMultiple(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}×`;
}

/** "got 1 of 15" — the plain sentence under a board entry, before any statistics. */
export function formatCount(obtained: number, expected: number): string {
  const owed = expected >= 10 ? Math.round(expected).toLocaleString() : expected.toFixed(1);
  return `${obtained.toLocaleString()} of ${owed} expected`;
}

/**
 * The one-in-N phrasing of a tail probability: a 1.2% result reads better as "1 in 83 people end up
 * here" than as a decimal nobody converts in their head.
 */
export function formatOdds(tail: number): string | null {
  if (!Number.isFinite(tail) || tail <= 0 || tail >= 1) return null;
  const n = Math.round(1 / tail);
  return n >= 2 ? `1 in ${n.toLocaleString()}` : null;
}
