// The tile lab's planning half: what a new lab session looks like for each event type, who sits on
// which team, how a race route is laid out, and which credits "Simulate the field" hands out.
//
// PURE — no database import. lib/lab and lib/labField write what these functions decide; the lab
// page reads the format list to draw its picker; the tests pin the rules without a server.
//
// Every event type comes from lib/eventModes (the same list the create form offers), plus Solo from
// lib/formatCatalog (a classic board with every player on their own). The weekly competitions (Skill
// / Boss of the Week, efficiency races) are not boards — they have no tiles to test — so the lab
// leaves them out.

import { EVENT_MODES, type EventMode } from '@/lib/eventModes';
import type { RevealPolicy } from '@/lib/eventRules';
import { nextTeamColour, nextTeamName, soloTeamName } from '@/lib/teamPlacement';

// ── Event types ──────────────────────────────────────────────────────────────────────────────

export type LabFormatKey = EventMode | 'solo';

export interface LabFormat {
  key: LabFormatKey;
  label: string;
  blurb: string;
  /** events.format / events.scoring_mode as the real create route stores them. */
  format: 'bingo' | 'tilerace' | 'ladder';
  scoringMode: 'tiles' | 'points';
  revealPolicy: RevealPolicy;
  /** True: boardSize is N of an N×N grid. False: boardSize is the tile count. */
  square: boolean;
  sizeLabel: string;
  min: number;
  max: number;
  /** What the size picker opens on. */
  defaultSize: number;
  /** Where entrants go by default: one shared team, or everyone on their own. */
  defaultPlacement: LabPlacement;
}

export type LabPlacement = 'team' | 'solo';

function fromMode(key: EventMode): LabFormat {
  const m = EVENT_MODES.find((x) => x.key === key)!;
  return {
    key,
    label: m.label,
    blurb: m.blurb,
    format: m.format,
    scoringMode: m.scoringMode,
    revealPolicy: m.revealPolicy ?? 'all',
    square: m.square,
    sizeLabel: m.sizeLabel,
    // The lab may always go down to a single tile on a grid: that is the "test one tile" session.
    min: m.square ? 1 : m.min,
    max: m.max,
    defaultSize: m.default,
    // A ladder is a personal leaderboard first; everything else starts as one team.
    defaultPlacement: m.format === 'ladder' ? 'solo' : 'team',
  };
}

export const LAB_FORMATS: readonly LabFormat[] = [
  ...EVENT_MODES.map((m) => fromMode(m.key)),
  {
    ...fromMode('classic'),
    key: 'solo',
    label: 'Solo bingo',
    blurb: 'A classic grid where every player is on their own: each entrant is a team named after their character.',
    defaultPlacement: 'solo',
  },
];

export function labFormat(key: unknown): LabFormat {
  return LAB_FORMATS.find((f) => f.key === key) ?? LAB_FORMATS[0];
}

/** The size actually used: rounded and held inside the format's bounds (default when not a number). */
export function labBoardSize(fmt: LabFormat, raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fmt.defaultSize;
  return Math.min(Math.max(n, fmt.min), fmt.max);
}

export function labTileCount(fmt: LabFormat, size: number): number {
  return fmt.square ? size * size : size;
}

/** Point values handed to a points board's tiles, cycling so standings spread out. */
const POINT_STEPS = [5, 10, 15, 25, 50];

/** Minutes between tiles opening on a Showdown lab board, and between draws on the drawing formats. */
export const LAB_REVEAL_MINUTES = 5;

export interface LabTileSeed {
  position: number;
  label: string;
  points: number;
  /** Showdown only: when this tile opens. */
  revealAt: string | null;
}

/** The blank tiles of a new session, in board order. */
export function labTileSeeds(fmt: LabFormat, size: number, startMs: number): LabTileSeed[] {
  const count = labTileCount(fmt, size);
  const noun = fmt.format === 'tilerace' ? 'Step' : fmt.format === 'ladder' ? 'Task' : 'Lab tile';
  return Array.from({ length: count }, (_, i) => ({
    position: i,
    label: `${noun} ${i + 1}`,
    points: fmt.scoringMode === 'points' ? POINT_STEPS[i % POINT_STEPS.length] : 1,
    // Showdown: one opens at the start, then one every few minutes, so a short session sees several.
    revealAt: fmt.revealPolicy === 'scheduled' ? new Date(startMs + i * LAB_REVEAL_MINUTES * 60_000).toISOString() : null,
  }));
}

