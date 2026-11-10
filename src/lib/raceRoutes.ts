/**
 * Branching routes for the Tile race format (format 'tilerace').
 *
 * A race board is a set of numbered STEPS (0..N). Every board tile sits on one step and links to
 * tiles on the NEXT step only, so every route from any start (step 0) to any end (the last step) has
 * exactly the same length: "closest to the end" is simply "most steps done". Several starts, several
 * ends, splits, merges and junctions (a tile linked from several tiles and leading to several) are
 * all allowed.
 *
 * Stored per tile: `tiles.race_step` (int) and `tiles.race_next` (jsonb array of tile ids). A board
 * where NO tile has a step is today's straight line: board order (position) is the step and each tile
 * links to the next one. That keeps every existing race playing exactly as before.
 *
 * Picking a route is done by playing it. Before a team has finished anything, every step-0 tile is
 * open. After that, the open tiles are the links of the tile the team finished at its furthest step;
 * finishing one commits the team to it and the other options at that step close for that team.
 * "Roads stay open" (events.rules.raceRoad = 'open') keeps every road the team has opened open:
 * finishing a tile at an earlier fork opens its links too, and the furthest road counts.
 *
 * The committed path is the LONGEST chain of finished tiles from a finished step-0 tile, each linked
 * from the one before. When a team holds more than one finished tile at a step (an admin toggle, or
 * "Roads stay open"), the longer chain wins, then the one with the MOST links, then the earlier one
 * in board order. A finished tile off that path stays done and scores, but it doesn't move the team.
 *
 * Pure (no `@/db`): the completion guards, the plugin config, the boards and the editor all call it.
 */

export interface RouteTileIn {
  id: number;
  position: number;
  raceStep?: number | null;
  raceNext?: unknown;
  /** Combo parts aren't cells; they never sit on the route. */
  parentTileId?: number | null;
  /** Missions are bonuses outside the board; they never sit on the route. */
  mission?: number | boolean | null;
}

export interface RouteNode {
  id: number;
  position: number;
  step: number;
  next: number[];
}

export interface RaceGraph {
  /** True when the host has laid out steps; false = the classic straight line. */
  branching: boolean;
  nodes: RouteNode[];
  byId: Map<number, RouteNode>;
  /** Tile ids per step, in board order. */
  steps: number[][];
  /** Incoming links per tile id. */
  prev: Map<number, number[]>;
  lastStep: number;
  /** Board tiles with no step on a branching board — not on the route until the host places them. */
  unplaced: number[];
}

/** `race_next` as stored: a jsonb array, a JSON string, or nothing. Anything odd reads as no links. */
export function parseRaceNext(v: unknown): number[] {
  let raw: unknown = v;
  if (typeof v === 'string') {
    try {
      raw = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n)))];
}

function isBoardTile(t: RouteTileIn): boolean {
  return t.parentTileId == null && !(t.mission === 1 || t.mission === true);
}

/** True when any board tile carries a step — the board is a laid-out route, not the plain line. */
export function isBranchingRoute(tiles: RouteTileIn[]): boolean {
  return tiles.some((t) => isBoardTile(t) && t.raceStep != null);
}

