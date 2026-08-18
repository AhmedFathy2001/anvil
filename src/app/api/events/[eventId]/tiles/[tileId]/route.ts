import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { logTileAudit, snapshotTile } from '@/lib/tile-audit';
import { assertEventEditable } from '@/lib/eventLock';

// Fresh single-tile read for the editor: opening a tile re-fetches it (instead of trusting
// the page-load list) so a save starts from the latest state — and carries the updatedAt
// stamp the concurrency check on PUT compares against.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string; tileId: string }> },
) {
  const { eventId, tileId } = await params;
  const editor = await verifyTileEditorForEvent(parseInt(eventId, 10));
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, parseInt(tileId, 10)), eq(tiles.eventId, parseInt(eventId, 10))),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }
  return NextResponse.json(tile);
}

// Remove a tile from a Leagues (bingo+points) or Tile-race board and close the position gap
// so positions stay contiguous (0..n-1). Classic bingo grids are a fixed N×N shape and reject
// deletes. Pre-start only. Completions/submissions for the tile cascade-delete via their FK.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; tileId: string }> },
) {
  const { eventId, tileId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const tId = parseInt(tileId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isClassicGrid = (event.format ?? 'bingo') === 'bingo' && (event.scoringMode ?? 'tiles') === 'tiles';
  if (isClassicGrid) {
    return NextResponse.json(
      { error: 'A classic bingo grid is a fixed N×N board — tiles cannot be removed individually.' },
      { status: 400 },
    );
  }
  if (event.startDate && new Date(event.startDate) <= new Date()) {
    return NextResponse.json({ error: 'Tiles cannot be removed after the event has started.' }, { status: 400 });
  }

  const tile = await db.query.tiles.findFirst({ where: and(eq(tiles.id, tId), eq(tiles.eventId, eId)) });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }

  const allTiles = await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eId));
  if (allTiles.length <= 1) {
    return NextResponse.json({ error: 'An event must keep at least one tile.' }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(tiles).where(eq(tiles.id, tId));
    // Close the gap: every tile after the removed one shifts down a position.
    await tx
      .update(tiles)
      .set({ position: sql`${tiles.position} - 1` })
      .where(and(eq(tiles.eventId, eId), gt(tiles.position, tile.position)));
    // Keep boardSize == tile count for Leagues/race display helpers.
    await tx.update(events).set({ boardSize: allTiles.length - 1 }).where(eq(events.id, eId));
  });

  logTileAudit({
    eventId: eId,
    action: 'deleted',
    tileId: tId,
    tileLabel: tile.label,
    oldValue: snapshotTile(tile),
    actorUserId: editor.userId,
  });

  return NextResponse.json({ ok: true, boardSize: allTiles.length - 1 });
}
