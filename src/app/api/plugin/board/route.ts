import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';

// GET /api/plugin/board — the full board for the caller's active event: every tile with its
// grid slot, a representative OSRS item icon, and which tiles each team has completed. Backs the
// Anvil clog tab's classic-bingo grid and tile-race track (both need all-team completion state,
// which the per-team /api/plugin/config payload doesn't carry). Player-token scoped, so it always
// targets the event/team the token resolves to.

// First OSRS item id usable as an in-game icon: a per-item requirement wins, else the first raw
// tracked item id. Returns -1 ("no item icon") for manual/stat tiles — the plugin substitutes a
// sprite. Mirrors ClogTaskModel.representativeItemId / OsrsBingoPlugin.dropIconId on the Java side.
function representativeItemId(trackedItemIds: string | null, itemRequirements: string | null): number {
  try {
    if (itemRequirements) {
      const reqs = JSON.parse(itemRequirements) as { itemId?: number }[];
      if (Array.isArray(reqs) && reqs[0]?.itemId != null) return reqs[0].itemId;
    }
  } catch { /* ignore malformed JSON */ }
  try {
    if (trackedItemIds) {
      const ids = JSON.parse(trackedItemIds) as number[];
      if (Array.isArray(ids) && typeof ids[0] === 'number') return ids[0];
    }
  } catch { /* ignore malformed JSON */ }
  return -1;
}

export async function GET(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <playerToken>' }, { status: 401 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, auth.eventId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const [eventTiles, eventTeams] = await Promise.all([
    db.query.tiles.findMany({ where: eq(tiles.eventId, auth.eventId) }),
    db.query.teams.findMany({ where: eq(teams.eventId, auth.eventId) }),
  ]);

  // All completions across the event's tiles, in one query, grouped per team.
  const tileIds = eventTiles.map((t) => t.id);
  const completionsByTeam = new Map<number, number[]>();
  if (tileIds.length > 0) {
    const rows = await db
      .select({ teamId: completions.teamId, tileId: completions.tileId })
      .from(completions)
      .where(inArray(completions.tileId, tileIds));
    for (const r of rows) {
      if (!completionsByTeam.has(r.teamId)) completionsByTeam.set(r.teamId, []);
      completionsByTeam.get(r.teamId)!.push(r.tileId);
    }
  }

  // Your team's completed set, for the per-cell `complete` flag the grid colours by.
  const yourCompleted = new Set(completionsByTeam.get(auth.teamId) ?? []);

  // Sort by board position so `index` (0..N-1) is the tile-race order and the grid's
  // row/col math lines up with the web BingoBoard.
  const sortedTiles = [...eventTiles].sort((a, b) => a.position - b.position);
  const cols = event.boardSize > 0 ? event.boardSize : 1;

  return NextResponse.json({
    format: event.format,
    scoringMode: event.scoringMode,
    boardSize: event.boardSize,
    yourTeamId: auth.teamId,
    tiles: sortedTiles.map((t, index) => ({
      tileId: t.id,
      position: t.position,
      index,
      row: Math.floor(t.position / cols),
      col: t.position % cols,
      label: t.label,
      description: t.description ?? null,
      points: t.points ?? 0,
      itemId: representativeItemId(t.trackedItemIds, t.itemRequirements),
      requiredAmount: t.requiredAmount ?? 1,
      optional: t.optional ? 1 : 0,
      complete: yourCompleted.has(t.id),
    })),
    teams: eventTeams.map((tm) => ({
      teamId: tm.id,
      name: tm.name,
      color: tm.color,
      completedTileIds: completionsByTeam.get(tm.id) ?? [],
    })),
  });
}