export function raceGraph(tiles: RouteTileIn[]): RaceGraph {
  const board = tiles.filter(isBoardTile).sort((a, b) => a.position - b.position || a.id - b.id);
  const branching = isBranchingRoute(board);
  let nodes: RouteNode[];
  const unplaced: number[] = [];
  if (!branching) {
    nodes = board.map((t, i) => ({ id: t.id, position: t.position, step: i, next: i + 1 < board.length ? [board[i + 1].id] : [] }));
  } else {
    const placed = board.filter((t) => {
      const ok = Number.isInteger(t.raceStep) && (t.raceStep as number) >= 0;
      if (!ok) unplaced.push(t.id);
      return ok;
    });
    const stepOf = new Map(placed.map((t) => [t.id, t.raceStep as number]));
    nodes = placed.map((t) => ({
      id: t.id,
      position: t.position,
      step: t.raceStep as number,
      // Links that point nowhere valid (a deleted tile, a wrong step) are ignored at play time;
      // validateRoute reports them to the host.
      next: parseRaceNext(t.raceNext).filter((n) => stepOf.get(n) === (t.raceStep as number) + 1),
    }));
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lastStep = nodes.reduce((m, n) => Math.max(m, n.step), -1);
  const steps: number[][] = Array.from({ length: lastStep + 1 }, () => []);
  for (const n of nodes) steps[n.step].push(n.id);
  const prev = new Map<number, number[]>(nodes.map((n) => [n.id, []]));
  for (const n of nodes) for (const to of n.next) prev.get(to)?.push(n.id);
  return { branching, nodes, byId, steps, prev, lastStep, unplaced };
}

export type RaceTileState = 'done' | 'open' | 'ahead' | 'closed';

export interface TeamRoute {
  /** The committed path, one tile per step from step 0. */
  path: number[];
  stepsDone: number;
  /** Tiles the team may finish right now. */
  open: number[];
  /** Locked tiles still reachable later from the open ones. */
  ahead: Set<number>;
  /** Tiles this team can no longer reach (the alternatives it passed up). */
  closed: Set<number>;
  /** The team finished an end tile. */
  finished: boolean;
  /** Per board tile on the route. */
  state: Map<number, RaceTileState>;
  /** "Choose and lock in": the fork the team must pick from before anything opens (else empty). */
  pickFrom: number[];
  /** "Choose and lock in": the tile picked at the current fork, if any. */
  picked: number | null;
  /** "Roads stay open": open tiles may sit at earlier forks, not only after the path's end. */
  roadsOpen: boolean;
}

/** Pick the tile that carries the team on: the most links, then board order. */
function pickCommitted(graph: RaceGraph, candidates: number[]): number {
  return [...candidates].sort((a, b) => {
    const na = graph.byId.get(a)!;
    const nb = graph.byId.get(b)!;
    return nb.next.length - na.next.length || na.position - nb.position || a - b;
  })[0];
}

/** How a race's roads play (events.rules.raceRoad). 'open' = "Roads stay open". */
export type RaceRoadMode = 'achieve' | 'choose' | 'open';

export interface TeamRouteOpts {
  /**
   * Off (false): only finishes that follow the links count toward the path (the route-edit check).
   * Default on: a finish an admin kept through a route edit still holds its step.
   */
  lenient?: boolean;
  /** "Roads stay open": every road the team has opened stays open (see teamRoute). */
  roads?: 'open';
}

/** The one line every player view shows on a "Roads stay open" race (web board and plugin panel). */
export const ROADS_OPEN_NOTE = 'Roads stay open: earlier forks still count.';

/** The road modes as the admin picks them: a label and what players experience. */
export const RACE_ROAD_MODES: { key: RaceRoadMode; label: string; help: string }[] = [
  { key: 'achieve', label: 'By achievement', help: 'The first tile your team finishes at a fork sets your road. The other options at that fork close.' },
  { key: 'choose', label: 'Choose and lock in', help: 'Your team picks a road at each fork before playing it. Only the picked tile counts.' },
  {
    key: 'open',
    label: 'Roads stay open',
    help: 'Finishing a tile at any fork you’ve passed opens that road too, even from far behind. Your furthest road sets your place, and finished tiles always keep their points.',
  },
];

/** The open tiles at the team's next step (on "Roads stay open" the rest sit at earlier forks). */
export function frontOpen(graph: RaceGraph, route: Pick<TeamRoute, 'open' | 'path'>): number[] {
  return route.open.filter((id) => graph.byId.get(id)?.step === route.path.length);
}

/** teamRoute's options for a race's road mode — the one place a caller turns rules into opts. */
export function raceRouteOpts(mode: RaceRoadMode | null | undefined): TeamRouteOpts {
  return mode === 'open' ? { roads: 'open' } : {};
}

/**
 * `picks` switches on "Choose and lock in" (events.rules.raceRoad = 'choose'): step → the tile the
 * team picked there. At a fork (more than one next tile) nothing is open until the team picks; then
 * only the pick is open and the other options close. Omit (or null) for "By achievement", the
 * default: every linked next tile is open and the first one finished sets the road.
 *
 * The path, in every mode, is the LONGEST chain of finished tiles from a finished start following the
 * links (ties: pickCommitted's order, step by step), so an admin-marked finish that makes a longer
 * chain moves the team on. `opts.roads = 'open'` ("Roads stay open", picks ignored): the open tiles
 * are every unfinished start plus the unfinished links of EVERY finished tile on a finished chain
 * from a start — finishing a tile at an earlier fork opens that road too, and the furthest road
 * counts (the path).
 */
export function teamRoute(
  graph: RaceGraph,
  doneIds: Iterable<number>,
  picks?: Map<number, number> | null,
  opts: TeamRouteOpts = {},
): TeamRoute {
  const done = new Set(doneIds);
  const roadsOpen = opts.roads === 'open';
  if (roadsOpen) picks = null;
  // Which finished tiles carry on from a finished tile: its finished links; with none (lenient),
  // any finished tile on the next step — "whoever got it, got it": a finish an admin kept through a
  // route edit may no longer follow the links, and it still holds its step.
  const carry = (id: number): number[] => {
    const n = graph.byId.get(id)!;
    const linked = n.next.filter((to) => done.has(to));
    if (linked.length || opts.lenient === false) return linked;
    return (graph.steps[n.step + 1] ?? []).filter((to) => done.has(to));
  };
  // Longest chain from each finished tile, last step first; between equal chains, the one with the
  // fewest off-link hops (a chain that follows the links beats one held only by "whoever got it").
  const len = new Map<number, number>();
  const offLink = new Map<number, number>();
  const better = (a: number, b: number) => (len.get(a)! - len.get(b)!) || (offLink.get(b)! - offLink.get(a)!);
  const best = (ids: number[]): number | null => {
    if (!ids.length) return null;
    const top = ids.reduce((m, id) => (better(id, m) > 0 ? id : m));
    return pickCommitted(graph, ids.filter((id) => better(id, top) === 0));
  };
  for (let s = graph.lastStep; s >= 0; s--) {
    for (const id of graph.steps[s]) {
      if (!done.has(id)) continue;
      const nextIds = carry(id);
      const to = best(nextIds);
      const off = to != null && !graph.byId.get(id)!.next.includes(to) ? 1 : 0;
      len.set(id, 1 + (to != null ? len.get(to)! : 0));
      offLink.set(id, off + (to != null ? offLink.get(to)! : 0));
    }
  }
  const path: number[] = [];
  for (let at = best((graph.steps[0] ?? []).filter((id) => done.has(id))); at != null; at = best(carry(at))) path.push(at);
  const current = path.length ? graph.byId.get(path[path.length - 1])! : null;
  const isFinished = current != null && current.step === graph.lastStep;
  let candidates = isFinished ? [] : current ? current.next.filter((id) => !done.has(id)) : (graph.steps[0] ?? []).filter((id) => !done.has(id));
  if (roadsOpen && !isFinished) {
    // Every finished tile reachable on a finished chain from a start opens its links.
    const reached = new Set<number>((graph.steps[0] ?? []).filter((id) => done.has(id)));
    const queue = [...reached];
    while (queue.length) {
      for (const to of carry(queue.shift()!)) {
        if (!reached.has(to)) {
          reached.add(to);
          queue.push(to);
        }
      }
    }
    const opened = new Set<number>((graph.steps[0] ?? []).filter((id) => !done.has(id)));
    for (const id of reached) for (const to of graph.byId.get(id)!.next) if (!done.has(to)) opened.add(to);
    candidates = graph.nodes.filter((n) => opened.has(n.id)).map((n) => n.id);
  }
  let open = candidates;
  let pickFrom: number[] = [];
  let picked: number | null = null;
  if (picks && candidates.length > 1) {
    const step = graph.byId.get(candidates[0])!.step;
    const p = picks.get(step);
    if (p != null && candidates.includes(p)) {
      picked = p;
      open = [p];
    } else {
      open = [];
      pickFrom = candidates;
    }
  }

  const ahead = new Set<number>(pickFrom);
  const queue = [...open, ...pickFrom];
  while (queue.length) {
    const id = queue.shift()!;
    for (const to of graph.byId.get(id)?.next ?? []) {
      if (!ahead.has(to)) {
        ahead.add(to);
        queue.push(to);
      }
    }
  }
  const onPath = new Set(path);
  const openSet = new Set(open);
  const closed = new Set<number>();
  const state = new Map<number, RaceTileState>();
  for (const n of graph.nodes) {
    if (onPath.has(n.id) || done.has(n.id)) state.set(n.id, 'done');
    else if (openSet.has(n.id)) state.set(n.id, 'open');
    else if (ahead.has(n.id)) state.set(n.id, 'ahead');
    else {
      state.set(n.id, 'closed');
      closed.add(n.id);
    }
  }
  return { path, stepsDone: path.length, open, ahead, closed, finished: isFinished, state, pickFrom, picked, roadsOpen };
}

/**
 * May this team credit this tile now? Only an open tile (the race guard). A tile that isn't on the
 * route at all (a mission) isn't the race's to refuse; an unplaced tile on a laid-out board is.
 */
export function canCreditRaceTile(
  graph: RaceGraph,
  doneIds: Iterable<number>,
  tileId: number,
  picks?: Map<number, number> | null,
  opts: TeamRouteOpts = {},
): boolean {
  if (!graph.byId.has(tileId)) return !graph.unplaced.includes(tileId);
  return teamRoute(graph, doneIds, picks, opts).open.includes(tileId);
}

/** May the team pick this tile now ("Choose and lock in")? Only from the fork it stands at. */
export function canPickRaceTile(graph: RaceGraph, doneIds: Iterable<number>, picks: Map<number, number>, tileId: number): boolean {
  return teamRoute(graph, doneIds, picks).pickFrom.includes(tileId);
}

/** May this team un-finish this tile? Only when nothing at a later step is finished. */
export function canUndoRaceTile(graph: RaceGraph, doneIds: Iterable<number>, tileId: number): boolean {
  const node = graph.byId.get(tileId);
  if (!node) return true;
  for (const id of doneIds) {
    const n = graph.byId.get(id);
    if (n && n.step > node.step) return false;
  }
  return true;
}

export interface RaceStanding {
  teamId: number;
  stepsDone: number;
  finished: boolean;
  /** When the team reached its furthest step (its last path tile's completion). */
  reachedAt: string | null;
  rank: number;
}

/**
 * The race order: the first team to finish an end tile wins, then every other team by steps done,
 * then by who got there first. Ties that survive all of that share a rank.
 */
export function rankRaceTeams(
  graph: RaceGraph,
  teams: { id: number; name?: string }[],
  completions: { teamId: number; tileId: number; completedAt?: string | null }[],
): RaceStanding[] {
  const rows = teams.map((t) => {
    const mine = completions.filter((c) => c.teamId === t.id);
    const r = teamRoute(graph, mine.map((c) => c.tileId));
    const last = r.path[r.path.length - 1];
    const reachedAt = last == null ? null : mine.find((c) => c.tileId === last)?.completedAt ?? null;
    return { teamId: t.id, name: t.name ?? '', stepsDone: r.stepsDone, finished: r.finished, reachedAt };
  });
  const time = (s: string | null) => (s == null ? Number.POSITIVE_INFINITY : Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) || Number.POSITIVE_INFINITY);
  const cmp = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    Number(b.finished) - Number(a.finished) || b.stepsDone - a.stepsDone || time(a.reachedAt) - time(b.reachedAt);
  rows.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name) || a.teamId - b.teamId);
  const out: RaceStanding[] = [];
  rows.forEach((r, i) => {
    const rank = i > 0 && cmp(rows[i - 1], r) === 0 ? out[i - 1].rank : i + 1;
    out.push({ teamId: r.teamId, stepsDone: r.stepsDone, finished: r.finished, reachedAt: r.reachedAt, rank });
  });
  return out;
}

