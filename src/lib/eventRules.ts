// Per-event game rules — the third axis on top of (format, scoringMode). Stored as JSON in
// `events.rules` (NULL = classic behaviour). Rules decide HOW tiles become playable (the reveal
// policy) and how points are awarded per completion (first-team bonus, reveal decay, lockout).
//
// Reveal policies:
//   'all'       — classic: every tile is visible once the event-level tilesRevealed flag flips.
//   'scheduled' — tiles carry a per-tile revealAt time (Tiles tab); the reveal engine flips each
//                 one live as its time passes. DMM All Stars-style "tile of the hour" boards.
//   'interval'  — the engine draws revealBatchSize hidden tiles every revealIntervalMinutes
//                 (random or in position order), starting at event start. "Bingo caller" boards.
//   'bounty'    — exactly one tile is open at a time; the first team to complete it claims it
//                 (tile closes) and the next tile is drawn immediately.
//   'rotating'  — a rolling WINDOW of revealWindowSize open tiles: each interval draw opens new
//                 random tiles and EXPIRES (closes) the oldest so the window stays that size.
//                 Unlike bounty, an open tile can be completed by many players before it expires
//                 (individual ladders). "Rotating tasks" boards.
//
// A tile on a reveal-policy event is member-visible iff tiles.revealedAt is set. The event-level
// tilesRevealed flag stays the master gate: while it's 0 nothing is visible and the engine does
// not run, so hosts still author privately and "arm" the board deliberately (or via start-now).
//
// Scoring modifiers (points-mode only; frozen into completions.awardedPoints at completion time):
//   firstBonus — extra points for the FIRST team to complete each tile.
//   decay      — a tile's points scale linearly from 100% at reveal to `targetPct%` after `hours`,
//                then hold. targetPct < 100 DECAYS (rewards racing; 0 = down to nothing), targetPct
//                > 100 GROWS (rewards patience / clearing older tasks). Independent of expiry — pair
//                with the 'rotating' reveal policy to also close the task, or leave it open.
//   lockout    — first completion locks the tile for every other team (works in tiles mode too;
//                affects gating, not weights).

export type RevealPolicy = 'all' | 'scheduled' | 'interval' | 'bounty' | 'rotating';
export type RevealOrder = 'random' | 'sequential';

// MISSIONS — a subset of a bingo's tiles authored up front but HIDDEN, announced mid-event from
// their own pool (independent of the board's revealPolicy). How/when they drop is the event-level
// `rules.mission` announce policy below; each mission's SCORING (lockout/firstBonus/decay/expiry)
// lives per-tile in `tiles.rules` (see MissionRules). Announcing a mission stamps its `revealedAt`
// (the decay anchor); the board's normal tiles stay visible throughout.
export type MissionAnnounceMode = 'manual' | 'interval' | 'scheduled';
export interface MissionConfig {
  /** manual = admin drops each; interval = every intervalMinutes; scheduled = per-tile revealAt. */
  announceMode: MissionAnnounceMode;
  /** Which hidden mission is drawn next (random, or by board position). */
  order: RevealOrder;
  /** 'interval' mode: minutes between mission drops. */
  intervalMinutes: number;
}

// How much the player-profile engine steers team formation (balance-engine plan, Part C).
// 'off' = current behaviour. 'advisory' = staff see strength bars / badges, nothing enforced.
// 'tiered-snake' = the draft blocks stacking top-tier players while another team has none.
// 'dynamic-order' = the weakest projected team picks next each round instead of fixed serpentine.
// 'auto' = teams are built by the greedy balancer ("Balance teams" button); the draft is skipped.
export type BalanceMode = 'off' | 'advisory' | 'tiered-snake' | 'dynamic-order' | 'auto';

