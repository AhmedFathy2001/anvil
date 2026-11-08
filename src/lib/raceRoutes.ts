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
 *
 * The committed path is walked from the start: at step 0 the finished step-0 tile, then at each
 * following step the finished tile LINKED FROM the previous one. When a team holds more than one
 * finished tile at a step (only an admin toggle can do that), the one with the MOST links wins, then
 * the earlier one in board order. A finished tile off that path (also admin-only) stays done and
 * scores, but it doesn't move the team along the route.
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
}

/** Pick the tile that carries the team on: the most links, then board order. */
function pickCommitted(graph: RaceGraph, candidates: number[]): number {
  return [...candidates].sort((a, b) => {
    const na = graph.byId.get(a)!;
    const nb = graph.byId.get(b)!;
    return nb.next.length - na.next.length || na.position - nb.position || a - b;
  })[0];
}

export function teamRoute(graph: RaceGraph, doneIds: Iterable<number>): TeamRoute {
  const done = new Set(doneIds);
  const path: number[] = [];
  let options = graph.steps[0] ?? [];
  for (;;) {
    const finished = options.filter((id) => done.has(id));
    if (!finished.length) break;
    const pick = pickCommitted(graph, finished);
    path.push(pick);
    options = graph.byId.get(pick)!.next;
  }
  const current = path.length ? graph.byId.get(path[path.length - 1])! : null;
  const isFinished = current != null && current.step === graph.lastStep;
  const open = isFinished ? [] : current ? current.next.filter((id) => !done.has(id)) : (graph.steps[0] ?? []).filter((id) => !done.has(id));

  const ahead = new Set<number>();
  const queue = [...open];
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
  return { path, stepsDone: path.length, open, ahead, closed, finished: isFinished, state };
}

/**
 * May this team credit this tile now? Only an open tile (the race guard). A tile that isn't on the
 * route at all (a mission) isn't the race's to refuse; an unplaced tile on a laid-out board is.
 */
export function canCreditRaceTile(graph: RaceGraph, doneIds: Iterable<number>, tileId: number): boolean {
  if (!graph.byId.has(tileId)) return !graph.unplaced.includes(tileId);
  return teamRoute(graph, doneIds).open.includes(tileId);
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

export type RouteTemplate = 'line' | 'lanes2' | 'braid3' | 'diamond' | 'free';

export const ROUTE_TEMPLATES: { key: RouteTemplate; label: string; help: string }[] = [
  { key: 'line', label: 'Straight line', help: 'One tile per step, each leading to the next.' },
  { key: 'lanes2', label: 'Two lanes', help: 'Two side-by-side routes that never meet.' },
  { key: 'braid3', label: 'Braid', help: 'Three lanes that can swap at every other step.' },
  { key: 'diamond', label: 'Diamond', help: 'One start splits into two lanes that merge at the end.' },
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
  if (kind === 'lanes2' || kind === 'braid3') {
    const lanes = kind === 'lanes2' ? 2 : 3;
    const widths: number[] = [];
    for (let left = n; left > 0; left -= lanes) widths.push(Math.min(lanes, left));
    // Braid: lanes run straight out of even steps and may swap out of odd ones.
    return fromWidths(ids, widths, (s) => kind === 'braid3' && s % 2 === 1);
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
