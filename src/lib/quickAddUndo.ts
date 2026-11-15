// Taking back a Quick add. The import route says how many tiles it made, not which, so the board
// works out which ones are new by comparing its tile ids before and after. Pure: tests/quick-add-undo.

/**
 * Board tiles (not combo parts) present now that were not there before, in board order. An undo
 * is only offered when this matches what the import said it created, so a tile somebody else
 * added at the same moment is never swept up in it.
 */
export function tilesAddedSince(before: Iterable<number>, after: { id: number; position: number; parentTileId?: number | null }[]): number[] {
  const had = new Set(before);
  return after
    .filter((t) => !had.has(t.id) && t.parentTileId == null)
    .sort((a, b) => a.position - b.position)
    .map((t) => t.id);
}

/** Offer the undo only when what appeared is exactly what the import says it created. */
export function undoableAdd(createdByImport: number, added: number[]): boolean {
  return createdByImport > 0 && added.length === createdByImport;
}
