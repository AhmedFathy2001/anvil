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
//
// A tile on a reveal-policy event is member-visible iff tiles.revealedAt is set. The event-level
// tilesRevealed flag stays the master gate: while it's 0 nothing is visible and the engine does
// not run, so hosts still author privately and "arm" the board deliberately (or via start-now).
//
// Scoring modifiers (points-mode only; frozen into completions.awardedPoints at completion time):
//   firstBonus — extra points for the FIRST team to complete each tile.
//   decay      — a tile's points fall linearly from 100% at reveal to floorPct after `hours`.
//   lockout    — first completion locks the tile for every other team (works in tiles mode too;
//                affects gating, not weights).

export type RevealPolicy = 'all' | 'scheduled' | 'interval' | 'bounty';
export type RevealOrder = 'random' | 'sequential';

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
  /** 'interval' policy: tiles revealed per draw. */
  revealBatchSize: number;
  /** 'interval' / 'bounty': which hidden tile is drawn next. */
  revealOrder: RevealOrder;
  /** Extra points for the first team completing a tile. 0 = off. */
  firstBonus: number;
  /** Linear points decay after reveal, down to floorPct% after `hours`. Null = off. */
  decay: { floorPct: number; hours: number } | null;
  /** First completion locks the tile for all other teams. Implied by 'bounty'. */
  lockout: boolean;
  /** Team-formation steering from player profiles. Never blocks event start; 'off' = classic. */
  balanceMode: BalanceMode;
}

export const DEFAULT_EVENT_RULES: EventRules = {
  revealPolicy: 'all',
  revealIntervalMinutes: 60,
  revealBatchSize: 1,
  revealOrder: 'random',
  firstBonus: 0,
  decay: null,
  lockout: false,
  balanceMode: 'off',
};

const REVEAL_POLICIES: RevealPolicy[] = ['all', 'scheduled', 'interval', 'bounty'];
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
  const d = obj.decay as { floorPct?: unknown; hours?: unknown } | null | undefined;
  if (d && typeof d === 'object') {
    decay = {
      floorPct: clampInt(d.floorPct, 0, 100, 50),
      hours: clampInt(d.hours, 1, 720, 24),
    };
  }
  return {
    revealPolicy: policy,
    revealIntervalMinutes: clampInt(obj.revealIntervalMinutes, 5, 10080, 60),
    revealBatchSize: clampInt(obj.revealBatchSize, 1, 50, 1),
    revealOrder: obj.revealOrder === 'sequential' ? 'sequential' : 'random',
    firstBonus: clampInt(obj.firstBonus, 0, 100000, 0),
    decay,
    // Bounty is single-claim by definition — treat it as lockout everywhere.
    lockout: obj.lockout === true || policy === 'bounty',
    balanceMode: BALANCE_MODES.includes(obj.balanceMode as BalanceMode)
      ? (obj.balanceMode as BalanceMode)
      : 'off',
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
    return { error: "rules.revealPolicy must be 'all', 'scheduled', 'interval', or 'bounty'" };
  }
  if (o.revealOrder !== undefined && o.revealOrder !== 'random' && o.revealOrder !== 'sequential') {
    return { error: "rules.revealOrder must be 'random' or 'sequential'" };
  }
  for (const [key, min, max] of [
    ['revealIntervalMinutes', 5, 10080],
    ['revealBatchSize', 1, 50],
    ['firstBonus', 0, 100000],
  ] as const) {
    const v = o[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)) {
      return { error: `rules.${key} must be an integer between ${min} and ${max}` };
    }
  }
  if (o.decay !== undefined && o.decay !== null) {
    const d = o.decay as { floorPct?: unknown; hours?: unknown };
    if (
      typeof d !== 'object' ||
      typeof d.floorPct !== 'number' || !Number.isInteger(d.floorPct) || d.floorPct < 0 || d.floorPct > 100 ||
      typeof d.hours !== 'number' || !Number.isFinite(d.hours) || d.hours < 1 || d.hours > 720
    ) {
      return { error: 'rules.decay must be { floorPct: 0–100, hours: 1–720 } or null' };
    }
  }
  if (o.lockout !== undefined && typeof o.lockout !== 'boolean') {
    return { error: 'rules.lockout must be a boolean' };
  }
  if (o.balanceMode !== undefined && !BALANCE_MODES.includes(o.balanceMode as BalanceMode)) {
    return { error: "rules.balanceMode must be 'off', 'advisory', 'tiered-snake', 'dynamic-order', or 'auto'" };
  }
  // Canonicalise through the parser so what we store is exactly what reads produce.
  const canonical = parseEventRules(JSON.stringify(o));
  const isDefault =
    canonical.revealPolicy === 'all' &&
    canonical.firstBonus === 0 &&
    canonical.decay === null &&
    !canonical.lockout &&
    canonical.balanceMode === 'off';
  return { rules: isDefault ? null : JSON.stringify(canonical) };
}

/** True when the event reveals tiles per-tile (any policy other than classic 'all'). */
export function hasRevealPolicy(rules: EventRules): boolean {
  return rules.revealPolicy !== 'all';
}

type RevealStateTile = { revealAt?: string | null; revealedAt?: string | null; closedAt?: string | null };

/** Member-visibility of one tile. Classic events: always true (the event-level flag gates instead). */
export function isTileRevealed(rules: EventRules, tile: RevealStateTile): boolean {
  return !hasRevealPolicy(rules) || tile.revealedAt != null;
}

/** The member-visible subset of an event's tiles. Closed bounty tiles stay visible. */
export function visibleTiles<T extends RevealStateTile>(rules: EventRules, tiles: T[]): T[] {
  if (!hasRevealPolicy(rules)) return tiles;
  return tiles.filter((t) => t.revealedAt != null);
}

/** True when a tile can still accept completions under the rules (revealed and not claimed). */
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
  if (rules.revealPolicy === 'interval') {
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
  let pts = args.tilePoints ?? 0;
  if (rules.decay && args.tileRevealedAt) {
    const revealedMs = Date.parse(args.tileRevealedAt);
    const nowMs = args.nowMs ?? Date.now();
    if (Number.isFinite(revealedMs) && nowMs > revealedMs) {
      const frac = Math.min(1, (nowMs - revealedMs) / (rules.decay.hours * 3_600_000));
      const floor = rules.decay.floorPct / 100;
      pts = Math.max(0, Math.round(pts * (1 - (1 - floor) * frac)));
    }
  }
  if (args.isFirst && rules.firstBonus > 0) pts += rules.firstBonus;
  return pts;
}
