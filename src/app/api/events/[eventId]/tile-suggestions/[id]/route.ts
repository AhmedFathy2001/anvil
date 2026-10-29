import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, tileSuggestions, tiles } from '@/db/schema';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { eventForRequest } from '@/lib/eventScope';

const MAX_TILES = 500;

/**
 * The host deciding a co-host's tile suggestion, from its own address:
 *   { action: 'accept' }                — add it as a new tile (not on a fixed grid, not once started)
 *   { action: 'accept', tileId }        — write it over one of this board's tiles (a placeholder)
 *   { action: 'reject', note? }         — turn it down, with a word on why
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string; id: string }> }) {
  const p = await params;
  const eventId = Number(p.eventId);
  const id = Number(p.id);
  if (!Number.isInteger(eventId) || !Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await eventForRequest(request, eventId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [s] = await db
    .select()
    .from(tileSuggestions)
    .where(and(eq(tileSuggestions.id, id), eq(tileSuggestions.eventId, eventId)))
    .limit(1);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (s.status !== 'pending') return NextResponse.json({ error: 'That one is already decided.' }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; tileId?: unknown; note?: unknown };

  if (body.action === 'reject') {
    const editor = await verifyTileEditorForEvent(eventId);
    if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    await db
      .update(tileSuggestions)
      .set({ status: 'rejected', note, decidedByUserId: editor.userId, decidedAt: new Date() })
      .where(eq(tileSuggestions.id, id));
    return NextResponse.json({ ok: true });
  }

  if (body.action !== 'accept') return NextResponse.json({ error: 'Accept or reject.' }, { status: 400 });
  const overwrite = Number.isInteger(body.tileId) ? (body.tileId as number) : null;
  const editor = await verifyTileEditorForEvent(eventId, overwrite != null ? 'edit' : 'create');
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const locked = await assertEventEditable(eventId);
  if (locked) return locked;

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let tileId: number;
  if (overwrite != null) {
    const [t] = await db
      .update(tiles)
      .set({ label: s.title, description: s.details, ...(s.points ? { points: s.points } : {}) })
      .where(and(eq(tiles.id, overwrite), eq(tiles.eventId, eventId)))
      .returning({ id: tiles.id });
    if (!t) return NextResponse.json({ error: 'That tile is not on this board.' }, { status: 404 });
    tileId = t.id;
  } else {
    const isClassicGrid = (event.format ?? 'bingo') === 'bingo' && (event.scoringMode ?? 'tiles') === 'tiles';
    if (isClassicGrid) {
      return NextResponse.json({ error: 'A classic grid has a fixed size — pick a tile to write this over instead.' }, { status: 400 });
    }
    if (event.startDate && new Date(event.startDate) <= new Date()) {
      return NextResponse.json({ error: 'Tiles cannot be added after the event has started.' }, { status: 400 });
    }
    const existing = await db.select({ position: tiles.position }).from(tiles).where(eq(tiles.eventId, eventId));
    if (existing.length >= MAX_TILES) return NextResponse.json({ error: `Events are capped at ${MAX_TILES} tiles.` }, { status: 400 });
    const position = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.position)) + 1;
    tileId = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(tiles)
        .values({ eventId, position, label: s.title, description: s.details, mission: 0, ...(s.points ? { points: s.points } : {}) })
        .returning({ id: tiles.id });
      await tx.update(events).set({ boardSize: existing.length + 1 }).where(eq(events.id, eventId));
      return t.id;
    });
  }

  await db
    .update(tileSuggestions)
    .set({ status: 'accepted', tileId, decidedByUserId: editor.userId, decidedAt: new Date() })
    .where(eq(tileSuggestions.id, id));
  return NextResponse.json({ ok: true, tileId });
}
