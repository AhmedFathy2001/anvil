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
