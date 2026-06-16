import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, completions, submissions } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';

// GET /api/plugin/board — the board for an event: every tile with its grid slot, a representative
// OSRS item icon, and which tiles each team has completed. Backs the Anvil clog tab's classic
// grid and tile-race track.
//
// Two modes:
//   • no params  → player-token authed; the caller's own *active* event, interactive (per-cell
//                  `complete` = your team, per-item progress = your team). readOnly=false.
//   • ?eventId=N → anonymous (mirrors /api/plugin/event/[id]); a read-only preview of any event
//                  (upcoming, or a live event you're not in). `complete` = any team has it, so a
//                  live preview shows board progress; the all-team list still drives the race pips.
//                  readOnly=true.

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

// All OSRS item ids on a tile (compound tiles like a "full moon set" track several distinct items),
// in a stable order: per-item requirement ids first, then any extra raw tracked ids. Empty for
// manual/stat tiles.
function allItemIds(trackedItemIds: string | null, itemRequirements: string | null): number[] {
  const ids: number[] = [];
  const push = (n: unknown) => {
    if (typeof n === 'number' && !ids.includes(n)) ids.push(n);
  };
  try {
    if (itemRequirements) {
      const reqs = JSON.parse(itemRequirements) as { itemId?: number }[];
      if (Array.isArray(reqs)) reqs.forEach((r) => push(r?.itemId));
    }
  } catch { /* ignore malformed JSON */ }
  try {
    if (trackedItemIds) {
      const raw = JSON.parse(trackedItemIds) as number[];
      if (Array.isArray(raw)) raw.forEach(push);
    }
  } catch { /* ignore malformed JSON */ }
  return ids;
}

// Human-readable "what does this tile actually require" for stat tiles (skill XP / boss KC), where
// the label alone (e.g. a custom name) doesn't convey the task. Null for drop/manual tiles, whose
// item icon + required-amount already describe them.
function tileRequirement(trackedStat: string | null, statType: string | null, statGoal: number | null): string | null {
  if (!trackedStat) return null;
  const stat = trackedStat.charAt(0).toUpperCase() + trackedStat.slice(1);
  const goal = statGoal && statGoal > 0 ? statGoal.toLocaleString() : '';
  const isBoss = statType === 'boss' || statType === 'kc';
  if (isBoss) return goal ? `Reach ${goal} ${stat} KC` : `${stat} KC`;
  return goal ? `Gain ${goal} ${stat} XP` : `${stat} XP`;
}

type EventRow = typeof events.$inferSelect;

// Shared board builder. `callerTeamId` null = read-only preview (no per-team view); a number =
// interactive for that team (per-cell + per-item progress).
async function buildBoard(event: EventRow, callerTeamId: number | null) {
  const [eventTiles, eventTeams] = await Promise.all([
    db.query.tiles.findMany({ where: eq(tiles.eventId, event.id) }),
    db.query.teams.findMany({ where: eq(teams.eventId, event.id) }),
  ]);

  // All completions across the event's tiles, grouped per team (drives the race pips + read-only).
  const tileIds = eventTiles.map((t) => t.id);
  const completionsByTeam = new Map<number, number[]>();
  const anyCompleted = new Set<number>();
  if (tileIds.length > 0) {
    const rows = await db
      .select({ teamId: completions.teamId, tileId: completions.tileId })
      .from(completions)
      .where(inArray(completions.tileId, tileIds));
    for (const r of rows) {
      if (!completionsByTeam.has(r.teamId)) completionsByTeam.set(r.teamId, []);
      completionsByTeam.get(r.teamId)!.push(r.tileId);
      anyCompleted.add(r.tileId);
    }
  }

  // Interactive only: your team's completed set + per-item submission totals (for compound tiles).
  const yourCompleted = callerTeamId != null ? new Set(completionsByTeam.get(callerTeamId) ?? []) : null;
  const perItemMap = new Map<number, Map<number, number>>();
  if (callerTeamId != null && tileIds.length > 0) {
    const perItem = await db
      .select({
        tileId: submissions.tileId,
        itemId: submissions.itemId,
        total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
      })
      .from(submissions)
      .where(and(eq(submissions.teamId, callerTeamId), inArray(submissions.tileId, tileIds)))
      .groupBy(submissions.tileId, submissions.itemId);
    for (const r of perItem) {
      if (r.itemId == null) continue;
      if (!perItemMap.has(r.tileId)) perItemMap.set(r.tileId, new Map());
      perItemMap.get(r.tileId)!.set(r.itemId, Number(r.total));
    }
  }

  // Sort by board position so `index` (0..N-1) is the tile-race order and the grid's row/col math
  // lines up with the web BingoBoard.
  const sortedTiles = [...eventTiles].sort((a, b) => a.position - b.position);
  const cols = event.boardSize > 0 ? event.boardSize : 1;

  return {
    eventId: event.id,
    name: event.name,
    format: event.format,
    scoringMode: event.scoringMode,
    boardSize: event.boardSize,
    yourTeamId: callerTeamId ?? -1,
    readOnly: callerTeamId == null,
    tiles: sortedTiles.map((t, index) => {
      // Compound tiles carry several distinct items; surface the per-item breakdown so the plugin's
      // detail page can render the whole set like the website (progress is 0 in read-only preview).
      let itemRequirements:
        | { itemId: number; name: string; requiredAmount: number; currentAmount: number }[]
        | undefined;
      if (t.itemRequirements) {
        try {
          const reqs = JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[];
          const totals = perItemMap.get(t.id);
          if (Array.isArray(reqs) && reqs.length > 0) {
            itemRequirements = reqs.map((r) => ({
              itemId: r.itemId,
              name: r.name,
              requiredAmount: r.requiredAmount,
              currentAmount: totals?.get(r.itemId) ?? 0,
            }));
          }
        } catch { /* ignore malformed JSON */ }
      }
      return {
        tileId: t.id,
        position: t.position,
        index,
        row: Math.floor(t.position / cols),
        col: t.position % cols,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        itemId: representativeItemId(t.trackedItemIds, t.itemRequirements),
        itemIds: allItemIds(t.trackedItemIds, t.itemRequirements),
        requiredAmount: t.requiredAmount ?? 1,
        requirement: tileRequirement(t.trackedStat, t.statType, t.statGoal),
        optional: t.optional ? 1 : 0,
        complete: yourCompleted ? yourCompleted.has(t.id) : anyCompleted.has(t.id),
        ...(itemRequirements ? { itemRequirements } : {}),
      };
    }),
    teams: eventTeams.map((tm) => ({
      teamId: tm.id,
      name: tm.name,
      color: tm.color,
      completedTileIds: completionsByTeam.get(tm.id) ?? [],
    })),
  };
}

export async function GET(request: Request) {
  const eventIdParam = new URL(request.url).searchParams.get('eventId');

  // Read-only preview path — anonymous, like /api/plugin/event/[id]. Lets a member view any
  // upcoming event's layout, or a live event they aren't competing in, without a team scope.
  if (eventIdParam) {
    const eventId = Number(eventIdParam);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(await buildBoard(event, null));
  }

  // Interactive path — the caller's own active event, scoped to their team.
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <playerToken>' }, { status: 401 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, auth.eventId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  return NextResponse.json(await buildBoard(event, auth.teamId));
}
