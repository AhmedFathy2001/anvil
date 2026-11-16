// What a tile's dialog says once its event is over: how it went, not how to earn it. PURE: tests/tile-outcome.test.ts.

export interface OutcomeTeam {
  teamName: string;
  completedAt?: string | null;
}

/** "Red Dragons completed it on 12 Nov 2026", one line per team, earliest first; or that nobody did. */
export function outcomeLines(completedBy: readonly OutcomeTeam[], fmt: (iso: string) => string): string[] {
  if (completedBy.length === 0) return ['Nobody completed this tile.'];
  return [...completedBy]
    .sort((a, b) => (a.completedAt ?? '￿').localeCompare(b.completedAt ?? '￿'))
    .map((c) => (c.completedAt ? `${c.teamName} completed it on ${fmt(c.completedAt)}.` : `${c.teamName} completed it.`));
}