// ---- Authoring --------------------------------------------------------------------------------

/** One tile's place on the route, as the editor holds it. `step` null = not placed yet. */
export interface RouteEntry {
  id: number;
  step: number | null;
  next: number[];
}

export interface RouteProblem {
  tileId: number | null;
  message: string;
}

/**
 * Everything wrong with a route, in the host's words. Empty = playable:
 * steps contiguous from 0, links only to the next step, every non-end tile leads somewhere, every
 * tile is reachable from a start, and every dead end sits on the last step.
 */
export function validateRoute(entries: RouteEntry[], labelOf: (id: number) => string = (id) => `Tile ${id}`): RouteProblem[] {
  const problems: RouteProblem[] = [];
  if (!entries.length) return problems;
  const stepOf = new Map<number, number>();
  for (const e of entries) {
    if (e.step == null || !Number.isInteger(e.step) || e.step < 0) problems.push({ tileId: e.id, message: `${labelOf(e.id)} isn't on a step yet.` });
    else stepOf.set(e.id, e.step);
  }
  const used = [...new Set(stepOf.values())].sort((a, b) => a - b);
  const last = used.length ? used[used.length - 1] : -1;
  for (let s = 0; s <= last; s++) {
    if (!used.includes(s)) problems.push({ tileId: null, message: `Step ${s + 1} has no tiles — every step needs at least one.` });
  }
  for (const e of entries) {
    const step = stepOf.get(e.id);
    if (step == null) continue;
    for (const to of e.next) {
      const ts = stepOf.get(to);
      if (ts == null) problems.push({ tileId: e.id, message: `${labelOf(e.id)} links to a tile that isn't on the route.` });
      else if (ts !== step + 1) problems.push({ tileId: e.id, message: `${labelOf(e.id)} links to ${labelOf(to)}, which isn't on the next step.` });
    }
    const validOut = e.next.filter((to) => stepOf.get(to) === step + 1);
    if (step < last && validOut.length === 0) problems.push({ tileId: e.id, message: `${labelOf(e.id)} leads nowhere — link it to a tile on step ${step + 2}.` });
  }
  // Reachability from the starts, over valid links only.
  const nextOf = new Map(entries.map((e) => [e.id, e.next.filter((to) => stepOf.get(to) === (stepOf.get(e.id) ?? -2) + 1)]));
  const seen = new Set<number>();
  const queue = entries.filter((e) => stepOf.get(e.id) === 0).map((e) => e.id);
  queue.forEach((id) => seen.add(id));
  while (queue.length) {
    const id = queue.shift()!;
    for (const to of nextOf.get(id) ?? []) if (!seen.has(to)) (seen.add(to), queue.push(to));
  }
  for (const e of entries) {
    if (stepOf.has(e.id) && !seen.has(e.id)) problems.push({ tileId: e.id, message: `${labelOf(e.id)} can't be reached — link a tile on step ${stepOf.get(e.id)!} to it.` });
  }
  return problems;
}

