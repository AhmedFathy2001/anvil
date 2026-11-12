/**
 * Tile race "Hide tiles past the next step" (events.rules.raceHideAhead, lib/eventRules).
 *
 * With it on, a team sees only its own road: the tiles it walked and finished, and the tiles it can
 * play now. Other roads, even on the same step, stay hidden. Every tile further along stays on the map as a locked "?" (same slot, same roads, so
 * the route never shifts) with nothing else: no name, icon, description, items or tracking. What
 * "next" means follows the team's own route (lib/raceRoutes teamRoute), so a fork, "Choose and lock
 * in" and "Roads stay open" all come out right without a rule of their own.
 *
 * The veil is per TEAM. A view that belongs to no team (the public board, a stream overlay, a shared
 * Discord channel) gets only what EVERY team can already see; a view for event staff (when the host
 * hid it from staff too) gets what ANY team can see, so a reviewer can still read any team's proof.
 *
 * Pure (no `@/db`): lib/raceHideAheadDb loads the inputs, the tests drive this directly.
 */

import type { RaceHideAhead } from '@/lib/eventRules';
import type { RaceGraph, TeamRoute } from '@/lib/raceRoutes';

/** The name a hidden tile carries anywhere a string is needed (the boards draw a "?" instead). */
export const HIDDEN_RACE_TILE_LABEL = 'Locked tile';

/** The tiles one team can see: finished ones and everything up to the step it plays next. Null = all of them. */
// `_graph` stays in the signature: callers and tests pass it, and a later rule may need the map.
export function raceTeamSeen(_graph: RaceGraph, route: TeamRoute): Set<number> | null {
  if (route.finished) return null;
  // Only the team's own road: the tiles it walked, finished, and can move to now (on "Roads stay
  // open" that includes earlier forks it can still play). Every other tile, even on the same step
  // or a road it passed up, stays a "?", so a hidden race never shows what another road holds.
  const seen = new Set<number>(route.path);
  for (const id of route.open) seen.add(id);
  if (route.picked != null) seen.add(route.picked);
  for (const id of route.pickFrom) seen.add(id);
  for (const [id, st] of route.state) if (st === 'done') seen.add(id);
  return seen;
}

export interface RaceVeil {
  mode: Exclude<RaceHideAhead, 'off'>;
  /** Every tile the veil covers: the route's tiles and any board tile not placed on it yet. */
  covered: Set<number>;
  /** Per team, the tiles it sees (null = the whole board: it finished). */
  seenByTeam: Map<number, Set<number> | null>;
  /** What every team can see (the public's view). */
  everyone: Set<number>;
  /** What at least one team can see (event staff's view when they're hidden from too). */
  anyone: Set<number>;
  /** Each route tile's step (0-based), and the last step: what a shared post says instead of a name. */
  stepOf: Map<number, number>;
  lastStep: number;
}

/**
 * The veil over a race. `routes` holds every team's route; `unplaced` the board tiles not on the
 * route yet (hidden from everyone, they aren't playable anyway). With no teams the public sees the
 * start only.
 */
export function buildRaceVeil(
  mode: Exclude<RaceHideAhead, 'off'>,
  graph: RaceGraph,
  routes: Map<number, TeamRoute>,
): RaceVeil {
  const covered = new Set<number>([...graph.byId.keys(), ...graph.unplaced]);
  const seenByTeam = new Map<number, Set<number> | null>();
  for (const [teamId, route] of routes) seenByTeam.set(teamId, raceTeamSeen(graph, route));
  const all = [...covered];
  const sets = [...seenByTeam.values()];
  const sees = (s: Set<number> | null, id: number) => s == null || s.has(id);
  const start = new Set(graph.steps[0] ?? []);
  const everyone = new Set(sets.length ? all.filter((id) => sets.every((s) => sees(s, id))) : start);
  const anyone = new Set(sets.length ? all.filter((id) => sets.some((s) => sees(s, id))) : start);
  const stepOf = new Map<number, number>([...graph.byId].map(([id, n]) => [id, n.step]));
  return { mode, covered, seenByTeam, everyone, anyone, stepOf, lastStep: graph.lastStep };
}

/**
 * Who is looking: 'all' sees through (staff while only players are hidden from, the owner, a board
 * editor), 'staff' is event staff under "Also hide from event staff", otherwise the viewer's teams
 * (empty = the public).
 */