export interface EventRules {
  revealPolicy: RevealPolicy;
  /** 'interval' policy: minutes between draws. */
  revealIntervalMinutes: number;
  /** 'interval' / 'rotating' policy: tiles revealed per draw. */
  revealBatchSize: number;
  /** 'rotating' policy: how many tiles stay open at once (older ones expire as new ones draw). */
  revealWindowSize: number;
  /** 'interval' / 'bounty' / 'rotating': which hidden tile is drawn next. */
  revealOrder: RevealOrder;
  /** Extra points for the first team completing a tile. 0 = off. */
  firstBonus: number;
  /** Linear points scaling after reveal: from 100% to `targetPct%` over `hours`, then held. < 100
   *  decays (0 = to nothing), > 100 grows. `floorPct` is the legacy key (still parsed). Null = off. */
  decay: { targetPct: number; hours: number } | null;
  /** First completion locks the tile for all other teams. Implied by 'bounty'. */
  lockout: boolean;
  /** Team-formation steering from player profiles. Never blocks event start; 'off' = classic. */
  balanceMode: BalanceMode;
  /** Mission announce policy (how/when hidden mission tiles drop). Null = no missions on this event. */
  mission: MissionConfig | null;
}

export const DEFAULT_EVENT_RULES: EventRules = {
  revealPolicy: 'all',
  revealIntervalMinutes: 60,
  revealBatchSize: 1,
  revealWindowSize: 3,
  revealOrder: 'random',
  firstBonus: 0,
  decay: null,
  lockout: false,
  balanceMode: 'off',
  mission: null,
};

const REVEAL_POLICIES: RevealPolicy[] = ['all', 'scheduled', 'interval', 'bounty', 'rotating'];
const MISSION_ANNOUNCE_MODES: MissionAnnounceMode[] = ['manual', 'interval', 'scheduled'];
const BALANCE_MODES: BalanceMode[] = ['off', 'advisory', 'tiered-snake', 'dynamic-order', 'auto'];

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  return Number.isNaN(n) ? fallback : Math.max(min, Math.min(max, n));
};

/** Tolerant parse of the stored `events.rules` JSON. Anything missing/malformed → defaults. */
export function parseEventRules(raw: string | null | undefined): EventRules {
  if (!raw) return DEFAULT_EVENT_RULES;
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_EVENT_RULES;
    obj = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_EVENT_RULES;
  }
  const policy = REVEAL_POLICIES.includes(obj.revealPolicy as RevealPolicy)
    ? (obj.revealPolicy as RevealPolicy)
    : 'all';
  let decay: EventRules['decay'] = null;
  const d = obj.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown } | null | undefined;
  if (d && typeof d === 'object') {
    decay = {
      // Accept the legacy `floorPct` key. Target may exceed 100 for growth (cap 1000% = 10×).
      targetPct: clampInt(d.targetPct ?? d.floorPct, 0, 1000, 50),
      hours: clampInt(d.hours, 1, 720, 24),
    };
  }
  let mission: EventRules['mission'] = null;
  const m = obj.mission as { announceMode?: unknown; order?: unknown; intervalMinutes?: unknown } | null | undefined;
  if (m && typeof m === 'object') {
    mission = {
      announceMode: MISSION_ANNOUNCE_MODES.includes(m.announceMode as MissionAnnounceMode)
        ? (m.announceMode as MissionAnnounceMode)
        : 'manual',
      order: m.order === 'sequential' ? 'sequential' : 'random',
      intervalMinutes: clampInt(m.intervalMinutes, 5, 10080, 60),
    };
  }
  return {
    revealPolicy: policy,
    revealIntervalMinutes: clampInt(obj.revealIntervalMinutes, 5, 10080, 60),
    revealBatchSize: clampInt(obj.revealBatchSize, 1, 50, 1),
    revealWindowSize: clampInt(obj.revealWindowSize, 1, 50, 3),
    revealOrder: obj.revealOrder === 'sequential' ? 'sequential' : 'random',
    firstBonus: clampInt(obj.firstBonus, 0, 100000, 0),
    decay,
    // Bounty is single-claim by definition — treat it as lockout everywhere.
    lockout: obj.lockout === true || policy === 'bounty',
    balanceMode: BALANCE_MODES.includes(obj.balanceMode as BalanceMode)
      ? (obj.balanceMode as BalanceMode)
      : 'off',
    mission,
  };
}

