// Tile controls on a lab board — the pure half (no database, so tests run without one).
//
// Staff on /staff/lab/<id> can complete, clear, or set the progress of any tile for any team. Each
// tile kind keeps its progress somewhere different, and this file is the one place that says where:
//
//   stat      KC / XP / hiscores-activity tiles (trackedStat + statType + statGoal): each member's
//             gain, read off their baseline (statsSnapshot) and reading (frozenStats — the lab's
//             stat simulator pins it, lib/labStats). Progress N = the chosen member's gain is N.
//   count     kill / lap / pvp / gain / deathless / diary / ca / lms / valuetotal / plain drop pools /
//             Barracuda Trials rank runs: submissions whose amounts sum (lib/countProgress).
//   distinct  a drop pool that counts only DIFFERENT items: one submission per distinct item.
//   slots     a collection-log "new slots" tile: one submission per distinct (member, item).
//   best      a loot-value tile: the single biggest haul (a submission's amount, in gp).
//   fastest   a timed tile with a cap: the fastest run (a submission's durationSeconds).
//
// Everything else — standard (manual) tiles, collections of named items, whole clog pages, combos —
// has no number to set. Those can still be completed and cleared.

import { parseTrialRankTile } from '@/lib/barracudaTrials';
import { clogTileItemIds, clogTileSpec } from '@/lib/clogTiles';
import { HISCORES_ACTIVITIES } from '@/lib/hiscoresActivities';
import { SKILLS } from '@/lib/constants';
import { parseCapBy } from '@/lib/tileCaps';
import { parseJsonArray } from '@/lib/tileKinds';

export type ProgressStore = 'stat' | 'count' | 'distinct' | 'slots' | 'best' | 'fastest';

/** The tile columns these rules read. */
export interface ControlTile {
  id: number;
  tileType: string | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  requiredAmount: number | null;
  itemRequirements: string | null;
  trackedItemIds: string | null;
  targetNpcs: string | null;
  countMode: string | null;
  timedActivity: string | null;
  timeThresholdSeconds: number | null;
  capBy?: string | null;
}

/** Kinds whose submissions simply add up toward requiredAmount (lib/submissions syncDropTileCompletion). */
const COUNT_KINDS = new Set(['kill', 'lap', 'pvp', 'gain', 'deathless', 'diary', 'ca', 'lms', 'valuetotal']);

function hasCollection(tile: ControlTile): boolean {
  return parseJsonArray<unknown>(tile.itemRequirements).length > 0;
}

/** Where this tile keeps its progress, or null when it has no number to set. Mirrors lib/submissions. */
export function progressStore(tile: ControlTile): ProgressStore | null {
  if (tile.trackedStat && tile.statType && tile.statGoal) return 'stat';
  // A collection is keyed on itemRequirements whatever its tileType says (lib/submissions does the same).
  if (hasCollection(tile)) return null;
  const type = tile.tileType ?? 'standard';
  if (type === 'clog') return clogTileSpec(tile).mode === 'complete' ? null : 'slots';
  if (type === 'timed') {
    if (parseTrialRankTile(tile.timedActivity) != null) return 'count';
    return tile.timeThresholdSeconds != null ? 'fastest' : null;
  }
  if (!tile.requiredAmount) return null;
  if (type === 'value') return 'best';
  if (COUNT_KINDS.has(type)) return 'count';
  if (type === 'drop') return tile.countMode === 'distinct' ? 'distinct' : 'count';
  return null;
}

/** The number progress is measured against, for the store progressStore picked. */
export function progressGoal(tile: ControlTile, store: ProgressStore | null): number | null {
  switch (store) {
    case 'stat':
      return tile.statGoal;
    case 'slots':
      return clogTileSpec(tile).required;
    case 'fastest':
      return tile.timeThresholdSeconds;
    case 'count':
      // Trial-rank runs default to one, like lib/submissions.
      return tile.tileType === 'timed' ? Math.max(1, tile.requiredAmount ?? 1) : tile.requiredAmount;
    case 'best':
    case 'distinct':
      return tile.requiredAmount;
    default:
      return null;
  }
}