/**
 * The rules object a session of this type starts with (fed through lib/eventRules
 * validateEventRules, so it is stored exactly as the real create route would store it). Null for
 * the plain formats. The drawing formats run fast so a short session sees them work, and nothing
 * posts its rules: the lab clan has no Discord, and nothing about a test is news.
 */
export function labRules(fmt: LabFormat): Record<string, unknown> | null {
  if (fmt.revealPolicy === 'all') return { rulesAtStart: false };
  return {
    revealPolicy: fmt.revealPolicy,
    revealIntervalMinutes: LAB_REVEAL_MINUTES,
    revealBatchSize: fmt.format === 'ladder' ? 3 : 1,
    rulesAtStart: false,
  };
}

// ── Race routes ──────────────────────────────────────────────────────────────────────────────
//
// Branching tile races store `tiles.race_step` and `tiles.race_next` (the feat/race-branches work,
// lib/raceRoutes). The lab only offers these when those columns exist in the schema; on a database
// without them a race is the straight line, as every race was before.

export type LabRouteTemplate = 'line' | 'lanes2' | 'diamond' | 'braid3';

export const LAB_ROUTE_TEMPLATES: { key: LabRouteTemplate; label: string; help: string }[] = [
  { key: 'line', label: 'Straight line', help: 'One tile per step (no steps stored — the classic race).' },
  { key: 'lanes2', label: 'Two lanes', help: 'Two side-by-side routes that never meet.' },
  { key: 'diamond', label: 'Diamond', help: 'One start splits into two lanes that merge at the end.' },
  { key: 'braid3', label: 'Braid', help: 'Three lanes that can swap at every other step.' },
];

export interface RouteEntry {
  id: number;
  step: number;
  next: number[];
}

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
  steps.forEach((row, s) => {
    const links = s + 1 < steps.length ? connect(row, steps[s + 1], crossAt(s)) : new Map<number, number[]>();
    for (const id of row) entries.push({ id, step: s, next: links.get(id) ?? [] });
  });
  return entries;
}

/**
 * Steps and links for a route template over these tile ids (board order), in the shape
 * lib/raceRoutes reads: every link goes to the next step, so every route has the same length.
 * Mirrors applyRouteTemplate on the race-branches work; 'line' returns [] (store nothing).
 */
export function labRouteLayout(kind: LabRouteTemplate, ids: number[]): RouteEntry[] {
  const n = ids.length;
  if (!n || kind === 'line') return [];
  if (kind === 'lanes2' || kind === 'braid3') {
    const lanes = kind === 'lanes2' ? 2 : 3;
    const widths: number[] = [];
    for (let left = n; left > 0; left -= lanes) widths.push(Math.min(lanes, left));
    return fromWidths(ids, widths, (s) => kind === 'braid3' && s % 2 === 1);
  }
  if (n <= 3) return fromWidths(ids, ids.map(() => 1), () => false);
  const middle = n - 2;
  const pairs = Math.floor(middle / 2);
  const widths = [1, ...Array<number>(pairs).fill(2), 1];
  if (middle % 2 === 1) widths.splice(1 + Math.ceil(pairs / 2), 0, 1);
  return fromWidths(ids, widths, () => false);
}

// ── Who plays for whom ───────────────────────────────────────────────────────────────────────

/** Most test players one session may be filled with: a big public event, previewed. */
export const MAX_LAB_FIELD = 200;
export const MAX_LAB_TEAM_SIZE = 10;

export interface LabEntrant {
  /** Stable key the caller maps back to an account (an account id, or a test-player name). */
  key: string;
  name: string;
  /** The staffer's own character (true) or a test player (false). */
  own: boolean;
}

export interface PlannedTeam {
  name: string;
  color: string;
  members: string[];
}

