// Spoons and dry streaks — how lucky a member has been, from what they own and how long they spent.
//
// Two questions, and they need different evidence:
//
//   DRY   — "you have 1,400 Zulrah and no pet". Answerable from what we already hold: the boss KC on
//           the hiscores, the drop rate from the wiki dataset, and the absence of the item.
//   SPOON — "you got it in 12". Needs the KC AT THE MOMENT it dropped, which the hiscores can never
//           tell us after the fact — a spooned pet at 12 KC looks identical to a dry one at 3,000
//           once they've killed it 3,000 times. So it is only knowable for unlocks we watched
//           happen (`member_clog_items.kcAtUnlock`), and the board says so rather than guessing.
//
// The maths is the standard geometric one and stays deliberately plain: p per kill, independent
// rolls, no pity. It is a talking point for a clan Discord, not an actuarial model.

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

/** Probability of STILL not having it after `kills` kills. The number a dry streak really is. */
export function chanceOfNothing(chance: number, kills: number): number {
  if (chance <= 0 || kills <= 0) return 1;
  return Math.pow(1 - chance, kills);
}

/** How many you'd expect by now. 1.0 = exactly on rate. */
export function expectedDrops(chance: number, kills: number): number {
  const raw = chance * Math.max(0, kills);
  // Rounded to a place no display shows. Both thresholds below are equality-ish comparisons against
  // round numbers (2× the rate, a tenth of it), and 0.1 arriving as 0.10000000000000009 decides them
  // the wrong way — a spoon at exactly a tenth of the rate is a spoon.
  return Math.round(raw * 1e9) / 1e9;
}

export interface DryVerdict {
  /** Kills done with nothing to show. */
  kills: number;
  /** How many drops the rate says they should have had. */
  expected: number;
  /** Share of players who'd still be waiting at this point, 0–1. Lower = more remarkable. */
  luckPercentile: number;
  /** True once they're past the point where most people have it — the threshold for a board entry. */
  notable: boolean;
}

/**
 * How dry is this? Notable at 2× the drop rate: past that, more than 85% of people have it, which is
 * where "unlucky" stops being noise. Below it, someone with 40 Zulrah kills and no pet is not dry,
 * they are new — and a board that says otherwise is a board nobody trusts.
 */
export function assessDry(chance: number, kills: number): DryVerdict {
  const expected = expectedDrops(chance, kills);
  return {
    kills,
    expected,
    luckPercentile: chanceOfNothing(chance, kills),
    notable: expected >= 2,
  };
}

export interface SpoonVerdict {
  /** KC when it dropped, as recorded the moment we first saw the unlock. */
  kills: number;
  expected: number;
  /** Share of players who'd have it this early, 0–1. Lower = luckier. */
  luckPercentile: number;
  /** True when it landed well inside the rate — the threshold for a board entry. */
  notable: boolean;
}

/**
 * How spooned is this? Notable when it came inside a tenth of the drop rate — a Twisted bow at 30
 * CoX, not at 400. The percentile is the honest measure and the board sorts on it; `notable` just
 * keeps "got it slightly early" off a list of legends.
 */
export function assessSpoon(chance: number, killsAtUnlock: number): SpoonVerdict {
  const expected = expectedDrops(chance, killsAtUnlock);
  return {
    kills: killsAtUnlock,
    expected,
    // The chance of having it by this kill is what "how lucky" means for an unlock that happened.
    luckPercentile: 1 - chanceOfNothing(chance, killsAtUnlock),
    notable: expected > 0 && expected <= 0.1,
  };
}

/** "1 in 512" — the way a rate is spoken about in game. */
export function formatRate(denominator: number): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return 'unknown';
  return `1 in ${denominator >= 100 ? Math.round(denominator).toLocaleString() : denominator.toFixed(1)}`;
}

/**
 * "3.2× dry" / "spooned at 0.04×" — the multiple of the drop rate, which is how players actually
 * compare these to each other. Null when there's no rate to compare against.
 */
export function formatMultiple(expected: number): string | null {
  if (!Number.isFinite(expected) || expected <= 0) return null;
  return `${expected >= 10 ? Math.round(expected) : expected.toFixed(1)}×`;
}

/**
 * The one-in-N phrasing of a percentile, for the line under a board entry: a 1.2% chance of being
 * this dry reads better as "only 1 in 83 are still waiting here".
 */
export function formatOdds(percentile: number): string | null {
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile >= 1) return null;
  const n = Math.round(1 / percentile);
  return n >= 2 ? `1 in ${n.toLocaleString()}` : null;
}