/** The current route of a board, as editor entries (the straight line when nothing is laid out). */
export function routeEntries(tiles: RouteTileIn[]): RouteEntry[] {
  const g = raceGraph(tiles);
  const board = tiles.filter(isBoardTile).sort((a, b) => a.position - b.position || a.id - b.id);
  return board.map((t) => {
    const n = g.byId.get(t.id);
    // Keep the host's stored links verbatim (even broken ones) so validation can name them.
    return n ? { id: t.id, step: n.step, next: g.branching ? parseRaceNext(t.raceNext) : n.next } : { id: t.id, step: null, next: [] };
  });
}

export type RouteTemplate = 'line' | 'lanes2' | 'braid3' | 'braid5' | 'diamond' | 'free';

/** The templates, the default first: one start, lanes in between, one finish. */
export const ROUTE_TEMPLATES: { key: RouteTemplate; label: string; help: string }[] = [
  { key: 'diamond', label: 'Diamond', help: 'One start tile splits into two roads that merge again at one finish tile.' },
  { key: 'lanes2', label: 'Two roads', help: 'One start, two side-by-side roads that never meet, one finish.' },
  { key: 'braid3', label: 'Braid', help: 'One start, three roads that can swap at every other step, one finish.' },
  { key: 'braid5', label: 'Five roads', help: 'One start, five roads that can swap with a neighbour at every other step, one finish.' },
  { key: 'line', label: 'Straight line', help: 'One tile per step, each leading to the next.' },
  { key: 'free', label: 'Free', help: 'One tile per step and no links — draw every link yourself.' },
];