/** Does progress `n` finish the tile? A timed tile finishes at or UNDER its cap; everything else at or over. */
export function reachesGoal(store: ProgressStore, n: number, goal: number | null): boolean {
  if (goal == null) return false;
  if (store === 'fastest') return n > 0 && n <= goal;
  return n >= goal;
}

/** Most rows one "set progress" may write for a one-row-per-item store. */
export const MAX_ITEM_ROWS = 500;
/** Largest number a submission amount (int4) or a reading may hold. */
export const MAX_PROGRESS = 2_000_000_000;

export const LAB_PROGRESS_NOTE = 'Lab: progress set by staff';

export interface ProgressRow {
  amount: number;
  itemId: number | null;
  durationSeconds: number | null;
  /** A cap counter's credit (lib/tileCaps), or null for the tile's own count. */
  goal: string | null;
}

/** Item ids a one-per-item store draws from: the tile's own items first, then made-up negative ids. */
function itemPool(tile: ControlTile, store: 'distinct' | 'slots', n: number): number[] {
  const own = store === 'slots'
    ? [...(clogTileItemIds(clogTileSpec(tile)) ?? [])]
    : parseJsonArray<number>(tile.trackedItemIds).map(Number).filter((id) => Number.isInteger(id));
  const ids = [...new Set(own)].slice(0, n);
  // Counting never checks the item against the tile (lib/countProgress), only that it is different,
  // so ids nobody owns make up the rest without colliding with a real one.
  for (let k = 1; ids.length < n; k++) ids.push(-k);
  return ids;
}

/**
 * The submissions that put this team's progress on the tile at exactly `n`, all credited to one
 * member. The caller deletes the team's old rows on the tile first. A capped counter tile (lib/tileCaps)
 * also gets each cap counter at `n`, so the cap never holds the count below what was asked.
 */
export function progressRows(tile: ControlTile, store: ProgressStore, n: number): ProgressRow[] {
  if (store === 'stat' || n <= 0) return [];
  const row = (amount: number, extra: Partial<ProgressRow> = {}): ProgressRow => ({ amount, itemId: null, durationSeconds: null, goal: null, ...extra });
  switch (store) {
    case 'distinct':
    case 'slots':
      return itemPool(tile, store, Math.min(n, MAX_ITEM_ROWS)).map((itemId) => row(1, { itemId }));
    case 'fastest':
      return [row(1, { durationSeconds: n })];
    case 'best':
      return [row(n)];
    case 'count':
      return [row(n), ...parseCapBy(tile.capBy).map((_, i) => row(n, { goal: `cap:${i}` }))];
  }
}

/** What a "set progress" request may ask for on this store: a whole number in range. */
export function clampProgress(store: ProgressStore, n: number): number {
  const cap = store === 'distinct' || store === 'slots' ? MAX_ITEM_ROWS : MAX_PROGRESS;
  return Math.min(Math.max(0, Math.round(n)), cap);
}

// ── Stat readings ────────────────────────────────────────────────────────────────────────────

export type Snapshot = Record<string, unknown> & {
  skills?: Record<string, { xp?: number; level?: number; rank?: number }>;
  bosses?: Record<string, { score?: number; rank?: number }>;
};

/** Write one key's value into a snapshot, in the shape lib/statTracking snapshotValue reads back. */
export function setStatValue(snap: Snapshot, statType: string, key: string, value: number): Snapshot {
  const v = Math.max(0, Math.round(value));
  if (statType === 'skill') {
    snap.skills = { ...(snap.skills ?? {}), [key]: { ...(snap.skills?.[key] ?? {}), xp: v } };
    return snap;
  }
  const activity = HISCORES_ACTIVITIES.find((a) => a.key === key);
  if (activity) {
    let node = snap as Record<string, unknown>;
    for (const step of activity.path.slice(0, -1)) {
      node[step] = { ...((node[step] as object) ?? {}) };
      node = node[step] as Record<string, unknown>;
    }
    const last = activity.path[activity.path.length - 1];
    node[last] = { ...((node[last] as object) ?? {}), score: v };
    return snap;
  }
  snap.bosses = { ...(snap.bosses ?? {}), [key]: { ...(snap.bosses?.[key] ?? {}), score: v } };
  return snap;
}

