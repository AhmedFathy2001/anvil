import { tilesFrozenByStart } from '@/lib/practiceRules';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { syncPartRevealState } from '@/lib/comboSql';
import { isMissionTile } from '@/lib/eventRules';
import { assertEventEditable } from '@/lib/eventLock';
import { eventForRequest } from '@/lib/eventScope';
import { MAX_EASE_OPTIONS } from '@/lib/raceEase';
import { easeChanged } from '@/lib/raceEaseDb';
import { STAFF_HIDE_ERROR, raceTileHiddenForSession } from '@/lib/raceHideAheadDb';
import { logTileAudit, snapshotTile } from '@/lib/tile-audit';

// POST — add an EASIER OPTION under a race board tile (lib/raceEase): a blank child tile, one level
// easier than the last. The editor then opens it and saves it like any tile (PUT ../../tiles), and
// removes it with DELETE ../[tileId]. Allowed on a running race, admin-only there: it stays hidden
// from every team until the clock or a lifeline turns it on.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; tileId: string }> }) {
  const { eventId, tileId } = await params;
  const eId = parseInt(eventId, 10);
  const tId = parseInt(tileId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const editor = await verifyTileEditorForEvent(eId, 'create');
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.format !== 'tilerace') return NextResponse.json({ error: 'Easier options are a Tile race feature.' }, { status: 400 });
  const tile = await db.query.tiles.findFirst({ where: and(eq(tiles.id, tId), eq(tiles.eventId, eId)) });
  if (!tile) return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  if (await raceTileHiddenForSession(event, tile)) return NextResponse.json({ error: STAFF_HIDE_ERROR }, { status: 403 });
  if (tile.parentTileId != null || isMissionTile(tile)) {
    return NextResponse.json({ error: 'Only a tile on the race board can have an easier option.' }, { status: 400 });
  }
  const started = tilesFrozenByStart(event);
  if (started && !atLeast(editor.role, 'admin')) {
    return NextResponse.json({ error: 'Adding an easier option to a live race is admin-only.' }, { status: 403 });
  }

  const siblings = (await db.select({ easeLevel: tiles.easeLevel }).from(tiles).where(eq(tiles.parentTileId, tile.id))).filter((s) => s.easeLevel != null);
  if (siblings.length >= MAX_EASE_OPTIONS) {
    return NextResponse.json({ error: `A tile takes at most ${MAX_EASE_OPTIONS} easier options.` }, { status: 400 });
  }
  const level = siblings.reduce((m, s) => Math.max(m, s.easeLevel as number), 0) + 1;
  const [created] = await db
    .insert(tiles)
    .values({
      eventId: eId,
      position: tile.position,
      parentTileId: tile.id,
      easeLevel: level,
      label: `${tile.label} (easier)`.slice(0, 200),
      points: 0,
      category: tile.category,
    })
    .returning();
  // It carries its tile's reveal state, like any child row (lib/comboSql).
  await syncPartRevealState(eId);
  await easeChanged(eId);
  logTileAudit({ eventId: eId, action: 'created', tileId: created.id, tileLabel: created.label, newValue: snapshotTile(created), actorUserId: editor.userId });
  const fresh = await db.query.tiles.findFirst({ where: eq(tiles.id, created.id) });
  return NextResponse.json(fresh ?? created, { status: 201 });
}