/**
 * Link one step to the next. Equal widths run lane-to-lane (plus the neighbouring lanes when
 * `cross`); different widths spread proportionally, making sure every tile ahead has a way in.
 */
function connect(from: number[], to: number[], cross: boolean): Map<number, number[]> {
  const out = new Map<number, Set<number>>(from.map((id) => [id, new Set<number>()]));
  if (!to.length) return new Map(from.map((id) => [id, []]));
  if (from.length === to.length) {
    from.forEach((id, i) => {
      out.get(id)!.add(to[i]);
      if (cross) {
        if (i > 0) out.get(id)!.add(to[i - 1]);
        if (i < to.length - 1) out.get(id)!.add(to[i + 1]);
      }
    });
  } else {
    from.forEach((id, i) => out.get(id)!.add(to[Math.min(to.length - 1, Math.floor((i * to.length) / from.length))]));
    to.forEach((id, j) => out.get(from[Math.min(from.length - 1, Math.floor((j * from.length) / to.length))])!.add(id));
  }
  return new Map([...out].map(([k, v]) => [k, [...v]]));
}

function fromWidths(ids: number[], widths: number[], crossAt: (step: number) => boolean): RouteEntry[] {
  const steps: number[][] = [];
  let i = 0;
  for (const w of widths) {
    steps.push(ids.slice(i, i + w));
    i += w;
  }
  const entries: RouteEntry[] = [];
  steps.forEach((ids2, s) => {
    const links = s + 1 < steps.length ? connect(ids2, steps[s + 1], crossAt(s)) : new Map<number, number[]>();
    for (const id of ids2) entries.push({ id, step: s, next: links.get(id) ?? [] });
  });
  return entries;
}

/** Steps and links for a template over these tiles (in board order). Tile content is untouched. */
export function applyRouteTemplate(kind: RouteTemplate, ids: number[]): RouteEntry[] {
  const n = ids.length;
  if (!n) return [];
  if (kind === 'free') return ids.map((id, s) => ({ id, step: s, next: [] }));
  if (kind === 'line') return fromWidths(ids, ids.map(() => 1), () => false);
  if (kind === 'lanes2' || kind === 'braid3' || kind === 'braid5') {
    const lanes = kind === 'lanes2' ? 2 : kind === 'braid3' ? 3 : 5;
    // One fixed start and one fixed finish around the roads, once there are tiles for both.
    const framed = n >= lanes + 2;
    const widths: number[] = framed ? [1] : [];
    for (let left = framed ? n - 2 : n; left > 0; left -= lanes) widths.push(Math.min(lanes, left));
    if (framed) widths.push(1);
    // Braid: roads run straight out of one step and may swap out of the next, alternately.
    return fromWidths(ids, widths, (s) => kind !== 'lanes2' && (framed ? s % 2 === 0 && s > 0 : s % 2 === 1));
  }
  // Diamond: one start, two lanes, one finish (an odd tile out becomes a single junction mid-way).
  if (n <= 3) return fromWidths(ids, ids.map(() => 1), () => false);
  const middle = n - 2;
  const pairs = Math.floor(middle / 2);
  const widths = [1, ...Array<number>(pairs).fill(2), 1];
  if (middle % 2 === 1) widths.splice(1 + Math.ceil(pairs / 2), 0, 1);
  return fromWidths(ids, widths, () => false);
}

