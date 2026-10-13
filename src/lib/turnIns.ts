// How many "submissions" a person really made — the one count every surface should show.
//
// Auto-detected tile kinds write a row per game action: a kill tile lands one row per kill, so 500
// slayer kills were 500 "submissions" while a Colosseum clear was one. Counting rows just measures
// who ground chat-line tiles. So an auto-ping kind counts ONCE per tile a person fed, and discrete
// turn-ins (drops, timed clears, diaries, value hauls, manual proofs) count one each.
//
// Imports nothing on purpose, so client components and node's type-stripping tests can both use it.

/** Tile kinds whose rows are one-per-game-action pings rather than deliberate turn-ins. */
export const AUTO_PING_TILE_TYPES: ReadonlySet<string> = new Set(['kill', 'lap', 'pvp', 'gain', 'deathless', 'lms']);

export function isAutoPingTileType(tileType: string | null | undefined): boolean {
  return tileType != null && AUTO_PING_TILE_TYPES.has(tileType);
}

/** Turn-ins on ONE tile by ONE person, given how many rows they wrote there. */
export function turnInsOnTile(tileType: string | null | undefined, rows: number): number {
  if (rows <= 0) return 0;
  return isAutoPingTileType(tileType) ? 1 : rows;
}

/**
 * Turn-ins across a set of rows. `personOf` groups the auto-ping de-duplication — pass the credited
 * player (or a merged person key) for an event-wide total; rows with no person still count once per
 * tile for auto-ping kinds.
 */
export function countTurnIns<T extends { tileId: number }>(
  rows: readonly T[],
  tileTypeOf: (tileId: number) => string | null | undefined,
  personOf: (row: T) => string | number | null | undefined = () => null,
): number {
  const seen = new Set<string>();
  let total = 0;
  for (const row of rows) {
    if (isAutoPingTileType(tileTypeOf(row.tileId))) {
      const key = `${personOf(row) ?? ''}:${row.tileId}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    total += 1;
  }
  return total;
}