/**
 * Validate an API-supplied rules object and return the canonical JSON to store, or an error.
 * Returns `{ rules: null }` when everything is at its default — store NULL, not '{}', so classic
 * events keep a NULL column and old code paths stay bit-identical.
 */
export function validateEventRules(input: unknown): { rules: string | null } | { error: string } {
  if (input == null) return { rules: null };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'rules must be an object' };
  }
  const o = input as Record<string, unknown>;
  if (o.revealPolicy !== undefined && !REVEAL_POLICIES.includes(o.revealPolicy as RevealPolicy)) {
    return { error: "rules.revealPolicy must be 'all', 'scheduled', 'interval', 'bounty', or 'rotating'" };
  }
  if (o.revealOrder !== undefined && o.revealOrder !== 'random' && o.revealOrder !== 'sequential') {
    return { error: "rules.revealOrder must be 'random' or 'sequential'" };
  }
  for (const [key, min, max] of [
    ['revealIntervalMinutes', 5, 10080],
    ['revealBatchSize', 1, 50],
    ['revealWindowSize', 1, 50],
    ['firstBonus', 0, 100000],
  ] as const) {
    const v = o[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)) {
      return { error: `rules.${key} must be an integer between ${min} and ${max}` };
    }
  }
  if (o.decay !== undefined && o.decay !== null) {
    const d = o.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown };
    const t = d.targetPct ?? d.floorPct; // legacy key accepted
    if (
      typeof d !== 'object' ||
      typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t > 1000 ||
      typeof d.hours !== 'number' || !Number.isFinite(d.hours) || d.hours < 1 || d.hours > 720
    ) {
      return { error: 'rules.decay must be { targetPct: 0–1000, hours: 1–720 } or null' };
    }
  }
  if (o.lockout !== undefined && typeof o.lockout !== 'boolean') {
    return { error: 'rules.lockout must be a boolean' };
  }
  if (o.balanceMode !== undefined && !BALANCE_MODES.includes(o.balanceMode as BalanceMode)) {
    return { error: "rules.balanceMode must be 'off', 'advisory', 'tiered-snake', 'dynamic-order', or 'auto'" };
  }
  if (o.mission !== undefined && o.mission !== null) {
    const m = o.mission as { announceMode?: unknown; order?: unknown; intervalMinutes?: unknown };
    if (typeof m !== 'object' || Array.isArray(m)) {
      return { error: 'rules.mission must be an object or null' };
    }
    if (m.announceMode !== undefined && !MISSION_ANNOUNCE_MODES.includes(m.announceMode as MissionAnnounceMode)) {
      return { error: "rules.mission.announceMode must be 'manual', 'interval', or 'scheduled'" };
    }
    if (m.order !== undefined && m.order !== 'random' && m.order !== 'sequential') {
      return { error: "rules.mission.order must be 'random' or 'sequential'" };
    }
    const iv = m.intervalMinutes;
    if (iv !== undefined && (typeof iv !== 'number' || !Number.isInteger(iv) || iv < 5 || iv > 10080)) {
      return { error: 'rules.mission.intervalMinutes must be an integer between 5 and 10080' };
    }
  }
  // Canonicalise through the parser so what we store is exactly what reads produce.
  const canonical = parseEventRules(JSON.stringify(o));
  const isDefault =
    canonical.revealPolicy === 'all' &&
    canonical.firstBonus === 0 &&
    canonical.decay === null &&
    !canonical.lockout &&
    canonical.balanceMode === 'off' &&
    canonical.mission === null;
  return { rules: isDefault ? null : JSON.stringify(canonical) };
}

/** True when the event reveals tiles per-tile (any policy other than classic 'all'). */
export function hasRevealPolicy(rules: EventRules): boolean {
  return rules.revealPolicy !== 'all';
}

