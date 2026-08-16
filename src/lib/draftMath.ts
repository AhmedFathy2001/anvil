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
