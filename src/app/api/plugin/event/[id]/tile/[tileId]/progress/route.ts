import { NextResponse } from 'next/server';
import { standingsScopeForPlugin } from '@/lib/standingsAccess';
import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events, tiles, users } from '@/db/schema';
import { verifyPluginTokenOnEvent, verifyPluginTokenUser } from '@/lib/auth';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventForPluginRequest } from '@/lib/eventScope';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { jsonWithEtag } from '@/lib/httpEtag';
import { tileProgressView } from '@/lib/tileTrackerView';
import { tileGone } from '@/lib/tileTracker';

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
  // The caller's own seat in THIS event, when they play in it — marks "your team" and "you". A board
  // the character is seated on is theirs to read through any clan address: a tile pinned from a second
  // board (another clan's) polls here like the first one's.
  const seat = await verifyPluginTokenOnEvent(request, eventId);
  const mine = seat && seat.eventId === eventId ? seat : null;
  const event =
    (await eventForPluginRequest(request, eventId))?.event ??
    (mine ? await seatedEvent(eventId) : undefined);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewer = await verifyPluginTokenUser(request);
  const viewerUserPlayerId = viewer
    ? ((await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } }))?.playerId ?? null)
    : null;
  if (!mine && !(await canSeeEvent({ eventId, playerId: viewerUserPlayerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Both gates the board applies: the whole board while the host is still authoring it
  // (tilesRevealed), then the per-tile reveal policy / unannounced missions.
  const tile = event.tilesRevealed
    ? await db.query.tiles.findFirst({ where: and(eq(tiles.id, tileId), eq(tiles.eventId, eventId)) })
    : undefined;
  // A tile that no longer exists (a board re-seeded under the pin) is 410 "gone": final, so the plugin
  // unpins at once instead of retrying a pin that can never load.
  if (event.tilesRevealed && !tile) return tileGone();
  if (!tile || !isTileRevealed(parseEventRules(event.rules), tile)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The widget counts down to the start itself and drops its pins once the event is over. Both are
  // stable values, so the ETag still only moves when a phase or a number does.
  // Hidden standings: the caller's own team's line only, unless they're staff (lib/standingsAccess).
  const scope = await standingsScopeForPlugin(event, { userId: viewer?.userId ?? null, teamId: mine?.teamId ?? null });
  return jsonWithEtag(request, await tileProgressView(event, tile, mine, scope));
}

/** A board the caller is seated on, unless its host clan is suspended (lib/pluginBoards' rule). */
async function seatedEvent(eventId: number) {
  // clan-scope: global -- the caller is seated on this event (verifyPluginTokenOnEvent).
  const [row] = await db
    .select({ event: events })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(and(eq(events.id, eventId), ne(clans.status, 'suspended')))
    .limit(1);
  return row?.event;
}