/** True when this event has a mission announce policy configured. */
export function hasMissions(rules: EventRules): boolean {
  return rules.mission != null;
}

type RevealStateTile = {
  revealAt?: string | null;
  revealedAt?: string | null;
  closedAt?: string | null;
  mission?: boolean | number | null;
};

/** A mission tile (hidden until announced), across the DB int (0/1) and boolean shapes. */
export function isMissionTile(tile: { mission?: boolean | number | null }): boolean {
  return tile.mission === true || tile.mission === 1;
}

/**
 * Member-visibility of one tile. A MISSION tile is visible only once announced (`revealedAt` set),
 * regardless of the board's policy — so a classic bingo can hide missions while its normal tiles show.
 * A non-mission tile follows the board: always visible on classic, else visible once revealed.
 */
export function isTileRevealed(rules: EventRules, tile: RevealStateTile): boolean {
  if (isMissionTile(tile)) return tile.revealedAt != null;
  return !hasRevealPolicy(rules) || tile.revealedAt != null;
}

/**
 * The BOARD: the tiles an event is actually scored on, missions excluded.
 *
 * A mission is not a board tile that happens to be hidden — it's a separate kind of thing. It drops
 * mid-event from its own pool, carries its own scoring (lockout, first-clear bonus, decay), can
 * expire unclaimed, and is a bonus on top of the board rather than part of it. Counting one toward
 * "14 / 25 tiles" or "116 pts on the board" moves the denominator under everyone the moment it's
 * announced, and quietly changes what a completion percentage means mid-event.
 *
 * So every board total, progress bar and tile count runs through this; missions are surfaced and
 * scored on their own.
 */
export function boardTiles<T extends { mission?: boolean | number | null }>(tiles: T[]): T[] {
  return tiles.filter((t) => !isMissionTile(t));
}

/** The mission subset — the other half of {@link boardTiles}. */
export function missionTiles<T extends { mission?: boolean | number | null }>(tiles: T[]): T[] {
  return tiles.filter(isMissionTile);
}

/** The member-visible subset of an event's tiles. Closed (claimed/expired) tiles stay visible. */
export function visibleTiles<T extends RevealStateTile>(rules: EventRules, tiles: T[]): T[] {
  // Fast path: classic board with no mission tiles → everything is visible (bit-identical to before).
  if (!hasRevealPolicy(rules) && !tiles.some(isMissionTile)) return tiles;
  return tiles.filter((t) => isTileRevealed(rules, t));
}

/** True when a tile can still accept completions under the rules (revealed and not claimed/expired). */
export function isTileOpen(rules: EventRules, tile: RevealStateTile): boolean {
  if (!isTileRevealed(rules, tile)) return false;
  return tile.closedAt == null;
}

/**
 * When the next tile(s) will appear, for countdowns. Null when nothing further is scheduled
 * (no hidden tiles left, bounty policy — where the next draw is completion-driven — or classic).
 */
export function nextRevealAt(
  event: { startDate: string | null; rules?: string | null },
  rules: EventRules,
  tiles: RevealStateTile[],
  nowMs: number = Date.now(),
): string | null {
  if (!hasRevealPolicy(rules)) return null;
  const hidden = tiles.filter((t) => t.revealedAt == null);
  if (hidden.length === 0) return null;
  if (rules.revealPolicy === 'scheduled') {
    const planned = hidden
      .map((t) => t.revealAt)
      .filter((v): v is string => !!v)
      .sort();
    return planned[0] ?? null;
  }
  if (rules.revealPolicy === 'interval' || rules.revealPolicy === 'rotating') {
    const lastRevealed = tiles
      .map((t) => t.revealedAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    const anchor = lastRevealed ?? event.startDate;
    if (!anchor) return null;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) return null;
    const stepMs = rules.revealIntervalMinutes * 60_000;
    // First draw fires AT start; afterwards one interval after the previous draw. If we're
    // somehow past due (engine lag), show now-ish rather than a time in the past.
    const next = lastRevealed ? anchorMs + stepMs : anchorMs;
    return new Date(Math.max(next, nowMs)).toISOString();
  }
  return null; // bounty: next draw fires on completion, not on a clock
}

