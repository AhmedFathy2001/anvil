/**
 * An untouched placeholder tile — the "Tile 1".."Tile N" a new event's board is seeded with.
 *
 * Pure, so the client and the import route agree with lib/writtenTiles, which is the same test as
 * a WHERE condition.
 */
export function isPlaceholderTile(t: { label: string; tileType?: string | null; trackedStat?: string | null }): boolean {
  return /^Tile [0-9]+$/.test(t.label) && (t.tileType ?? 'standard') === 'standard' && t.trackedStat == null;
}
