import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { events, tiles, teams, completions, submissions } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';
import { getTierBands } from '@/lib/pluginConfig';
import { jsonWithEtag } from '@/lib/httpEtag';
import { notableItemFor, bossItemForStatKey } from '@/lib/tileIcons';
import { lapUnitNoun } from '@/lib/constants';
import { parseEventRules, hasRevealPolicy, visibleTiles, nextRevealAt } from '@/lib/eventRules';

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

// Human-readable "what actually counts toward this tile", shown on the plugin's tile-detail page
// so members see the requirement the way the website spells it out — not just the icon. Kept
// concise (one line; the plugin wraps it). Returns null only when the tile carries nothing to say.
function fmtClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
// Parse a JSON string-array column (sourceNpcs / targetNpcs) into a clean string list.
function jsonNames(json: string | null): string[] {
  if (!json) return [];
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}
function tileRequirement(t: typeof tiles.$inferSelect): string | null {
  const amt = t.requiredAmount && t.requiredAmount > 0 ? t.requiredAmount.toLocaleString() : '';
  const names = (json: string | null): string[] => {
    if (!json) return [];
    try {
      const a = JSON.parse(json);
      return Array.isArray(a) ? a.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0) : [];
    } catch {
      return [];
    }
  };
  const join = (arr: string[]) => arr.join(', ');
  switch (t.tileType) {
    case 'kill': {
      const npcs = names(t.targetNpcs);
      const who = npcs.length ? join(npcs) : 'the target NPC';
      return amt ? `Kill ${amt}× ${who}` : `Kill ${who}`;
    }
    case 'lap': {
      const courses = names(t.targetNpcs);
      // Sepulchre targets count floors/runs, not laps, so both the verb and the noun change.
      const noun = lapUnitNoun(courses);
      if (noun !== 'lap') {
        const where = courses.length ? join(courses) : 'the Hallowed Sepulchre';
        return amt ? `Complete ${amt} ${noun}s — ${where}` : `Complete ${where}`;
      }
      const where = courses.length ? join(courses) : 'the agility course';
      return amt ? `Run ${amt} laps of ${where}` : `Run a lap of ${where}`;
    }
    case 'pvp': {
      const sel = names(t.targetNpcs);
      const rsns = sel.filter((s) => s.startsWith('rsn:')).map((s) => s.slice(4));
      const who = rsns.length ? join(rsns) : 'rival-team players';
      return amt ? `Defeat ${amt}× ${who} in PvP` : `Defeat ${who} in PvP`;
    }
    case 'gain':
      return amt ? `Gather ${amt}` : null;
    case 'timed': {
      if (!t.timedActivity) return null;
      const cap = t.timeThresholdSeconds ? ` under ${fmtClock(t.timeThresholdSeconds)}` : '';
      const party = t.partySize ? ` (${t.partySize}-player)` : '';
      return `Clear ${t.timedActivity}${cap}${party}`;
    }
    case 'deathless': {
      if (!t.timedActivity) return null;
      return amt ? `${amt}× deathless ${t.timedActivity}` : `Deathless ${t.timedActivity}`;
    }
    case 'diary': {
      const d = names(t.targetNpcs);
      const which = d.length ? join(d) : 'achievement diaries';
      return amt ? `Complete ${amt}× ${which}` : `Complete ${which}`;
    }
    case 'ca': {
      const c = names(t.targetNpcs);
      const which = c.length ? join(c) : 'combat tasks';
      return amt ? `Complete ${amt}× ${which}` : `Complete ${which}`;
    }
    case 'lms': {
      const cap = t.timeThresholdSeconds ?? 1;
      const place = cap === 1 ? 'Win' : `Place top-${cap} in`;
      return amt && amt !== '1' ? `${place} LMS ${amt}×` : `${place} LMS`;
    }
    case 'value':
    case 'valuetotal': {
      const gp = t.requiredAmount ? t.requiredAmount.toLocaleString() : '';
      const src = names(t.sourceNpcs);
      const from = src.length ? ` from ${join(src)}` : '';
      return t.tileType === 'valuetotal'
        ? `Collect ${gp} gp of loot${from}`
        : `A single haul worth ${gp} gp${from}`;
    }
    case 'drop':
    case 'collection': {
      const src = names(t.sourceNpcs);
      const from = src.length ? ` from ${join(src)}` : '';
      if (t.tileType === 'collection') return `Collect the full set${from}`;
      // A trivial single-drop tile is fully described by its icon + "need N"; skip the noise.
      if (!amt || amt === '1') return from ? `Obtain a drop${from}` : null;
      return `Obtain ${amt} drops${from}`;
    }
    default:
      break;
  }
  // Stat tiles (skill XP / boss KC) — the label alone (often a custom name) doesn't convey the task.
  if (t.trackedStat) {
    const stat = t.trackedStat.charAt(0).toUpperCase() + t.trackedStat.slice(1);
    const goal = t.statGoal && t.statGoal > 0 ? t.statGoal.toLocaleString() : '';
    const isBoss = t.statType === 'boss' || t.statType === 'kc';
    if (isBoss) return goal ? `Reach ${goal} ${stat} KC` : `${stat} KC`;
    return goal ? `Gain ${goal} ${stat} XP` : `${stat} XP`;
  }
  return null;
}

