import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTileEditor } from '@/lib/auth';
import { logTileAudit } from '@/lib/tile-audit';

// Rewrites the whole board order in one shot: `order` is a permutation of ALL the event's
// tile ids, and the tile at order[i] gets position i. Pre-start only — positions define the
// board (bingo lines, race order), so reordering a live event would change what teams have
// already been playing against.
//
// Body: { order: number[] }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.startDate && new Date(event.startDate) <= new Date()) {
    return NextResponse.json({ error: 'Tile order is locked once the event starts.' }, { status: 400 });
  }

  let body: { order?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const order = body.order;
  if (!Array.isArray(order) || order.length === 0 || !order.every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: 'order must be a non-empty array of tile ids' }, { status: 400 });
  }

  const eventTiles = await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eId));
  const ids = new Set(eventTiles.map((t) => t.id));
  const unique = new Set(order as number[]);
  if (order.length !== ids.size || unique.size !== order.length || !(order as number[]).every((id) => ids.has(id))) {
    return NextResponse.json(
      { error: 'order must contain every tile id of this event exactly once' },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      await tx.update(tiles).set({ position: i }).where(eq(tiles.id, (order as number[])[i]));
    }
  });

  logTileAudit({
    eventId: eId,
    action: 'reordered',
    newValue: { total: order.length },
    actorUserId: editor.userId,
  });

  return NextResponse.json({ ok: true, total: order.length });
}