/**
 * When each currently-open tile will ROTATE OUT, on a 'rotating' board.
 *
 * The window holds `revealWindowSize` tiles: every draw opens `revealBatchSize` new ones and closes
 * the same number of oldest ones to make room. So the oldest open tile expires at the next draw,
 * the next-oldest one draw later, and so on — which means a member can be told how long a task has
 * left without the engine having to write an expiry column it would then have to keep in sync.
 *
 * Empty for every other policy: a lucky-draw tile stays open forever, a bounty closes on a claim,
 * and a scheduled board doesn't take anything away.
 */
export function rotationExpiries(
  rules: EventRules,
  openTiles: { id: number; revealedAt?: string | null }[],
  nextRevealAt: string | null,
): Map<number, string> {
  const out = new Map<number, string>();
  if (rules.revealPolicy !== 'rotating' || !nextRevealAt) return out;
  const nextMs = Date.parse(nextRevealAt);
  if (!Number.isFinite(nextMs)) return out;
  const stepMs = rules.revealIntervalMinutes * 60_000;
  const batch = Math.max(1, rules.revealBatchSize);
  const oldestFirst = [...openTiles]
    .filter((t) => !!t.revealedAt)
    .sort((a, b) => (a.revealedAt! < b.revealedAt! ? -1 : a.revealedAt! > b.revealedAt! ? 1 : a.id - b.id));
  oldestFirst.forEach((t, i) => {
    out.set(t.id, new Date(nextMs + Math.floor(i / batch) * stepMs).toISOString());
  });
  return out;
}

/**
 * When the next MISSION drops, for the in-game countdown. Mirrors {@link nextRevealAt} but over the
 * mission pool + `rules.mission` announce policy: scheduled → earliest hidden mission's revealAt;
 * interval → one interval after the last announced mission (or event start); manual/none → null.
 */
export function nextMissionAt(
  event: { startDate?: string | null },
  rules: EventRules,
  tiles: RevealStateTile[],
  nowMs: number = Date.now(),
): string | null {
  const cfg = rules.mission;
  if (!cfg) return null;
  const missionTiles = tiles.filter(isMissionTile);
  const hidden = missionTiles.filter((t) => t.revealedAt == null);
  if (hidden.length === 0) return null;
  if (cfg.announceMode === 'scheduled') {
    const earliest = hidden.map((t) => t.revealAt).filter((v): v is string => !!v).sort()[0];
    if (!earliest) return null;
    const at = Date.parse(earliest);
    return Number.isFinite(at) ? new Date(Math.max(at, nowMs)).toISOString() : null;
  }
  if (cfg.announceMode === 'interval') {
    const lastAnnounced = missionTiles
      .map((t) => t.revealedAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    const anchor = lastAnnounced ?? event.startDate;
    if (!anchor) return null;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) return null;
    const next = lastAnnounced ? anchorMs + cfg.intervalMinutes * 60_000 : anchorMs;
    return new Date(Math.max(next, nowMs)).toISOString();
  }
  return null; // manual
}

/**
 * Points actually earned by a completion, or null when nothing rule-driven applies (classic
 * points/tiles events stay on live tile weights). Frozen into completions.awardedPoints.
 */
export function completionAward(args: {
  scoringMode: string | null | undefined;
  rules: EventRules;
  tilePoints: number | null | undefined;
  tileRevealedAt: string | null | undefined;
  isFirst: boolean;
  nowMs?: number;
}): number | null {
  if (args.scoringMode !== 'points') return null;
  const { rules } = args;
  if (rules.firstBonus <= 0 && rules.decay == null) return null;
  let pts = decayedPoints(args.tilePoints, args.tileRevealedAt, rules.decay, args.nowMs);
  if (args.isFirst && rules.firstBonus > 0) pts += rules.firstBonus;
  return pts;
}

