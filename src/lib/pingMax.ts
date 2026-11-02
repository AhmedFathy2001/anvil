import { COUNTER_TARGETS } from '@/lib/constants';

// How much ONE image-less plugin ping may credit on a counted tile.
//
// The plugin reports most credits as count-only pings and saves screenshots for proof milestones and
// the completing credit. A ping has no picture behind it, so its size is the one thing the server can
// sanity-check. Kills step by one, so the historic flat ceiling of 10 is far above a real burst — and a
// bigger ping is CLAMPED to 10 and flagged 'big_ping'.
//
// Some counters step by much more than one per real action: one Giants' Foundry sword is up to 199
// reputation, one Tithe Farm deposit up to ~35 points, one Wintertodt round up to ~28 reward rolls.
// A tile listing such a counter OPTS IN: its ceiling is the largest action among its targets, a ping up
// to that is taken as-is, and a ping above it still counts in full but is flagged 'over_action_max' for
// staff to confirm or undo. Nothing is clamped there — the chat line / var change IS the evidence, and
// a refused or shrunk ping would just be wrong.
//
// The SERVER is the authority: the submissions route derives the ceiling from the tile's own targets
// (never a client-sent value), and the plugin config ships the same number (`pingMax`) so the plugin
// knows when it can ping instead of uploading a screenshot.
//
// Pure (no db) — the route, the plugin config and the tests share it.

/** The flat ceiling every tile that hasn't opted in keeps (plain NPC kills, laps, PvP, LMS…). */
export const DEFAULT_PING_MAX = 10;
/** A ping above an opted-in tile's ceiling: counted in full, staff check it. */
export const OVER_ACTION_MAX_FLAG = 'over_action_max';
/** A ping above the flat ceiling on a tile that hasn't opted in: clamped, staff check it. */
export const BIG_PING_FLAG = 'big_ping';

const ACTION_MAX = new Map<string, number>(
  COUNTER_TARGETS.filter((c) => c.actionMax != null).map((c) => [c.name.toLowerCase(), c.actionMax!]),
);

/** The most one real action credits off this target name (1 for an NPC or a per-line counter). */
export function actionMax(target: string): number {
  return ACTION_MAX.get(target.trim().toLowerCase()) ?? 1;
}

/**
 * A counted tile's image-less ping ceiling, from the names it credits off — or null when none of them
 * steps by more than DEFAULT_PING_MAX (the tile keeps the flat clamp, today's behaviour).
 */
export function tilePingMax(targets: readonly string[] | null | undefined): number | null {
  let max = 0;
  for (const t of targets ?? []) if (typeof t === 'string') max = Math.max(max, actionMax(t));
  return max > DEFAULT_PING_MAX ? max : null;
}

export interface PingDecision {
  /** What the row is credited with. */
  amount: number;
  /** Flag for staff, or null. */
  flag: typeof OVER_ACTION_MAX_FLAG | typeof BIG_PING_FLAG | null;
}

/**
 * What an IMAGE-LESS ping of `amount` credits on a tile whose ceiling is `pingMax` (tilePingMax).
 * Up to the ceiling: as-is. Above it: opted-in tiles keep the full amount and flag it; the rest are
 * clamped to DEFAULT_PING_MAX and flagged, as always.
 */
export function decidePing(amount: number, pingMax: number | null): PingDecision {
  const ceiling = pingMax ?? DEFAULT_PING_MAX;
  if (amount <= ceiling) return { amount, flag: null };
  if (pingMax != null) return { amount, flag: OVER_ACTION_MAX_FLAG };
  return { amount: DEFAULT_PING_MAX, flag: BIG_PING_FLAG };
}
