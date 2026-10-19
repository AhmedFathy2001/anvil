import { isPlaceholderTile } from './placeholderTile';

type PlanTile = { label: string; tileType?: string | null; trackedStat?: string | null };

export type TileImportPlan<T extends PlanTile> =
  | { ok: false; error: string }
  | {
      ok: true;
      /** The tiles rows 0..updates-1 are written into, in row order. */
      targets: T[];
      updates: number;
      /** Rows after the updates that become new tiles. */
      creates: number;
      ignored: number;
    };

/**
 * Where an import's rows land.
 *
 * Normally row i rewrites the tile at position i. APPEND — what every add-tiles tool sends (task
 * library, bosses, skills, collection log) — fills the board's blank "Tile N" placeholders first, in
 * order, and only then grows the board. A classic grid can't grow, so before this every one of those
 * tools was switched off on the format a first event is told to start with. Surplus rows create tiles
 * where the board can grow and are ignored where it can't.
 *
 * Pure (tiles sorted by position in, a plan out) so tests/tile-import-plan.test.ts runs it directly.
 */
export function planTileImport<T extends PlanTile>(input: {
  rowCount: number;
  tiles: T[];
  append: boolean;
  canGrow: boolean;
  started: boolean;
  maxTiles: number;
}): TileImportPlan<T> {
  const { rowCount, tiles, append, canGrow, started, maxTiles } = input;
  const blanks = append && !started ? tiles.filter(isPlaceholderTile) : [];
  if (append && !canGrow && blanks.length === 0) {
    return {
      ok: false,
      error: started
        ? 'Tiles can’t be added once the event has started.'
        : 'This board has no blank tiles left. Edit a tile, or make the grid bigger in Settings.',
    };
  }
  const targets = append ? blanks : tiles;
  const updates = Math.min(rowCount, targets.length);
  const creates = canGrow ? Math.max(0, Math.min(rowCount - updates, maxTiles - tiles.length)) : 0;
  return { ok: true, targets, updates, creates, ignored: rowCount - updates - creates };
}
