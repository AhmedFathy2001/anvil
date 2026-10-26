import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { tiles, users } from '@/db/schema';
import { verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventForPluginRequest } from '@/lib/eventScope';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { jsonWithEtag } from '@/lib/httpEtag';
import { tileProgressView } from '@/lib/tileTrackerView';

// GET /api/plugin/event/[id]/tile/[tileId]/progress — one tile's progress for every team, with each
// team's top contributors (lib/tileTracker). Backs the plugin's pinned in-game tracker widget, which
// polls it only while a tile is pinned, so it answers 304 when nothing moved.
//
// WHO MAY READ IT is who may read the event on the website (canSeeEvent, the plugin token standing in
// for the cookie). A tile on a board not yet revealed, or still hidden by a reveal policy, is a 404
// like an unknown one.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; tileId: string }> }) {
  const { id: rawId, tileId: rawTileId } = await params;
  const eventId = Number(rawId);
  const tileId = Number(rawTileId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(tileId) || tileId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const event = (await eventForPluginRequest(request, eventId))?.event;
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewer = await verifyPluginTokenUser(request);
  const viewerUserPlayerId = viewer
    ? ((await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } }))?.playerId ?? null)
    : null;
  if (!(await canSeeEvent({ eventId, playerId: viewerUserPlayerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Both gates the board applies: the whole board while the host is still authoring it
  // (tilesRevealed), then the per-tile reveal policy / unannounced missions.
  const tile = event.tilesRevealed
    ? await db.query.tiles.findFirst({ where: and(eq(tiles.id, tileId), eq(tiles.eventId, eventId)) })
    : undefined;
  if (!tile || !isTileRevealed(parseEventRules(event.rules), tile)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The caller's own seat in THIS event, when they play in it — marks "your team" and "you".
  const seat = await verifyPluginToken(request);
  const mine = seat && seat.eventId === eventId ? seat : null;

  // The widget counts down to the start itself and drops its pins once the event is over. Both are
  // stable values, so the ETag still only moves when a phase or a number does.
  return jsonWithEtag(request, await tileProgressView(event, tile, mine));
}