export type RaceViewer = 'all' | 'staff' | { teamIds: number[] };

/** The tile ids this viewer may read (null = every one). */
export function raceSeenFor(veil: RaceVeil | null, viewer: RaceViewer): Set<number> | null {
  if (!veil || viewer === 'all') return null;
  if (viewer === 'staff') return veil.anyone;
  if (!viewer.teamIds.length) return veil.everyone;
  const out = new Set<number>(veil.everyone);
  for (const teamId of viewer.teamIds) {
    if (!veil.seenByTeam.has(teamId)) continue;
    const s = veil.seenByTeam.get(teamId);
    if (s == null) return null;
    for (const id of s) out.add(id);
  }
  return out;
}

/** Is this tile (or the combo it belongs to) hidden from a viewer who sees `seen`? */
export function raceTileHidden(
  veil: RaceVeil | null,
  seen: Set<number> | null,
  tile: { id: number; parentTileId?: number | null },
): boolean {
  if (!veil || seen == null) return false;
  const id = tile.parentTileId ?? tile.id;
  return veil.covered.has(id) && !seen.has(id);
}

/** Can some team OTHER than `teamId` not see this tile yet? (Then a post naming it stays in-team.) */
export function hiddenFromAnotherTeam(veil: RaceVeil | null, tileId: number, teamId: number | null | undefined): boolean {
  if (!veil || !veil.covered.has(tileId)) return false;
  for (const [id, seen] of veil.seenByTeam) {
    if (id === teamId) continue;
    if (seen != null && !seen.has(tileId)) return true;
  }
  return false;
}

/**
 * What a locked "?" keeps: where it sits on the map and its roads, and the reveal timestamps the
 * boards already read. An ALLOWLIST: a field added to tiles later stays off a hidden tile until
 * someone decides it may show.
 */
export const MASKED_TILE_KEEP = ['id', 'eventId', 'position', 'raceStep', 'raceNext', 'parentTileId', 'mission', 'revealAt', 'revealedAt', 'closedAt'] as const;

/** Fields a board needs to have, given a neutral value that says nothing about the tile. */
const MASKED_TILE_NEUTRAL: Record<string, (v: unknown) => unknown> = {
  label: () => HIDDEN_RACE_TILE_LABEL,
  tileType: () => 'standard',
  requiredAmount: () => 1,
  points: () => 0,
  optional: (v) => (typeof v === 'number' ? 0 : false),
  autoTrackDisabled: (v) => (typeof v === 'number' ? 1 : true),
  parts: () => [],
};

/** The keys a masked tile can carry: the allowlist, the neutral fields, and the flag. */
export const MASKED_TILE_KEYS: readonly string[] = [...MASKED_TILE_KEEP, ...Object.keys(MASKED_TILE_NEUTRAL), 'raceHidden'];

/**
 * The same tile as a locked "?": its id, place on the board and roads, and nothing that says what it
 * is. Every other field is dropped; `raceHidden` tells the boards to draw the "?".
 */
export function maskRaceTile<T extends { id: number; label?: string | null }>(tile: T): T & { raceHidden: true } {
  const src = tile as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of MASKED_TILE_KEEP) if (k in src) out[k] = src[k];
  for (const [k, neutral] of Object.entries(MASKED_TILE_NEUTRAL)) if (k in src || k === 'label') out[k] = neutral(src[k]);
  out.raceHidden = true;
  return out as T & { raceHidden: true };
}

/**
 * Mask the hidden tiles in a list for a viewer who sees `seen`. Parts of a hidden combo are dropped
 * (a part is a cell's content). Same order, same length for board cells.
 */
export function maskRaceTiles<T extends { id: number; label?: string | null; parentTileId?: number | null }>(
  veil: RaceVeil | null,
  seen: Set<number> | null,
  tiles: T[],
): T[] {
  if (!veil || seen == null) return tiles;
  const out: T[] = [];
  for (const t of tiles) {
    if (!raceTileHidden(veil, seen, t)) out.push(t);
    else if (t.parentTileId == null) out.push(maskRaceTile(t));
  }
  return out;
}

/** Did maskRaceTile make this one a locked "?"? */
export function isRaceHidden(tile: object): boolean {
  return (tile as { raceHidden?: unknown }).raceHidden === true;
}
