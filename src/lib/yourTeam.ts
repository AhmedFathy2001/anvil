/**
 * The "Your team" bar at the top of a board: where the viewer's own team stands and the tiles worth
 * going for next. Pure, so the wording and the picks are tested without a page.
 */

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

export interface TeamStanding {
  /** 1 + the teams strictly ahead, so level teams share a place. */
  rank: number;
  of: number;
  /** Null before anyone has scored: a gap between zeros is noise. */
  gap: string | null;
}

export function teamStanding(
  teams: { id: number; name: string }[],
  scoreOf: (teamId: number) => number,
  teamId: number,
  pointsMode: boolean,
): TeamStanding | null {
  if (!teams.some((t) => t.id === teamId)) return null;
  const mine = scoreOf(teamId);
  const others = teams.filter((t) => t.id !== teamId);
  const ahead = others.filter((t) => scoreOf(t.id) > mine);
  const top = Math.max(mine, ...others.map((t) => scoreOf(t.id)));
  let gap: string | null = null;
  if (top > 0) {
    if (ahead.length === 0) {
      const level = others.find((t) => scoreOf(t.id) === mine);
      gap = level ? `Level with ${level.name}` : 'In the lead';
    } else {
      // The team directly above: the smallest score that still beats ours.
      const above = ahead.reduce((a, b) => (scoreOf(b.id) < scoreOf(a.id) ? b : a));
      gap = `${scoreOf(above.id) - mine}${pointsMode ? ' pts' : ''} behind ${above.name}`;
    }
  }
  return { rank: ahead.length + 1, of: teams.length, gap };
}

export interface TileProgress {
  id: number;
  current: number;
  goal: number;
}

/** Started but not finished, nearest to done first. */
export function closestToDone<T extends TileProgress>(tiles: T[], limit = 3): T[] {
  return tiles
    .filter((t) => t.goal > 0 && t.current > 0 && t.current < t.goal)
    .sort((a, b) => b.current / b.goal - a.current / a.goal)
    .slice(0, limit);
}

/** What a tile would do for a line: finish it, or leave one more to go. Finishing wins. */
export function lineNotes(nearly: { line: { name: string }; missing: number[] }[]): Map<number, string> {
  const notes = new Map<number, string>();
  for (const n of nearly.filter((x) => x.missing.length === 1)) {
    if (!notes.has(n.missing[0])) notes.set(n.missing[0], `Finishes ${n.line.name.toLowerCase()}`);
  }
  for (const n of nearly.filter((x) => x.missing.length === 2)) {
    for (const pos of n.missing) {
      if (!notes.has(pos)) notes.set(pos, `${n.line.name} needs this and one more`);
    }
  }
  return notes;
}