/**
 * What a tile is worth RIGHT NOW under a decay/growth ramp — linear from 100% at reveal to
 * `targetPct%` after `hours`, then held.
 *
 * Split out of {@link completionAward} because the board shows this number live, ticking, while a
 * task is open. Anything that displays a value has to compute it the same way the award does, or
 * the site advertises a number it won't pay out.
 */
export function decayedPoints(
  points: number | null | undefined,
  revealedAt: string | null | undefined,
  decay: EventRules['decay'],
  nowMs?: number,
): number {
  const base = points ?? 0;
  if (!decay || !revealedAt) return base;
  const revealedMs = Date.parse(revealedAt);
  const now = nowMs ?? Date.now();
  if (!Number.isFinite(revealedMs) || now <= revealedMs) return base;
  const frac = Math.min(1, (now - revealedMs) / (decay.hours * 3_600_000));
  const target = decay.targetPct / 100; // < 1 decays toward it, > 1 grows toward it
  return Math.max(0, Math.round(base * (1 - (1 - target) * frac)));
}

/** How far through its decay/growth ramp a tile is, 0–1. 0 when nothing ramps. */
export function decayProgress(
  revealedAt: string | null | undefined,
  decay: EventRules['decay'],
  nowMs?: number,
): number {
  if (!decay || !revealedAt) return 0;
  const revealedMs = Date.parse(revealedAt);
  const now = nowMs ?? Date.now();
  if (!Number.isFinite(revealedMs) || now <= revealedMs) return 0;
  return Math.min(1, (now - revealedMs) / (decay.hours * 3_600_000));
}

// ---- Per-mission scoring (tiles.rules) --------------------------------------------------------
// Each mission tile carries its own lockout / first-clear bonus / decay-or-grow / auto-expiry. These
// are the SAME modifiers as the event-level rules, but scoped to one mission and merged over the event
// rules in the completion gate. Decay + firstBonus only bite in a points-scoring event (completionAward
// gates on scoringMode); lockout works anywhere. `expiryHours` auto-closes an unclaimed mission.
export interface MissionRules {
  lockout: boolean;
  firstBonus: number;
  decay: { targetPct: number; hours: number } | null;
  /** Hours after announce a mission auto-closes if unclaimed. Null = never (open till claimed/end). */
  expiryHours: number | null;
}

export const DEFAULT_MISSION_RULES: MissionRules = { lockout: false, firstBonus: 0, decay: null, expiryHours: null };

/** Tolerant parse of a tile's `rules` JSON. Anything missing/malformed → the no-modifier default. */
export function parseTileMissionRules(raw: string | null | undefined): MissionRules {
  if (!raw) return DEFAULT_MISSION_RULES;
  let o: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_MISSION_RULES;
    o = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_MISSION_RULES;
  }
  let decay: MissionRules['decay'] = null;
  const d = o.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown } | null | undefined;
  if (d && typeof d === 'object') {
    decay = { targetPct: clampInt(d.targetPct ?? d.floorPct, 0, 1000, 50), hours: clampInt(d.hours, 1, 720, 24) };
  }
  return {
    lockout: o.lockout === true,
    firstBonus: clampInt(o.firstBonus, 0, 100000, 0),
    decay,
    expiryHours: o.expiryHours == null ? null : clampInt(o.expiryHours, 1, 8760, 24),
  };
}

/**
 * Canonical JSON for a tile's mission rules, or null when everything is at its default (store NULL so
 * a non-mission tile keeps a NULL `rules` column). Used by the tile-edit API + CSV import.
 */
export function serializeTileMissionRules(input: Partial<MissionRules> | null | undefined): string | null {
  if (!input) return null;
  const m = parseTileMissionRules(JSON.stringify(input));
  const isDefault = !m.lockout && m.firstBonus === 0 && m.decay === null && m.expiryHours === null;
  return isDefault ? null : JSON.stringify(m);
}