type EventRow = typeof events.$inferSelect;

// Shared board builder. `callerTeamId` null = read-only preview (no per-team view); a number =
// interactive for that team (per-cell + per-item progress).
// Exported so other board surfaces reuse the exact same shape.
export async function buildBoard(event: EventRow, callerTeamId: number | null) {
  // Tiles stay hidden in-game until the host reveals them. Return the event shell with
  // an empty tile list (and no per-team completions, since those reference tiles) plus a
  // `tilesRevealed: false` flag the plugin can branch on. Mirrors the web board gate.
  if (!event.tilesRevealed) {
    const eventTeams = await db.query.teams.findMany({ where: eq(teams.eventId, event.id) });
    return {
      eventId: event.id,
      name: event.name,
      format: event.format,
      scoringMode: event.scoringMode,
      boardSize: event.boardSize,
      yourTeamId: callerTeamId ?? -1,
      readOnly: callerTeamId == null,
      tilesRevealed: false,
      tiles: [] as never[],
      teams: eventTeams.map((tm) => ({
        teamId: tm.id,
        name: tm.name,
        color: tm.color,
        completedTileIds: [] as number[],
      })),
    };
  }

  const [allEventTiles, eventTeams] = await Promise.all([
    db.query.tiles.findMany({ where: eq(tiles.eventId, event.id) }),
    db.query.teams.findMany({ where: eq(teams.eventId, event.id) }),
  ]);

  // Reveal-policy events (see lib/eventRules): members only ever receive the revealed subset —
  // hidden tile content must never reach a client. Completions/teams stay full-board (they only
  // reference revealed tiles anyway: hidden tiles can't be completed). Classic events pass through.
  const rules = parseEventRules(event.rules);
  const revealMode = hasRevealPolicy(rules);
  const eventTiles = visibleTiles(rules, allEventTiles);
  const hiddenTileCount = allEventTiles.length - eventTiles.length;

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
    tilesRevealed: true,
    // Reveal-policy extras (absent on classic events, so their payloads/ETags are unchanged):
    // how tiles appear, how many are still hidden, and when the next one lands (null = no clock —
    // bounty draws on completion). Old plugins ignore unknown fields.
    ...(revealMode
      ? {
          revealPolicy: rules.revealPolicy,
          hiddenTileCount,
          nextRevealAt: nextRevealAt(event, rules, allEventTiles),
        }
      : {}),
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
        // Tracked item first; timed/deathless tiles fall back to the activity's signature
        // reward (Colosseum → Dizana's quiver) so previews aren't a wall of book sprites.
        itemId: representativeItemId(t.trackedItemIds, t.itemRequirements) !== -1
          ? representativeItemId(t.trackedItemIds, t.itemRequirements)
          : (t.tileType === 'timed' || t.tileType === 'deathless'
            ? notableItemFor(t.timedActivity) ?? -1
            : ((t.statType === 'boss' || t.statType === 'kc') ? bossItemForStatKey(t.trackedStat) ?? -1 : -1)),
        itemIds: allItemIds(t.trackedItemIds, t.itemRequirements),
        requiredAmount: t.requiredAmount ?? 1,
        requirement: tileRequirement(t),
        // Source restriction ("Only from …") shown structured on the plugin detail page, matching
        // the website's "Only from" chips. Empty for tiles with no source filter.
        sources: jsonNames(t.sourceNpcs),
        optional: t.optional ? 1 : 0,
        // 1 = auto-tracking off; the plugin shows a "completed manually" note on the detail page.
        autoTrackDisabled: t.autoTrackDisabled ? 1 : 0,
        category: t.category ?? null,
        // tileType + statType + statName let the plugin's preview classify the tile's kind and
        // show the skill icon, the same way the enrolled config view does.
        tileType: t.tileType ?? null,
        statType: t.statType ?? null,
        statName: t.trackedStat ?? null,
        complete: yourCompleted ? yourCompleted.has(t.id) : anyCompleted.has(t.id),
        // Reveal-policy state: when this tile went live, and (bounty) when it was claimed and
        // stopped accepting completions. Only sent on reveal-mode events.
        ...(revealMode ? { revealedAt: t.revealedAt ?? null, closedAt: t.closedAt ?? null } : {}),
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
    // Whose event is this? The id came from the query string, so it names any clan's board until
    // something asks — and this endpoint is deliberately anonymous, so nothing else will.
    const event = await eventForRequest(request, eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    // ETag/304: the clog re-fetches on tab-open but the board rarely changes — an unchanged fetch
    // returns 304 with no body (a 1000-tile board can be tens of KB gzipped). See lib/httpEtag.
    return jsonWithEtag(request, await buildBoard(event, null));
  }

  // Interactive path — the caller's own active event, scoped to their team.
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' }, { status: 401 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, auth.eventId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  return jsonWithEtag(request, await buildBoard(event, auth.teamId));
}