/** "Field1"… — the test players a session is filled with (lib/labCast makes them Lab~Field1…). */
export function fieldPlayerNames(count: number): string[] {
  const n = Math.max(0, Math.min(MAX_LAB_FIELD, Math.round(count)));
  return Array.from({ length: n }, (_, i) => `Field${i + 1}`);
}

/**
 * The teams a session opens with.
 *
 *   team — your characters share one team ("Lab"); test players are dealt into teams of
 *          `teamSize` (the last one may be short), so "30 teams of 3" is 90 players at size 3.
 *   solo — everyone is a team of one, named after the character (lib/teamPlacement soloTeamName).
 *
 * `existing` is the names already on the board, so adding a field later never collides.
 */
export function planLabTeams(args: {
  placement: LabPlacement;
  entrants: LabEntrant[];
  teamSize: number;
  existing?: { name: string; color: string }[];
}): PlannedTeam[] {
  const names = (args.existing ?? []).map((t) => t.name);
  const colours = (args.existing ?? []).map((t) => t.color);
  const out: PlannedTeam[] = [];
  const add = (name: string, members: string[]) => {
    const color = nextTeamColour(colours);
    names.push(name);
    colours.push(color);
    out.push({ name, color, members });
  };
  if (args.placement === 'solo') {
    for (const e of args.entrants) add(soloTeamName(e.name, names), [e.key]);
    return out;
  }
  const own = args.entrants.filter((e) => e.own);
  if (own.length) add(names.includes('Lab') ? nextTeamName(names) : 'Lab', own.map((e) => e.key));
  const size = Math.max(1, Math.min(MAX_LAB_TEAM_SIZE, Math.round(args.teamSize) || 1));
  const field = args.entrants.filter((e) => !e.own);
  for (let i = 0; i < field.length; i += size) add(nextTeamName(names), field.slice(i, i + size).map((e) => e.key));
  return out;
}

// ── Simulate the field ───────────────────────────────────────────────────────────────────────

/** Seeded PRNG (mulberry32): the same seed hands out the same field, which the tests rely on. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimTile {
  id: number;
  position: number;
  parentTileId?: number | null;
  mission?: number | boolean | null;
  revealedAt?: string | null;
  closedAt?: string | null;
  /** First completion closes it to every other team (a bounty, or lockout / a one-claim mission). */
  lockout?: boolean;
  raceStep?: number | null;
  raceNext?: unknown;
}

export interface SimTeam {
  id: number;
  /** Participant ids a credit may name. */
  memberIds: number[];
  /** Tile ids the team already has. */
  done: number[];
}

export interface SimCredit {
  teamId: number;
  tileId: number;
  creditPlayerId: number | null;
  /** UTC 'YYYY-MM-DD HH:MM:SS', the completions column's own format. */
  completedAt: string;
}

export interface SimInput {
  race: boolean;
  /** The board's reveal policy is 'all' (every non-mission tile open from the start). */
  allVisible: boolean;
  tiles: SimTile[];
  teams: SimTeam[];
  seed: number;
  startMs: number;
  nowMs: number;
  /** 0–1: the most of the board any one team may get through in this run. */
  intensity: number;
}

const isMission = (t: SimTile) => t.mission === true || t.mission === 1;

/** Can a team score this tile now, as far as what is showing goes? */
export function simTileOpen(t: SimTile, allVisible: boolean): boolean {
  if (t.parentTileId != null) return false; // combo parts complete through their combo
  if (t.closedAt) return false;
  if (isMission(t)) return t.revealedAt != null;
  return allVisible || t.revealedAt != null;
}

/** UTC stamp in the completions column's format. */
export function dbStamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function parseNext(v: unknown): number[] {
  let raw = v;
  if (typeof v === 'string') {
    try {
      raw = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n)) : [];
}

/**
 * The race tiles a team may take next, given what it has done. Straight line: the first unfinished
 * tile in board order. Laid-out route (any tile has a step): walk the committed path from step 0 the
 * way lib/raceRoutes teamRoute does — at each step the finished tile linked from the one before — and
 * offer that tile's unfinished links (or every step-0 tile before the team has started).
 */
