/**
 * The arithmetic behind draft balance, kept free of the database so it can be tested directly.
 *
 * Everything here is pure: strengths, the spread between them, and the order rotation that answers
 * "resume from this team". The parts that need rows — profiles, rosters, the pick log — live in
 * lib/draftControl and lib/draftBalance and call into this.
 */

/**
 * Ratings are sharpened before they're summed into a team strength: contributions in a real event
 * follow a power law, so a linear sum flattered rosters of many mediocre players. One definition,
 * because the pre-draft panel and the running-draft panel must not put two different spreads on two
 * different screens.
 */
export const STRENGTH_EXPONENT = 1.5;

/** Team strength = Σ rating^1.5 over its roster. */
export function strengthOf(ratings: number[]): number {
  return ratings.reduce((sum, r) => sum + Math.pow(r, STRENGTH_EXPONENT), 0);
}

/** (max − min) / max over team strengths, as a 0–100 pct. 0 when nobody has anything yet. */
export function spreadPct(strengths: number[]): number {
  if (strengths.length < 2) return 0;
  const max = Math.max(...strengths);
  if (max <= 0) return 0;
  return Math.round(((max - Math.min(...strengths)) / max) * 100);
}

/**
 * Rotate the draft order so `teamId` is the team on the clock at `pickNumber`.
 *
 * Whose turn it is derives from (order, picks taken), so "resume from this team" has to change one
 * of the two. Rotating the order is the honest edit: every team still picks once per round and the
 * snake keeps its shape — the admin has re-seated the table, not skipped anyone. Editing the pick
 * count instead would silently un-take or double-take a turn.
 */
export function rotateOrderSoNextIs(order: number[], pickNumber: number, teamId: number): number[] {
  const n = order.length;
  if (n === 0) return order;
  const pos = order.indexOf(teamId);
  if (pos < 0) return order;
  // Where in the array the current pick reads from — mirrors the serpentine indexing in lib/draft.
  const round = Math.floor(pickNumber / n);
  const indexInRound = pickNumber % n;
  const idx = round % 2 === 1 ? n - 1 - indexInRound : indexInRound;
  const k = (pos - idx + n) % n;
  return order.map((_, i) => order[(i + k) % n]);
}

/**
 * Spread-cap verdict: may this team take a player of this rating?
 *
 * Pure so it can be tested against the cases that matter — all three of which were found by running
 * a draft or writing the test, not by reading the code:
 *   - a "never block the team that's behind on picks" rule makes the cap a NO-OP, because a snake
 *     draft keeps every team within one pick of each other.
 *   - a pure threshold switches ITSELF OFF for a team already over the cap, which is the team it
 *     most needs to bind.
 *   - comparing roster TOTALS punishes whoever picks first in a round, because one extra player
 *     always reads as imbalance. So the comparison is per-pick average, which is what the rosters
 *     converge to anyway: every team ends a snake draft the same size.
 *
 * While the cap is reachable, only picks that keep the team under it are allowed. Once it isn't,
 * only the least-damaging picks are. The allowed set is never empty, so a draft can't stall.
 */
export interface SpreadCapInput {
  /** Ratings already drafted, per team. Teams yet to pick are compared once they have someone. */
  rosters: Map<number, number[]>;
  pickingTeamId: number;
  candidateRating: number;
  /** Ratings of everyone still undrafted. */
  poolRatings: number[];
  capPct: number;
}

export type SpreadCapVerdict =
  | { allowed: true }
  | { allowed: false; kind: 'over-cap'; devPct: number }
  | { allowed: false; kind: 'must-take-lowest'; devPct: number };

/** Half a point of tolerance so two near-identical ratings don't arbitrarily exclude one. */
const TIE_TOLERANCE_PCT = 0.5;

export function spreadCapVerdict(input: SpreadCapInput): SpreadCapVerdict {
  const { rosters, pickingTeamId, candidateRating, poolRatings, capPct } = input;
  if (rosters.size < 2 || poolRatings.length === 0) return { allowed: true };

  /** Strength per pick, so a team that's one pick ahead in the round isn't flagged for it. */
  const perPick = (ratings: number[]): number =>
    ratings.length === 0 ? 0 : strengthOf(ratings) / ratings.length;

  const deviationAfter = (rating: number): number => {
    const after = new Map(rosters);
    after.set(pickingTeamId, [...(after.get(pickingTeamId) ?? []), rating]);
    // Only teams that have actually drafted someone are comparable — otherwise the very first pick
    // of a draft reads as infinitely unbalanced against a field of empty rosters.
    const drafted = [...after.values()].filter((r) => r.length > 0);
    if (drafted.length < 2) return 0;
    const averages = drafted.map(perPick);
    const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
    if (mean <= 0) return 0;
    return ((perPick(after.get(pickingTeamId) ?? []) - mean) / mean) * 100;
  };

  const mine = deviationAfter(candidateRating);
  if (mine <= capPct) return { allowed: true };

  // Is any remaining pick under the cap? Then this one simply isn't allowed.
  if (poolRatings.some((r) => deviationAfter(r) <= capPct)) {
    return { allowed: false, kind: 'over-cap', devPct: mine };
  }

  // Already over it whatever they do — allow only the least-damaging options.
  const best = Math.min(...poolRatings.map((r) => deviationAfter(r)));
  if (mine <= best + TIE_TOLERANCE_PCT) return { allowed: true };
  return { allowed: false, kind: 'must-take-lowest', devPct: best };
}