/** Move a tile to another step; links that stop making sense are dropped and listed. */
export function moveTileToStep(entries: RouteEntry[], tileId: number, step: number): { entries: RouteEntry[]; dropped: number } {
  let dropped = 0;
  const next = entries.map((e) => (e.id === tileId ? { ...e, step } : e));
  const stepOf = new Map(next.map((e) => [e.id, e.step]));
  const cleaned = next.map((e) => {
    const keep = e.next.filter((to) => e.step != null && stepOf.get(to) === e.step + 1);
    dropped += e.next.length - keep.length;
    return keep.length === e.next.length ? e : { ...e, next: keep };
  });
  return { entries: cleaned, dropped };
}

/** Toggle a link between two tiles (only ever from step k to step k+1). */
export function toggleRouteLink(entries: RouteEntry[], from: number, to: number): RouteEntry[] {
  const a = entries.find((e) => e.id === from);
  const b = entries.find((e) => e.id === to);
  if (!a || !b || a.step == null || b.step == null) return entries;
  // Clicking either direction works: the link always runs forward.
  const [src, dst] = b.step === a.step + 1 ? [a, b] : a.step === b.step + 1 ? [b, a] : [null, null];
  if (!src || !dst) return entries;
  return entries.map((e) =>
    e.id === src.id ? { ...e, next: e.next.includes(dst.id) ? e.next.filter((x) => x !== dst.id) : [...e.next, dst.id] } : e,
  );
}

/** Insert an empty step before `at` (or at the end); later tiles shift one step on, links kept. */
export function insertStep(entries: RouteEntry[], at: number): RouteEntry[] {
  // Links that crossed the gap now skip a step; drop them (the host relinks through the new step).
  const shifted = entries.map((e) => (e.step != null && e.step >= at ? { ...e, step: e.step + 1 } : e));
  return moveTileToStepAll(shifted).entries;
}

/** Remove step `at`: its tiles become unplaced, later steps move back one. */
export function removeStep(entries: RouteEntry[], at: number): { entries: RouteEntry[]; dropped: number } {
  const removed = new Set(entries.filter((e) => e.step === at).map((e) => e.id));
  const shifted = entries.map((e) =>
    removed.has(e.id) ? { ...e, step: null, next: [] } : e.step != null && e.step > at ? { ...e, step: e.step - 1 } : e,
  );
  return moveTileToStepAll(shifted);
}

/**
 * Take a tile off the map. When it was the only tile on its step, the step closes up: later steps
 * move back one and the roads that ran into it run straight on to where it led, so removing the
 * middle of a straight road leaves a straight road. `gone` = tiles already off the map (they don't
 * count as company on the step).
 */
export function removeTileFromRoute(entries: RouteEntry[], id: number, gone: readonly number[] = []): RouteEntry[] {
  const tile = entries.find((e) => e.id === id);
  const at = tile?.step;
  if (tile == null || at == null) return entries;
  const alone = !entries.some((e) => e.id !== id && e.step === at && !gone.includes(e.id));
  return entries.map((e) => {
    if (e.id === id) return { ...e, step: null, next: [] };
    let next = e.next.filter((n) => n !== id);
    if (alone && e.next.includes(id)) next = [...new Set([...next, ...tile.next])];
    const step = alone && e.step != null && e.step > at ? e.step - 1 : e.step;
    return next.length === e.next.length && next.every((n, i) => n === e.next[i]) && step === e.step ? e : { ...e, step, next };
  });
}

/** Swap step `at` with step `at + dir`. */
export function swapSteps(entries: RouteEntry[], at: number, dir: -1 | 1): { entries: RouteEntry[]; dropped: number } {
  const other = at + dir;
  if (other < 0) return { entries, dropped: 0 };
  const swapped = entries.map((e) => (e.step === at ? { ...e, step: other } : e.step === other ? { ...e, step: at } : e));
  return moveTileToStepAll(swapped);
}

