/**
 * Snake/serpentine draft ordering utilities.
 *
 * With 4 teams [A, B, C, D]:
 *   Picks 0-3: A, B, C, D  (round 0 — forward)
 *   Picks 4-7: D, C, B, A  (round 1 — reversed)
 *   Picks 8-11: A, B, C, D (round 2 — forward)
 *   ...
 */

/** Return the team ID whose turn it is for a given 0-based pick number. */
export function getTeamForPick(teamOrder: number[], pickNumber: number): number {
  const numTeams = teamOrder.length;
  if (numTeams === 0) throw new Error('teamOrder is empty');
  const round = Math.floor(pickNumber / numTeams);
  const indexInRound = pickNumber % numTeams;
  const index = round % 2 === 1 ? numTeams - 1 - indexInRound : indexInRound;
  return teamOrder[index];
}

/** The order teams pick in during a 0-based round: reversed on odd rounds (snake). */
export function orderForRound(teamOrder: number[], round: number): number[] {
  return round % 2 === 1 ? [...teamOrder].reverse() : [...teamOrder];
}

/** Compute the current round (0-based) for a given pick number. */
export function getRoundForPick(numTeams: number, pickNumber: number): number {
  return Math.floor(pickNumber / numTeams);
}

/** Compute pick-within-round (0-based) for display. */
export function getPickInRound(numTeams: number, pickNumber: number): number {
  return pickNumber % numTeams;
}

/**
 * Number of draft picks (turns) taken so far. A single pick can assign several player rows the SAME
 * pickNumber — a multi-account person is drafted as ONE pick that pulls all their accounts onto the
 * team — so we count DISTINCT pick numbers, not player rows. For single-account events (every picked
 * player has a unique pickNumber) this equals the count of players with a team, so it's a no-op there.
 */
export function countPicksTaken(players: { pickNumber: number | null }[]): number {
  const seen = new Set<number>();
  for (const p of players) {
    if (p.pickNumber != null) seen.add(p.pickNumber);
  }
  return seen.size;
}

/**
 * How many picks come before `teamId`'s next one, in snake order: 0 means the team is on the clock
 * now, 3 means three other picks go first. Null when the team is not in the order or the pool would
 * run out before its turn (`poolRemaining` picks are all that is left to make).
 *
 * Snake only. A dynamic-order draft picks whoever is weakest, which cannot be counted ahead — the
 * caller does not ask there.
 */
export function picksUntilTeam(
  teamOrder: number[],
  currentPickNumber: number,
  teamId: number,
  poolRemaining: number,
): number | null {
  const n = teamOrder.length;
  if (n === 0 || !teamOrder.includes(teamId)) return null;
  // The team picks once per round, so its next turn is within the next 2n picks.
  for (let ahead = 0; ahead < 2 * n; ahead++) {
    if (ahead >= poolRemaining) return null;
    if (getTeamForPick(teamOrder, currentPickNumber + ahead) === teamId) return ahead;
  }
  return null;
}
