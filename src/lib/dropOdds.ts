// Expected kills and time for drops: the one piece of maths that tile balance, clog hours and the
// luck read-out all share. Pure on purpose (no DB, no JSON imports) so every caller gets the same
// answer and the tests pin it down.
//
// The model, in the game's own terms:
//
//   - A drop is "1 in N" per ROLL. p = 1/N.
//   - Some sources roll a table more than once per kill (r rolls). The chance of seeing the item on
//     one kill is q = 1 - (1 - p)^r, not r·p (which passes 1 for big r and overstates small ones).
//   - Expected kills to the first drop is 1/q (geometric distribution).
//   - "Any of these items" depends on how the items are rolled:
//       * items on the SAME roll are mutually exclusive outcomes of that roll, so their chances add
//         (p_any = Σ p_i) before applying the roll count;
//       * items on DIFFERENT tables (or different sources rolled independently) combine as
//         1 - Π (1 - q_i).
//     Callers say which by giving each item a `table` key; items sharing a key are one roll.
//   - "All of these items" (a full set) is the expected maximum of independent geometric waits,
//     worked out by inclusion–exclusion. That's exact for independent tables and a close, slightly
//     optimistic read for items that share a roll.
//
// Time is kills ÷ kills-per-hour. Nothing here knows where the rates come from.

export interface DropChance {
  /** 1-in-N per roll. */
  denominator: number;
  /** Rolls of that table per kill (default 1). */
  rolls?: number;
  /**
   * Items with the same `table` value are outcomes of one shared roll (mutually exclusive). Leave it
   * unset to treat the item as rolled independently of every other.
   */
  table?: string;
}

function finitePositive(n: number | undefined, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Chance per kill of at least one hit, given a per-roll chance and a roll count. */
export function perKillChance(perRoll: number, rolls = 1): number {
  if (!Number.isFinite(perRoll) || perRoll <= 0) return 0;
  if (perRoll >= 1) return 1;
  const r = finitePositive(rolls, 1);
  if (r === 1) return perRoll;
  return 1 - Math.pow(1 - perRoll, r);
}

/** Per-kill chance for one item. */
export function itemChance(drop: DropChance): number {
  const d = finitePositive(drop.denominator, 0);
  if (d === 0) return 0;
  return perKillChance(1 / d, drop.rolls);
}

/** Expected kills to the first success at per-kill chance q. Infinity when q is 0. */
export function expectedKills(q: number): number {
  if (!Number.isFinite(q) || q <= 0) return Infinity;
  if (q >= 1) return 1;
  return 1 / q;
}

/** Expected kills for one item: 1/p for a single roll, 1/(1-(1-p)^r) for r rolls. */
export function expectedKillsForItem(drop: DropChance): number {
  return expectedKills(itemChance(drop));
}

/**
 * Per-kill chance of getting at least one of `drops`. Items sharing a `table` add within that roll;
 * separate tables combine independently.
 */
export function anyOfChance(drops: DropChance[]): number {
  const tables = new Map<string, { perRoll: number; rolls: number }>();
  let miss = 1;
  for (const drop of drops) {
    const d = finitePositive(drop.denominator, 0);
    if (d === 0) continue;
    const rolls = finitePositive(drop.rolls, 1);
    if (drop.table === undefined) {
      miss *= 1 - perKillChance(1 / d, rolls);
      continue;
    }
    const key = `${drop.table}\u0000${rolls}`;
    const t = tables.get(key) ?? { perRoll: 0, rolls };
    t.perRoll = Math.min(1, t.perRoll + 1 / d);
    tables.set(key, t);
  }
  for (const t of tables.values()) miss *= 1 - perKillChance(t.perRoll, t.rolls);
  return 1 - miss;
}

/** Expected kills until ANY of `drops` appears. */
export function expectedKillsForAny(drops: DropChance[]): number {
  return expectedKills(anyOfChance(drops));
}

/** Above this many items the inclusion–exclusion sum is too big; fall back to a bound. */
export const ALL_OF_EXACT_LIMIT = 16;

/**
 * Expected kills until EVERY one of `drops` has appeared at least once (a full set), treating the
 * items as independent. Exact by inclusion–exclusion up to ALL_OF_EXACT_LIMIT items; beyond that it
 * returns the harmonic approximation for the rarest item, which is within a few percent for sets
 * dominated by one rare piece and never under the true value by more than the set size suggests.
 */
export function expectedKillsForAll(drops: DropChance[]): number {
  const qs = drops.map(itemChance);
  if (qs.length === 0) return 0;
  if (qs.some((q) => q <= 0)) return Infinity;
  if (qs.length > ALL_OF_EXACT_LIMIT) {
    // Sum of 1/q over items sorted rare→common, each scaled by 1/rank: the coupon-collector shape.
    const sorted = [...qs].sort((a, b) => a - b);
    return sorted.reduce((acc, q, i) => acc + 1 / q / (i + 1), 0);
  }
  const n = qs.length;
  let total = 0;
  for (let mask = 1; mask < 1 << n; mask++) {
    let miss = 1;
    let bits = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        miss *= 1 - qs[i];
        bits++;
      }
    }
    const term = 1 / (1 - miss);
    total += bits % 2 === 1 ? term : -term;
  }
  return total;
}

