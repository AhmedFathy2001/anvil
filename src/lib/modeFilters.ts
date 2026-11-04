// Per-game-mode post filters: a clan can ask a mode (Hardcore, Leagues, Deadman…) to post LESS than
// the main game — only drops rarer than 1 in N, only some level milestones.
//
// Pure — no database — so the decision is testable on its own (tests/mode-filters.test.ts). Storage
// lives in lib/worldModeStore; /api/plugin/notify asks `modeFilterAllows` once per clan destination.
//
// STRICTER ONLY. The plugin already filtered every post with the main-game settings before sending
// it, so the site never sees what the main game would have dropped. A mode filter is one more gate on
// top: it can stop a post, never bring one back. Absent filters = the main-game behaviour, unchanged.

import { levelHalf, levelPostMatches, levelPostOf, normalizeMilestoneRules, type LevelRules } from './levelRules.ts';

/** A mode's own filters. Null on either half = that half follows the main-game settings. */
export interface ModeFilters {
  /** Post only drops rarer than 1 in this many (positive integer). */
  dropFloor: number | null;
  /** Post only level-ups these rules ask for (on top of the clan's own level rules). */
  levels: LevelRules | null;
}

export const NO_MODE_FILTERS: ModeFilters = Object.freeze({ dropFloor: null, levels: null }) as ModeFilters;

/** Largest drop floor a clan can store — far past any real drop rate. */
export const MAX_MODE_DROP_FLOOR = 100_000_000;

/** A form/API value → a floor, `null` for "follow the main game", or `undefined` when it's invalid. */
export function parseModeDropFloor(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim().replace(/[,_\s]/g, '')) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_MODE_DROP_FLOOR) return undefined;
  return n;
}

/** A stored floor (settings text) → floor or null. Anything unreadable reads as "no override". */
export function storedModeDropFloor(text: string | null | undefined): number | null {
  return parseModeDropFloor(text) ?? null;
}

/** A stored level-rules JSON (settings text) → the level half, or null for "no override". */
export function storedModeLevels(text: string | null | undefined): LevelRules | null {
  if (!text || !text.trim()) return null;
  try {
    const raw = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    return levelHalf(normalizeMilestoneRules(raw));
  } catch {
    return null;
  }
}

/** An API value → normalized level rules to store, or null to clear. Never throws. */
export function parseModeLevels(raw: unknown): LevelRules | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return levelHalf(normalizeMilestoneRules(raw));
}

/** Same tolerance the plugin uses for "rate <= 1/floor" (MathUtils.lessThanOrEqual). */
const EPS = 1e-9;

/**
 * Does a drop post under a mode's drop floor?
 *
 *   always-post item (`notable`)  yes — the clan listed it to post whatever happens
 *   a drop with a known rate      only when it is at least as rare as 1 in `floor`
 *   no rate (posted on value, a multi-item haul, a guaranteed drop)
 *                                 no — "only drops rarer than 1 in N" can't be shown, so it stays quiet
 */
export function dropPassesFloor(facts: unknown, floor: number): boolean {
  const f = typeof facts === 'object' && facts !== null ? (facts as Record<string, unknown>) : {};
  if (f.notable === 'loot' || f.notable === 'unlock') return true;
  if (f.guaranteed === true) return false;
  const items = Array.isArray(f.items) ? f.items : [];
  if (items.length !== 1) return false;
  const rate = f.dropRate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return false;
  return rate <= 1 / floor + EPS;
}

/**
 * Does one post from a game mode get through that mode's own filters in one clan?
 *
 * Only `kind` + `facts` posts can be judged; an older plugin's finished embed carries no facts and
 * passes, as it does today. Kinds the filters don't cover (deaths, pets, quests…) always pass —
 * the per-kind switches already handle those.
 */
export function modeFilterAllows(kind: unknown, facts: unknown, filters: ModeFilters): boolean {
  if (kind === undefined) return true;
  if (kind === 'drop') return filters.dropFloor == null || dropPassesFloor(facts, filters.dropFloor);
  if (filters.levels) {
    const post = levelPostOf(kind, facts);
    if (post) return levelPostMatches(post, filters.levels);
  }
  return true;
}
