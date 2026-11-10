import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { tiles } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { eventForRequest } from '@/lib/eventScope';
import { tileReadiness } from '@/lib/tileReadiness';
import { raceTileHiddenForSession } from '@/lib/raceHideAheadDb';

// "Before you start" — the viewer's own checks for one tile (lib/tileReadiness): "you haven't synced
// your collection log", "your plugin is too old for this tile", "you're not ranked for Zulrah".
//
// Only ever about the signed-in person's own characters on this board, so nobody learns anything
// about anyone else. Signed out, not on the board, or a tile members can't see yet: an empty list,
// the same as a tile with nothing to check.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string; tileId: string }> },
) {
  const { eventId, tileId } = await params;
  const eId = parseInt(eventId, 10);
  const tId = parseInt(tileId, 10);
  const event = await eventForRequest(request, eId);
  if (!event || !Number.isInteger(tId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await verifyUser();
  if (!user) return NextResponse.json({ results: [] });

  const tile = await db.query.tiles.findFirst({ where: and(eq(tiles.id, tId), eq(tiles.eventId, eId)) });
  if (!tile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // A part is read through its combo; a hidden tile has nothing to say yet.
  if (tile.parentTileId != null || !event.tilesRevealed || !isTileRevealed(parseEventRules(event.rules), tile)) {
    return NextResponse.json({ results: [] });
  }
  // A race tile this viewer only sees as a locked "?" (lib/raceHideAhead): nothing to say about it.
  if (await raceTileHiddenForSession(event, tile)) return NextResponse.json({ results: [] });

  const parts = tile.tileType === 'combo'
    ? await db.select().from(tiles).where(eq(tiles.parentTileId, tile.id)).orderBy(asc(tiles.id))
    : [];
  const results = await tileReadiness({ event, tile: { ...tile, parts }, personId: user.playerId });
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
}
