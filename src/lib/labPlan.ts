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

import { applyRouteTemplate } from '@/lib/raceRoutes';
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
  tileType: string;
  requiredAmount: number;
  /** JSON array, per kind: kill/lap counters, PK victims, diary or CA selectors. */
  targetNpcs: string | null;
  /** JSON array of item ids (drop / clog tiles). */
  trackedItemIds: string | null;
  /** JSON array: a drop tile's "only from" sources. */
  sourceNpcs: string | null;
  timedActivity: string | null;
  timeThresholdSeconds: number | null;
  coopCredit: string | null;
  category: string;
}

export type LabTileSpec = Omit<LabTileSeed, 'position' | 'points' | 'revealAt'>;
const spec = (label: string, tileType: string, category: string, extra: Partial<LabTileSpec> = {}): LabTileSpec => ({
  label,
  tileType,
  category,
  requiredAmount: 1,
  targetNpcs: null,
  trackedItemIds: null,
  sourceNpcs: null,
  timedActivity: null,
  timeThresholdSeconds: null,
  coopCredit: null,
  ...extra,
});
const list = (...v: (string | number)[]) => JSON.stringify(v);

/**
 * Real tiles for a lab board — each one finished by a bundled lab scenario (the plugin's
 * `::anvil run <name>`, src/data/labScenarioTemplates.json), with names, counter names, item ids and
 * selectors taken from what that scenario actually produces (tests/lab-tiles-credit.test.ts runs
 * each one through the site's matcher). Order matters for a race: the first is the single start
 * (an easy opener) and the last the single finish (a raid to close it out); the rest fill the roads.
 *
 *   tile                      scenario (defaults unless noted)
 *   Wintertodt crate          wintertodt-game   — "Your subdued Wintertodt count is" → Wintertodt
 *   2 Araxxor kills           boss-kc           — "Your Araxxor kill count is" (run twice)
 *   Tanzanite fang            zulrah-unique     — loot item 12922 from Zulrah
 *   1m+ loot haul             loot-key          — a Bandos chestplate + 250k from a loot key
 *   Vorkath under 2:00        boss-pb           — "Fight duration: 1:36" on Vorkath
 *   PK Some Pker              pvp-kill          — victim "Some Pker"
 *   Hard Ardougne diary       diary-tier        — "all of the hard tasks in the Ardougne area"
 *   Whack-a-Mole (Elite CA)   ca-task           — "an Elite combat task: Whack-a-Mole"
 *   Fighter torso slot        clog-unlock       — "New item added to your collection log: Fighter torso"
 *   2 Seers' rooftop laps     agility-lap       — "Your Seers' Village Rooftop lap count is" (twice)
 *   Tombs of Amascut          toa-raid          — "Your completed Tombs of Amascut: Expert Mode count is"
 *   Robin Hood hat (hard clue) clue-casket      — casket loot item 2581 from "Clue Scroll (Hard)"
 *   Slayer task               slayer-task       — SLAYER_TASKS_COMPLETED +1 → "Slayer tasks: any master"
 *   2 Vorkath kills           boss-kc boss=Vorkath (twice)
 *   Theatre of Blood          tob-raid          — "Your completed Theatre of Blood count is"
 *   Hallowed Sepulchre run    sepulchre-run     — "You have opened the Grand Hallowed Coffin"
 *   2 Zulrah kills            zulrah-unique     — "Your Zulrah kill count is" (twice)
 *   Chambers of Xeric         cox-raid          — "Your completed Chambers of Xeric count is"
 */
export const LAB_TILE_SET: LabTileSpec[] = [
  spec('Wintertodt crate', 'kill', 'Skilling', { targetNpcs: list('Wintertodt') }),
  spec('2 Araxxor kills', 'kill', 'Bosses', { requiredAmount: 2, targetNpcs: list('Araxxor') }),
  spec('Tanzanite fang', 'drop', 'Bosses', { trackedItemIds: list(12922) }),
  spec('1m+ loot haul', 'value', 'Loot', { requiredAmount: 1_000_000 }),
  spec('Vorkath under 2:00', 'timed', 'Bosses', { timedActivity: 'Vorkath', timeThresholdSeconds: 120 }),
  spec('PK Some Pker', 'pvp', 'PvP', { targetNpcs: list('rsn:Some Pker') }),
  spec('Hard Ardougne diary', 'diary', 'Diaries', { targetNpcs: list('Ardougne Hard') }),
  spec('Whack-a-Mole (Elite CA)', 'ca', 'Combat achievements', { targetNpcs: list('Whack-a-Mole') }),
  spec('Fighter torso slot', 'clog', 'Collection log', { trackedItemIds: list(10551) }),
  spec("2 Seers' rooftop laps", 'lap', 'Agility', { requiredAmount: 2, targetNpcs: list("Seers' Village Rooftop") }),
  // The scenario's raid is Expert Mode, and the game names the mode in its count line.
  spec('Tombs of Amascut', 'kill', 'Raids', { targetNpcs: list('Tombs of Amascut', 'Tombs of Amascut: Expert Mode'), coopCredit: 'per-kill' }),
  // The casket's loot under "Clue Scroll (Hard)"; a "clue opens" kill tile on that name is credited too
  // (tests/lab-tiles-credit).
  spec('Robin Hood hat (hard clue)', 'drop', 'Clues', { trackedItemIds: list(2581), sourceNpcs: list('Clue Scroll (Hard)') }),
  spec('Slayer task', 'kill', 'Slayer', { targetNpcs: list('Slayer tasks: any master') }),
  spec('2 Vorkath kills', 'kill', 'Bosses', { requiredAmount: 2, targetNpcs: list('Vorkath') }),
  spec('Theatre of Blood', 'kill', 'Raids', { targetNpcs: list('Theatre of Blood'), coopCredit: 'per-kill' }),
  spec('Hallowed Sepulchre run', 'lap', 'Agility', { targetNpcs: list('Grand Hallowed Coffin') }),
  spec('2 Zulrah kills', 'kill', 'Bosses', { requiredAmount: 2, targetNpcs: list('Zulrah') }),
  spec('Chambers of Xeric', 'kill', 'Raids', { targetNpcs: list('Chambers of Xeric'), coopCredit: 'per-kill' }),
];

