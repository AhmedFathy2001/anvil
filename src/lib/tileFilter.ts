// Shared tile-filtering helpers used by the admin Tiles tab and the public board.
// Two orthogonal facets:
//   • category — the free-text grouping stored on each tile (e.g. "Raids", "Slayer", "Troll").
//   • tier     — a difficulty band derived purely from the tile's point value, so it works
//                for any event without a schema change or per-tile config.
// Keep both here so the buckets stay identical across every surface that filters tiles.

export type TileTierKey = 'troll' | 'easy' | 'medium' | 'hard' | 'ultra';

interface TierDef {
  key: TileTierKey;
  label: string;
  /** Inclusive lower bound on points. Bands are contiguous and ordered ascending. */
  min: number;
}

// Ordered low→high. A tile lands in the highest band whose `min` it meets.
export const TILE_TIERS: TierDef[] = [
  { key: 'troll', label: 'Troll', min: 0 },
  { key: 'easy', label: 'Easy', min: 11 },
  { key: 'medium', label: 'Medium', min: 100 },
  { key: 'hard', label: 'Hard', min: 350 },
  { key: 'ultra', label: 'Ultra', min: 700 },
];

const TIER_LABELS: Record<TileTierKey, string> = Object.fromEntries(
  TILE_TIERS.map((t) => [t.key, t.label]),
) as Record<TileTierKey, string>;

/** Derive a tile's difficulty tier from its point value (defaults to 1 when unset). */
export function tileTier(points: number | null | undefined): TileTierKey {
  const p = points ?? 1;
  let key: TileTierKey = TILE_TIERS[0].key;
  for (const t of TILE_TIERS) {
    if (p >= t.min) key = t.key;
  }
  return key;
}

export function tierLabel(key: TileTierKey): string {
  return TIER_LABELS[key];
}

/** Sorted, de-duplicated list of the categories actually present on a set of tiles. */
export function tileCategories(tiles: { category?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const t of tiles) {
    const c = t.category?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
