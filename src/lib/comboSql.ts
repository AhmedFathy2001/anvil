import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { completions, submissions, tiles } from '@/db/schema';

// SQL halves of two rules that every reader of tiles / submissions must honour:
//
//   1. COMBO PARTS ARE NOT BOARD CELLS (lib/combo). A part is a real tile row (parent_tile_id set) that
//      only exists as a piece of its combo; the combo is what's laid out, counted and scored. Every
//      board reader filters them at the query.
//   2. CAP ROWS ARE NOT CREDITS (lib/tileCaps). A submission whose `goal` is set ('cap:N') is a cap
//      counter's (energy behind searches); it never counts toward, or proves, the tile's own goal.

/** Board cells only — no combo parts. */
export const boardTileWhere = (): SQL => isNull(tiles.parentTileId);

/** An event's board cells (no combo parts). */
export const eventBoardTiles = (eventId: number): SQL => and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId))!;

/** A completion of a board cell — not a combo part's (its progress, which never scores or announces). */
export const boardCompletion = (): SQL =>
  sql`NOT EXISTS (SELECT 1 FROM tiles AS part WHERE part.id = ${completions.tileId} AND part.parent_tile_id IS NOT NULL)`;

/** Rows that count toward the tile's own requirement — every SUM/MAX/MIN of a tile's progress, and
 * every "who did the work" read: a cap counter is never a turn-in. */
export const primaryCredit = (): SQL => isNull(submissions.goal);

/**
 * Copy each combo's reveal state (revealAt / revealedAt / closedAt) onto its parts, for one event. Parts
 * are never drawn, revealed or claimed themselves — they follow their combo — but plenty of readers
 * (the plugin config, the board, the gates) look at a tile's own reveal columns, so a part must carry
 * its combo's. One statement; call it after anything that writes those columns.
 */
export async function syncPartRevealState(eventId: number): Promise<void> {
  await db.execute(sql`
    UPDATE tiles AS part
       SET reveal_at = parent.reveal_at, revealed_at = parent.revealed_at, closed_at = parent.closed_at
      FROM tiles AS parent
     WHERE part.parent_tile_id = parent.id
       AND parent.event_id = ${eventId}
       AND (part.reveal_at IS DISTINCT FROM parent.reveal_at
         OR part.revealed_at IS DISTINCT FROM parent.revealed_at
         OR part.closed_at IS DISTINCT FROM parent.closed_at)
  `);
}
