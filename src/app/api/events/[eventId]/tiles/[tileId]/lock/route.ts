import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles, tileLocks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';

// Advisory per-tile edit lock. Opening the tile editor POSTs here (and re-POSTs as a
// heartbeat while it stays open); closing DELETEs. Held-by-someone-else is NOT an error —
// the response says who, and the editor shows a warning. The lock never blocks a save:
// the hard guard against clobbering is the updatedAt check on the tiles PUT. TTL keeps a
// crashed tab from wedging a tile; any later acquire simply steps over an expired row.

const LOCK_TTL_MS = 90_000;

export async function POST(
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
  const tId = parseInt(tileId, 10);

  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS).toISOString();

  const existing = await db.query.tileLocks.findFirst({ where: eq(tileLocks.tileId, tId) });
  if (existing && existing.userId !== editor.userId && existing.expiresAt > nowIso) {
    // Someone else holds a live lock — report it, don't grant.
    return NextResponse.json({
      locked: true,
      mine: false,
      holder: existing.username,
      expiresAt: existing.expiresAt,
    });
  }

  // Free, expired, or already ours → (re)acquire with a fresh TTL.
  if (existing) {
    await db
      .update(tileLocks)
      .set({ userId: editor.userId, username: editor.username, acquiredAt: existing.userId === editor.userId ? existing.acquiredAt : nowIso, expiresAt })
      .where(eq(tileLocks.tileId, tId));
  } else {
    // A concurrent first-acquire can race the insert; the loser's unique-PK failure just
    // means someone got there first — treat it like the held case on the next heartbeat.
    try {
      await db.insert(tileLocks).values({ tileId: tId, userId: editor.userId, username: editor.username, acquiredAt: nowIso, expiresAt });
    } catch {
      const winner = await db.query.tileLocks.findFirst({ where: eq(tileLocks.tileId, tId) });
      if (winner && winner.userId !== editor.userId) {
        return NextResponse.json({ locked: true, mine: false, holder: winner.username, expiresAt: winner.expiresAt });
      }
    }
  }

  return NextResponse.json({ locked: true, mine: true, expiresAt });
}

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
  const tId = parseInt(tileId, 10);
  // Only release our own lock — a stale DELETE from a closed tab must not evict the
  // colleague who took over after our TTL lapsed.
  await db.delete(tileLocks).where(and(eq(tileLocks.tileId, tId), eq(tileLocks.userId, editor.userId)));
  return NextResponse.json({ ok: true });
}