/**
 * The tiles a board of `count` gets, in board order: the set's opener first and its closer last
 * (a race's single start and single finish), the rest in between. A board bigger than the set takes
 * harder variants of the count tiles ("6 Araxxor kills") rather than the same tile twice.
 */
export function labTilePlan(count: number): LabTileSpec[] {
  if (count <= 0) return [];
  const opener = LAB_TILE_SET[0];
  const closer = LAB_TILE_SET[LAB_TILE_SET.length - 1];
  if (count === 1) return [closer];
  const middle = LAB_TILE_SET.slice(1, -1);
  const fill: LabTileSpec[] = [];
  for (let round = 0; fill.length < count - 2; round++) {
    for (const t of middle) {
      if (fill.length >= count - 2) break;
      if (round === 0) fill.push(t);
      else {
        // A harder copy: the counted tiles scale up, so no two tiles on a board read the same.
        const n = Math.max(1, t.requiredAmount) * (round + 1);
        fill.push({ ...t, requiredAmount: t.tileType === 'kill' || t.tileType === 'lap' ? n : t.requiredAmount, label: `${t.label} ×${round + 1}` });
      }
    }
  }
  return [opener, ...fill, closer];
}

/**
 * A real tile for one more mission on a board that already holds `usedLabels`: the first tile of
 * the plan not on the board, or once all are used a harder copy (labTilePlan's own ×2 rule).
 */
export function labMissionSpec(usedLabels: readonly string[]): LabTileSpec {
  const used = new Set(usedLabels);
  for (let n = LAB_TILE_SET.length; ; n += LAB_TILE_SET.length) {
    const hit = labTilePlan(n).find((t) => !used.has(t.label));
    if (hit) return hit;
  }
}

/** The tiles of a new session, in board order — real, creditable tiles (labTilePlan). */
export function labTileSeeds(fmt: LabFormat, size: number, startMs: number): LabTileSeed[] {
  const count = labTileCount(fmt, size);
  return labTilePlan(count).map((t, i) => ({
    ...t,
    position: i,
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
  { key: 'diamond', label: 'Diamond', help: 'One start tile splits into two roads that merge again at one finish tile.' },
  { key: 'lanes2', label: 'Two roads', help: 'One start, two side-by-side roads that never meet, one finish.' },
  { key: 'braid3', label: 'Braid', help: 'One start, three roads that can swap at every other step, one finish.' },
  { key: 'line', label: 'Straight line', help: 'One tile per step (no steps stored — the classic race).' },
];

export type RouteEntry = { id: number; step: number; next: number[] };

/**
 * Steps and links for a route template over these tile ids (board order) — the route editor's own
 * templates (lib/raceRoutes applyRouteTemplate), so a lab race is laid out exactly as a host's would
 * be. 'line' returns [] (store nothing: the classic straight race).
 */
export function labRouteLayout(kind: LabRouteTemplate, ids: number[]): RouteEntry[] {
  if (!ids.length || kind === 'line') return [];
  return applyRouteTemplate(kind, ids).map((e) => ({ id: e.id, step: e.step ?? 0, next: e.next }));
}

// ── Who plays for whom ───────────────────────────────────────────────────────────────────────

/**
 * Most test players one session may be filled with: a big creator event, previewed. ONE constant —
 * raise it here and the API, the pickers and the name scheme (fieldPlayerName) all follow. The fill
 * and the simulation are bulk writes in chunks (lib/labField), so the size costs rows, not round trips.
 */
export const MAX_LAB_FIELD = 1000;
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

/**
 * The n-th field player's name (1-based), as lib/labCast's testUserName takes it. A test-user name
 * body holds at most 8 characters, so "Field1"…"Field999" (the names every earlier session made, and
 * so the rows reused), then "F1000"… which fits up to F9999999 — far past any cap.
 */
export function fieldPlayerName(n: number): string {
  return n < 1000 ? `Field${n}` : `F${n}`;
}

/** The first `count` field players (lib/labCast makes them Lab~Field1…, Lab~F1000…). */
export function fieldPlayerNames(count: number): string[] {
  const n = Math.max(0, Math.min(MAX_LAB_FIELD, Math.round(count)));
  return Array.from({ length: n }, (_, i) => fieldPlayerName(i + 1));
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