/** Read one key back out of a snapshot (0 when absent), the way setStatValue wrote it. */
export function readStatValue(snap: Snapshot, statType: string, key: string): number {
  if (statType === 'skill') return Math.max(0, snap.skills?.[key]?.xp ?? 0);
  const activity = HISCORES_ACTIVITIES.find((a) => a.key === key);
  if (activity) {
    let node: unknown = snap;
    for (const step of activity.path) node = (node as Record<string, unknown> | undefined)?.[step];
    return Math.max(0, Number((node as { score?: number } | undefined)?.score ?? 0) || 0);
  }
  return Math.max(0, snap.bosses?.[key]?.score ?? 0);
}

/** Does the snapshot hold a value for this key at all (as opposed to reading 0 for a missing one)? */
export function hasStatValue(snap: Snapshot, statType: string, key: string): boolean {
  if (statType === 'skill') return snap.skills?.[key]?.xp != null;
  const activity = HISCORES_ACTIVITIES.find((a) => a.key === key);
  if (activity) {
    let node: unknown = snap;
    for (const step of activity.path) node = (node as Record<string, unknown> | undefined)?.[step];
    return (node as { score?: number } | undefined)?.score != null;
  }
  return snap.bosses?.[key]?.score != null;
}

/** The statType a pushed key is stored under: a skill name, or a boss / activity key. */
export function statTypeOfKey(key: string): 'skill' | 'boss' {
  return (SKILLS as readonly string[]).includes(key) ? 'skill' : 'boss';
}

/**
 * Fold one plugin stats push (lib/accountPush readPushed: key -> absolute value) into a lab
 * character's baseline and reading — the board-scoped half of /api/plugin/stats.
 *
 * The reading only ever rises (max per key), like the live overlay. A baseline the lab made itself
 * (`lab: true`, there was no hiscores read to start from) learns each key the first time it is seen:
 * that first value is the starting line, as a starting-shot baseline does on a real board, so a
 * character's lifetime total never counts as event progress. A real hiscores baseline is left alone.
 */
export function foldLabPush(
  baseline: Snapshot | null,
  reading: Snapshot | null,
  pushed: Record<string, number>,
): { baseline: Snapshot; reading: Snapshot } {
  const read: Snapshot = reading ?? { skills: {}, bosses: {} };
  const base: Snapshot = baseline ?? { ...structuredClone(read), lab: true };
  for (const [key, value] of Object.entries(pushed)) {
    const type = statTypeOfKey(key);
    if (base.lab === true && !hasStatValue(base, type, key)) {
      setStatValue(base, type, key, hasStatValue(read, type, key) ? readStatValue(read, type, key) : value);
    }
    setStatValue(read, type, key, Math.max(readStatValue(read, type, key), value));
  }
  return { baseline: base, reading: read };
}

/**
 * One member's baseline and reading with their gain across `keys` set to exactly `target`: the first
 * key carries it, the rest sit at their baseline. An 'overall' XP tile also pins every skill to its
 * baseline, since total XP gained is read as the larger of the overall delta and the summed skill gains.
 *
 * A milestone tile (lifetime total, lib/statTracking milestoneState) instead starts the member at 0 on
 * every key — so they are eligible ("never had one") — and reads `target` as their lifetime total.
 *
 * Both snapshots are modified and returned.
 */
export function withStatProgress(
  baseline: Snapshot,
  reading: Snapshot,
  statType: string,
  keys: string[],
  target: number,
  opts: { milestone?: boolean } = {},
): { baseline: Snapshot; reading: Snapshot } {
  if (keys.length === 0) return { baseline, reading };
  const t = Math.max(0, Math.round(target));
  if (opts.milestone) {
    for (const key of keys) {
      setStatValue(baseline, statType, key, 0);
      setStatValue(reading, statType, key, 0);
    }
    setStatValue(reading, statType, keys[0], t);
    return { baseline, reading };
  }
  const pinned = statType === 'skill' && keys.includes('overall') ? [...new Set([...SKILLS, ...keys])] : keys;
  for (const key of pinned) setStatValue(reading, statType, key, readStatValue(baseline, statType, key));
  setStatValue(reading, statType, keys[0], readStatValue(baseline, statType, keys[0]) + t);
  return { baseline, reading };
}