/** Drop every link that no longer runs to the next step. */
function moveTileToStepAll(entries: RouteEntry[]): { entries: RouteEntry[]; dropped: number } {
  let dropped = 0;
  const stepOf = new Map(entries.map((e) => [e.id, e.step]));
  const out = entries.map((e) => {
    const keep = e.next.filter((to) => e.step != null && stepOf.get(to) === e.step + 1);
    dropped += e.next.length - keep.length;
    return keep.length === e.next.length ? e : { ...e, next: keep };
  });
  return { entries: out, dropped };
}

/** Board order a saved route implies: by step, then the order tiles already had. */
export function routeOrder(entries: RouteEntry[], positionOf: (id: number) => number): number[] {
  return [...entries]
    .sort((a, b) => (a.step ?? 1e9) - (b.step ?? 1e9) || positionOf(a.id) - positionOf(b.id))
    .map((e) => e.id);
}

// ---- Display helpers (the board map, tile lists, tile details, the panel) ---------------------

/** Road letter for a tile: its place in its step's column, top to bottom (A, B, C…). */
export function roadOf(graph: RaceGraph, tileId: number): string {
  const n = graph.byId.get(tileId);
  if (!n) return '';
  const i = graph.steps[n.step].indexOf(tileId);
  return i < 0 ? '' : i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

/** Where routes meet: a tile with several ways in and out. */
export function tileShape(graph: RaceGraph, tileId: number): 'junction' | 'split' | 'merge' | null {
  const ins = graph.prev.get(tileId)?.length ?? 0;
  const outs = graph.byId.get(tileId)?.next.length ?? 0;
  return ins > 1 && outs > 1 ? 'junction' : outs > 1 ? 'split' : ins > 1 ? 'merge' : null;
}

/** "Start" / "Tile 4" / "Junction" / "Finish" — the label over a step's column. */
/**
 * A step's column name — the ONE vocabulary every race view uses: "Start" (a single start tile) or
 * "Step 1", then "Step 2" … and "Finish". Where routes meet is shown on the tile, not the column.
 */
export function stepTitle(graph: RaceGraph, step: number): string {
  if (step === 0) return graph.lastStep === 0 ? 'Start · finish' : (graph.steps[0]?.length ?? 0) > 1 ? 'Step 1' : 'Start';
  if (step === graph.lastStep) return 'Finish';
  return `Step ${step + 1}`;
}

/** "Step 4 of 10", plus "junction" where routes meet. */
export function stepLine(graph: RaceGraph, tileId: number): string {
  const n = graph.byId.get(tileId);
  if (!n) return '';
  const shape = tileShape(graph, tileId);
  const base = `Step ${n.step + 1} of ${graph.lastStep + 1}`;
  return shape === 'junction' ? `${base} · junction` : base;
}

/** What finishing an open tile does to the team's road. */
export function roadChoiceLine(graph: RaceGraph, route: TeamRoute, tileId: number): string {
  const to = roadOf(graph, tileId);
  const atId = route.path.length ? route.path[route.path.length - 1] : null;
  const at = atId != null ? roadOf(graph, atId) : null;
  if (at == null) return `Starts you on road ${to}`;
  // "Roads stay open": a tile at or behind the team's furthest step opens a road beside it.
  if (route.roadsOpen && (graph.byId.get(tileId)?.step ?? 0) <= graph.byId.get(atId!)!.step) return `Opens road ${to} too`;
  return at === to ? `Keeps you on road ${to}` : `Switches you to road ${to}`;
}

export interface RaceTileInfo {
  state: RaceTileState | null;
  road: string;
  step: number;
  stepLine: string;
  /** One sentence for the state banner. */
  why: string;
  leadsTo: number[];
  reachedFrom: number[];
}

/** Everything a tile's detail view says about its place on the route, for the viewer's team. */
export function raceTileInfo(graph: RaceGraph, route: TeamRoute | null, tileId: number, labelOf: (id: number) => string): RaceTileInfo | null {
  const n = graph.byId.get(tileId);
  if (!n) return null;
  const state = route?.state.get(tileId) ?? null;
  const reachedFrom = graph.prev.get(tileId) ?? [];
  let why = '';
  const road = route ? roadChoiceLine(graph, route, tileId).replace(/^\w/, (c) => c.toLowerCase()) : '';
  if (route && state === 'open') {
    why = route.roadsOpen
      ? `Open — every road your team opens stays open; the furthest one counts. This one ${road}.`
      : route.open.length > 1
      ? `Up next — whichever your team finishes first sets your road. This one ${road}.`
      : `Next for your team — finishing this ${road}.`;
  } else if (route && route.pickFrom.includes(tileId)) {
    why = `Fork — your team picks its road before anything here counts. Picking this ${road}; a pick can’t be changed.`;
  }
  else if (route && state === 'done') why = 'Done — on your team’s route.';
  else if (route && state === 'ahead') {
    const from = reachedFrom.length ? reachedFrom : [];
    why = n.step === 0 ? 'Locked.' : `Locked — finish one of: ${from.map(labelOf).join(', ')} to open this.`;
  } else if (route && state === 'closed') {
    const taken = route.path.find((id) => graph.byId.get(id)!.step === n.step);
    const branch = route.path.find((id) => graph.byId.get(id)!.step >= Math.max(0, n.step - 1) && graph.byId.get(id)!.step <= n.step);
    why = taken != null
      ? `Locked — your team took road ${roadOf(graph, taken)} at step ${n.step + 1}.`
      : branch != null
        ? `Locked — your team’s road doesn’t lead here (road ${roadOf(graph, branch)}).`
        : 'Locked — your team’s road doesn’t lead here.';
  }
  return { state, road: roadOf(graph, tileId), step: n.step, stepLine: stepLine(graph, tileId), why, leadsTo: n.next, reachedFrom };
}

/** Each team's current tile (its path's last), and how many teams travelled each link. */
export function raceCrowd(graph: RaceGraph, routes: Map<number, TeamRoute>): { at: Map<number, number[]>; traffic: Map<string, number>; atStart: number[] } {
  const at = new Map<number, number[]>();
  const traffic = new Map<string, number>();
  const atStart: number[] = [];
  for (const [teamId, r] of routes) {
    const cur = r.path[r.path.length - 1];
    if (cur == null) atStart.push(teamId);
    else at.set(cur, [...(at.get(cur) ?? []), teamId]);
    for (let i = 0; i + 1 < r.path.length; i++) {
      const k = `${r.path[i]}-${r.path[i + 1]}`;
      traffic.set(k, (traffic.get(k) ?? 0) + 1);
    }
  }
  return { at, traffic, atStart };
}

export type RaceFieldSize = 'few' | 'medium' | 'huge';
/** Which board variant fits the field: a handful of teams, a crowd, or a solo-sized field. */
export function raceFieldSize(entrants: number): RaceFieldSize {
  return entrants <= 6 ? 'few' : entrants <= 30 ? 'medium' : 'huge';
}

/**
 * Does a stat (XP / KC) race tile need a baseline taken when it opens for a team? Every tile does,
 * except one open from the whistle — a step-0 tile on a "By achievement" race, or the only start —
 * which counts from the event start like any board tile.
 */
export function raceTileNeedsBaseline(graph: RaceGraph, tileId: number, mode: RaceRoadMode): boolean {
  const n = graph.byId.get(tileId);
  if (!n) return false;
  if (n.step > 0) return true;
  return mode === 'choose' && (graph.steps[0]?.length ?? 0) > 1;
}

// ---- Mid-race route edits ---------------------------------------------------------------------

export interface RouteEditImpact {
  teamId: number;
  /** Finishes that no longer follow on the new route, earliest step first (they and everything after). */
  invalid: number[];
}

/**
 * What a route edit does to progress already made: for every team, the finishes on its committed
 * path under the OLD route that don't follow on the NEW one (strictly, link by link), plus every
 * later finish that hung off them. Empty = the edit touches nobody's progress.
 */
export function routeEditImpact(
  oldGraph: RaceGraph,
  newGraph: RaceGraph,
  doneByTeam: Map<number, number[]>,
): RouteEditImpact[] {
  const out: RouteEditImpact[] = [];
  for (const [teamId, done] of doneByTeam) {
    const oldPath = teamRoute(oldGraph, done, null, { lenient: false }).path;
    const onRoute = new Set(oldGraph.nodes.map((n) => n.id));
    const routeDone = done.filter((id) => onRoute.has(id) || newGraph.byId.has(id));
    const strictNew = new Set(teamRoute(newGraph, oldPath, null, { lenient: false }).path);
    // The first old-path finish that doesn't survive cuts the path; everything from there is invalid.
    const cut = oldPath.findIndex((id) => !strictNew.has(id));
    const invalid = new Set<number>(cut < 0 ? [] : oldPath.slice(cut));
    // Finishes off the old path that still count somewhere ahead of the cut go with it.
    if (cut >= 0) {
      for (const id of routeDone) {
        const n = newGraph.byId.get(id) ?? oldGraph.byId.get(id);
        if (n && n.step >= cut && !strictNew.has(id)) invalid.add(id);
      }
    }
    if (invalid.size) {
      const stepOf = (id: number) => newGraph.byId.get(id)?.step ?? oldGraph.byId.get(id)?.step ?? 0;
      out.push({ teamId, invalid: [...invalid].sort((a, b) => stepOf(a) - stepOf(b) || a - b) });
    }
  }
  return out;
}
