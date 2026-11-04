// Ready-made tiles for the quick event screen (admin/events/first), so a new host's event is
// playable the moment it exists instead of a grid of blank placeholders.
//
// Source, in order: the most-used Anvil-curated library board of the same shape, then a spread of
// Anvil's task library (cheap tasks through hard ones). Either way the rows go through the normal
// tile importer, so the host can change any tile afterwards.

import type { TileCsvRow } from '@/lib/csvTiles';

export interface StarterTask {
  label: string;
  points: number;
  category?: string | null;
  config: TileCsvRow;
}

export interface StarterBoardShape {
  origin: 'anvil' | 'community';
  status: string;
  mode: string;
  boardSize: number;
  tiles: TileCsvRow[];
}

/** How many tiles the quick screen's shapes need: an N×N grid for bingo, N in a row for a race. */
export function starterCount(format: string, size: number): number {
  return format === 'tilerace' ? size : size * size;
}

/** The library mode a quick-screen format maps to (lib/eventModes keys). */
export function starterMode(format: string): 'classic' | 'race' {
  return format === 'tilerace' ? 'race' : 'classic';
}

/** An Anvil-curated, published board of exactly this shape — the first in the list (most used). */
export function pickStarterBoard<B extends StarterBoardShape>(boards: B[], format: string, size: number): B | null {
  const mode = starterMode(format);
  const need = starterCount(format, size);
  return (
    boards.find(
      (b) =>
        b.origin === 'anvil' &&
        b.status === 'published' &&
        b.mode === mode &&
        b.tiles.length === need &&
        (mode === 'race' || b.boardSize === size) &&
        b.tiles.every((t) => typeof t.label === 'string' && t.label.trim() !== ''),
    ) ?? null
  );
}

/**
 * `count` tasks spread evenly over the pool by points, so a board gets easy, medium and hard tiles
 * rather than 25 of whatever sorts first. Labels are unique. A race keeps them easiest-first (tasks
 * are played in order); a grid is shuffled so the hard ones aren't all in the bottom rows.
 * Returns [] when the pool is too small to fill the board.
 */
export function spreadStarterRows(
  pool: StarterTask[],
  count: number,
  opts: { ordered: boolean; random?: () => number },
): TileCsvRow[] {
  const rand = opts.random ?? Math.random;
  const seen = new Set<string>();
  const uniq = pool
    .filter((t) => {
      const k = t.label.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.points - b.points || a.label.localeCompare(b.label));
  if (count <= 0 || uniq.length < count) return [];

  // One pick per equal slice of the sorted pool, at a random spot inside the slice.
  const picked: StarterTask[] = [];
  const step = uniq.length / count;
  for (let i = 0; i < count; i++) {
    const lo = Math.floor(i * step);
    const hi = Math.max(lo + 1, Math.floor((i + 1) * step));
    picked.push(uniq[lo + Math.floor(rand() * (hi - lo))]);
  }
  if (!opts.ordered) {
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
  }
  return picked.map((t) => ({ ...t.config, label: t.label, points: t.points, category: t.category ?? undefined }));
}