export function raceNextOptions(board: SimTile[], done: ReadonlySet<number>): number[] {
  const branching = board.some((t) => t.raceStep != null);
  if (!branching) {
    const next = [...board].sort((a, b) => a.position - b.position).find((t) => !done.has(t.id));
    return next ? [next.id] : [];
  }
  const placed = board.filter((t) => Number.isInteger(t.raceStep) && (t.raceStep as number) >= 0);
  const stepOf = new Map(placed.map((t) => [t.id, t.raceStep as number]));
  const nextOf = new Map(placed.map((t) => [t.id, parseNext(t.raceNext).filter((n) => stepOf.get(n) === (t.raceStep as number) + 1)]));
  const lastStep = Math.max(-1, ...stepOf.values());
  let options = placed.filter((t) => t.raceStep === 0).sort((a, b) => a.position - b.position).map((t) => t.id);
  let current: number | null = null;
  for (;;) {
    const finished = options.filter((id) => done.has(id));
    if (!finished.length) break;
    current = finished[0];
    options = nextOf.get(current) ?? [];
  }
  if (current != null && stepOf.get(current) === lastStep) return [];
  return options.filter((id) => !done.has(id));
}

/**
 * Random credits across the given teams over the tiles that are open, never against the board's
 * rules: a race only ever moves a team one step at a time down its own route, a lockout tile goes to
 * one team at most, and nothing hidden, closed or already done is credited. Each team gets its own
 * appetite (0 … intensity of what is open to it), so the standings spread from nothing to well
 * ahead. Times fall between the start and now, in order within a team.
 */
export function planSimulatedField(input: SimInput): SimCredit[] {
  const rand = seededRandom(input.seed);
  const intensity = Math.max(0, Math.min(1, input.intensity));
  const board = input.tiles.filter((t) => t.parentTileId == null && !isMission(t));
  const open = input.tiles.filter((t) => simTileOpen(t, input.allVisible));
  const lockout = new Set(input.tiles.filter((t) => t.lockout).map((t) => t.id));
  // A lockout tile anybody already holds is gone for everyone else.
  const taken = new Set<number>(input.teams.flatMap((tm) => tm.done.filter((id) => lockout.has(id))));
  const start = Math.min(input.startMs, input.nowMs);
  const span = Math.max(1, input.nowMs - start);
  const credits: SimCredit[] = [];

  for (const team of input.teams) {
    const done = new Set(team.done);
    const appetite = rand() * intensity;
    const picked: number[] = [];
    if (input.race) {
      const steps = Math.round(appetite * board.length);
      for (let s = 0; s < steps; s++) {
        const options = raceNextOptions(board, done).filter((id) => !(lockout.has(id) && taken.has(id)));
        if (!options.length) break;
        const id = options[Math.floor(rand() * options.length)];
        done.add(id);
        picked.push(id);
        if (lockout.has(id)) taken.add(id);
      }
      // Missions sit outside the route: they may still be taken alongside it.
    }
    // On a race only the missions are left for this pass; on any other board, every open tile.
    const pool = open.filter((t) => (!input.race || isMission(t)) && !done.has(t.id));
    const want = Math.round(appetite * pool.length);
    // Fisher–Yates over the pool, then take the first `want` that are still free.
    const order = pool.map((t) => t.id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let took = 0;
    for (const id of order) {
      if (took >= want) break;
      if (lockout.has(id) && taken.has(id)) continue;
      done.add(id);
      picked.push(id);
      took++;
      if (lockout.has(id)) taken.add(id);
    }
    // Times: sorted random instants, so the race order is also the order things were finished in.
    const times = picked.map(() => start + Math.floor(rand() * span)).sort((a, b) => a - b);
    picked.forEach((tileId, i) => {
      const who = team.memberIds.length ? team.memberIds[Math.floor(rand() * team.memberIds.length)] : null;
      credits.push({ teamId: team.id, tileId, creditPlayerId: who, completedAt: dbStamp(times[i]) });
    });
  }
  return credits;
}
