// Lines on a square bingo board.
//
// A classic board is scored by tiles, but it is PLAYED for lines — and the board page never showed
// them. It couldn't even show who owned what, because every team can complete every tile, so the
// grid drew a soup of dots and left "are we one tile from a row" as something you worked out by
// squinting.
//
// Lines are per team, not per board: two teams can both hold row 3, and a tile another team already
// did is still there for you. That's why everything here takes ONE team's owned positions.
//
// Pure and dependency-free (like lib/eventRules and lib/eventAxes) so it's directly testable.

export interface BoardLine {
  /** Stable id, e.g. 'row-2' — used as a React key and to dedupe. */
  key: string;
  /** How a member would say it: "Row 3", "Column 1", "Diagonal ↘". */
  name: string;
  /** Board positions (0-indexed, row-major) that make up the line. */
  positions: number[];
}

export interface LineProgress {
  line: BoardLine;
  /** How many of the line's tiles this team has. */
  have: number;
  /** The positions they still need — empty when the line is complete. */
  missing: number[];
}

/**
 * Every line on an N×N board: rows, columns, and both diagonals. Boards smaller than 2×2 have none
 * (and a non-square board — leagues, a ladder — isn't played for lines at all).
 */
export function boardLines(size: number): BoardLine[] {
  if (!Number.isInteger(size) || size < 2) return [];
  const lines: BoardLine[] = [];
  for (let r = 0; r < size; r++) {
    lines.push({
      key: `row-${r}`,
      name: `Row ${r + 1}`,
      positions: Array.from({ length: size }, (_, c) => r * size + c),
    });
  }
  for (let c = 0; c < size; c++) {
    lines.push({
      key: `col-${c}`,
      name: `Column ${c + 1}`,
      positions: Array.from({ length: size }, (_, r) => r * size + c),
    });
  }
  lines.push({
    key: 'diag-down',
    name: 'Diagonal ↘',
    positions: Array.from({ length: size }, (_, i) => i * size + i),
  });
  lines.push({
    key: 'diag-up',
    name: 'Diagonal ↙',
    positions: Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)),
  });
  return lines;
}

/**
 * How one team stands on every line, best-first.
 *
 * `owned` is the set of board POSITIONS that team has completed. Lines whose tiles don't all exist
 * (a board authored with gaps) are skipped rather than reported as impossible.
 */
export function lineProgress(
  size: number,
  owned: Set<number>,
  existingPositions?: Set<number>,
): LineProgress[] {
  return boardLines(size)
    .filter((line) => !existingPositions || line.positions.every((p) => existingPositions.has(p)))
    .map((line) => {
      const missing = line.positions.filter((p) => !owned.has(p));
      return { line, have: line.positions.length - missing.length, missing };
    })
    .sort((a, b) => b.have - a.have || a.line.key.localeCompare(b.line.key));
}

/** The lines a team has outright. */
export function completedLines(progress: LineProgress[]): BoardLine[] {
  return progress.filter((p) => p.missing.length === 0).map((p) => p.line);
}

/**
 * The lines a team is within `within` tiles of finishing, closest first — the "line watch".
 * Completed lines are excluded: they're not something to chase.
 */
export function nearlyLines(progress: LineProgress[], within = 1): LineProgress[] {
  return progress.filter((p) => p.missing.length > 0 && p.missing.length <= within);
}

/** Every position that sits on one of these lines — what the board outlines. */
export function positionsOf(lines: BoardLine[]): Set<number> {
  const out = new Set<number>();
  for (const line of lines) for (const p of line.positions) out.add(p);
  return out;
}

/**
 * Blackout progress: how much of the board a team holds.
 * Counts against the tiles that actually exist, so a board with a hole isn't unwinnable.
 */
export function blackout(owned: Set<number>, totalTiles: number): { done: number; total: number; pct: number } {
  const done = owned.size;
  const total = Math.max(0, totalTiles);
  return { done, total, pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0 };
}