/** Hours for a number of kills at a kill rate. Null when the rate is unknown. */
export function hoursFor(kills: number, killsPerHour: number | null | undefined): number | null {
  if (!Number.isFinite(kills) || kills < 0) return null;
  if (killsPerHour == null || !Number.isFinite(killsPerHour) || killsPerHour <= 0) return null;
  return kills / killsPerHour;
}

/**
 * Chance of having seen the item by `kills` at per-kill chance q: 1 - (1-q)^k. Read it as "this
 * share of players would have it by now".
 */
export function chanceBy(q: number, kills: number): number {
  if (!Number.isFinite(q) || q <= 0 || kills <= 0) return 0;
  if (q >= 1) return 1;
  return 1 - Math.pow(1 - q, kills);
}

/** Kills by which a share `quantile` (0..1) of players would have the item. */
export function killsForQuantile(q: number, quantile: number): number {
  if (!Number.isFinite(q) || q <= 0) return Infinity;
  if (q >= 1) return 1;
  const s = Math.min(Math.max(quantile, 0), 0.999999);
  return Math.log(1 - s) / Math.log(1 - q);
}

export type KillLuck = 'spooned' | 'on-rate' | 'dry' | 'very-dry';

export interface KillLuckRead {
  /** Expected kills to the first drop (1/q). */
  expected: number;
  /** Kills spent: the KC it dropped at, or the KC so far if it hasn't. */
  actual: number;
  obtained: boolean;
  /** actual ÷ expected. Below 1 is ahead of rate. */
  ratio: number;
  /** Share of players who'd have had it by `actual` kills. */
  percentile: number;
  verdict: KillLuck;
}

/**
 * Expected vs actual kills for one item. `actual` is the KC the item came at, or the current KC
 * while still waiting. Spooned = got it before 25% of players would have; dry = past the 75th
 * percentile; very dry = past the 95th. The middle half is "on rate".
 */
export function killLuck(q: number, actual: number, obtained: boolean): KillLuckRead | null {
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(actual) || actual < 0) return null;
  const expected = expectedKills(q);
  const percentile = chanceBy(q, actual);
  let verdict: KillLuck = 'on-rate';
  if (obtained && percentile < 0.25) verdict = 'spooned';
  else if (percentile >= 0.95) verdict = 'very-dry';
  else if (percentile >= 0.75) verdict = 'dry';
  // Not obtained yet and still inside the first quartile isn't "spooned" — it's just early.
  return { expected, actual, obtained, ratio: actual / expected, percentile, verdict };
}
