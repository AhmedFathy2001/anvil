import { inArray } from 'drizzle-orm';

import { db } from '@/db';
import { tiles } from '@/db/schema';
import { emitBoardLines } from '@/lib/chatFeed';
import { log } from '@/lib/logger';
import { playerVisibleReveals, revealLines } from '@/lib/revealLines';

/**
 * The in-game side of a reveal (lib/revealEngine): the tiles a pass just flipped, re-read after the
 * flip, gated to what the board's players may see, worded (lib/revealLines) and sent down the chat
 * feed's push to every player on the board (lib/chatFeed emitBoardLines — their "Reveals & missions"
 * choice decides). The panel already redraws off the tile rows' own push. Fire-and-forget: a lost
 * line only means the reveal shows in the panel alone, as before.
 */
export async function pushReveals(
  event: { id: number; name: string; scoringMode: string | null; tilesRevealed: number | boolean | null; rules: string | null },
  tileIds: number[],
): Promise<number> {
  if (!tileIds.length) return 0;
  try {
    const rows = await db
      .select({
        id: tiles.id,
        label: tiles.label,
        points: tiles.points,
        mission: tiles.mission,
        rules: tiles.rules,
        revealedAt: tiles.revealedAt,
        closedAt: tiles.closedAt,
        parentTileId: tiles.parentTileId,
      })
      .from(tiles)
      .where(inArray(tiles.id, tileIds));
    const shown = playerVisibleReveals(event, rows);
    if (!shown.length) return 0;
    return await emitBoardLines(event.id, revealLines(event.name, shown, event.scoringMode === 'points', Date.now()));
  } catch (err) {
    log.warn('reveal-push.failed', { eventId: event.id, message: (err as Error).message });
    return 0;
  }
}
