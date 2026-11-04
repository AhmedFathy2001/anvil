// Per-game-mode post thresholds: a clan can give a mode (Hardcore, Leagues, Deadman…) its own drop
// rarity, drop value and level milestones — LOOSER or STRICTER than the main game.
//
// Pure — no database — so the decisions are testable on their own (tests/mode-filters.test.ts).
// Storage lives in lib/worldModeStore.
//
// TWO SIDES. /api/plugin/config hands a plugin on a mode world the most permissive thresholds among
// the clans it posts into (`mergeModeThresholds`), and the plugin posts a drop that passes EITHER its
// main-game gate OR those thresholds. /api/plugin/notify then asks `modeFilterAllows` once per clan
// destination, so each clan's channel only gets what ITS settings for the mode allow:
//
//   drops   a set half (rarity / value) is that clan's own gate for the mode, looser or stricter;
//           an unset half follows the main game. A drop the plugin flagged `modeOnly` (it passed
//           only because some clan loosened the mode) never rides an unset half.
//   levels  a mode's stats are a separate character, so a mode posts level-ups only when the clan
//           gave it level rules; those rules replace the clan's main-game ones for the mode.
//
// Absent thresholds = today's behaviour: drops as the main game sends them, no level-ups.

import {
  DEFAULT_XP_RULES,
  effectiveClanRules,
  levelHalf,
  levelPostMatches,
  levelPostOf,
  normalizeMilestoneRules,
  type LevelPostsChoice,
  type LevelRules,
} from './levelRules.ts';

/** A mode's own thresholds. Null on any part = that part follows the main game. */
export interface ModeFilters {
  /** Post drops at least as rare as 1 in this many. */
  dropFloor: number | null;
  /** Post drops worth at least this many gp. */
  dropMinValue: number | null;
  /** Which level-ups the mode posts. Null = none (its stats are not the player's main progression). */
  levels: LevelRules | null;
}

export const NO_MODE_FILTERS: ModeFilters = Object.freeze({ dropFloor: null, dropMinValue: null, levels: null }) as ModeFilters;

/** Bounds, so a clan can loosen a mode without drowning its own channel. 1 in 2 is "coin-flip or rarer". */
export const MIN_MODE_DROP_FLOOR = 2;
/** Largest drop floor a clan can store — far past any real drop rate. */
export const MAX_MODE_DROP_FLOOR = 100_000_000;
/** Below this, every bone and rune pile would post. */
export const MIN_MODE_DROP_VALUE = 1_000;
/** The plugin holds the value in a Java int. */
export const MAX_MODE_DROP_VALUE = 2_147_483_647;

/**
 * The main game's hard floors in the plugin (AnvilPlugin's drop gate): rarity posts rarer than
 * 1/1000, value posts from 1m. An unset half is judged against these (with the clan's own rarity
 * floor on top), which is the closest the site can get to the member's own plugin settings.
 */
export const MAIN_GAME_RARITY_FLOOR = 1_000;
export const MAIN_GAME_MIN_VALUE = 1_000_000;

function parseBoundedInt(raw: unknown, lo: number, hi: number): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim().replace(/[,_\s]/g, '')) : NaN;
  if (!Number.isSafeInteger(n) || n < lo || n > hi) return undefined;
  return n;
}

/** A form/API value → a floor, `null` for "follow the main game", or `undefined` when it's invalid. */
export function parseModeDropFloor(raw: unknown): number | null | undefined {
  return parseBoundedInt(raw, MIN_MODE_DROP_FLOOR, MAX_MODE_DROP_FLOOR);
}

/** A form/API value → a gp minimum, `null` for "follow the main game", or `undefined` when it's invalid. */
export function parseModeDropValue(raw: unknown): number | null | undefined {
  return parseBoundedInt(raw, MIN_MODE_DROP_VALUE, MAX_MODE_DROP_VALUE);
}

/** A stored floor (settings text) → floor or null. Anything unreadable reads as "no override". */
export function storedModeDropFloor(text: string | null | undefined): number | null {
  return parseModeDropFloor(text) ?? null;
}

/** A stored gp minimum (settings text) → value or null. Anything unreadable reads as "no override". */
export function storedModeDropValue(text: string | null | undefined): number | null {
  return parseModeDropValue(text) ?? null;
}

/** A stored level-rules JSON (settings text) → the level half, or null for "no level-ups from the mode". */
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

type Facts = Record<string, unknown>;
const factsOf = (facts: unknown): Facts => (typeof facts === 'object' && facts !== null ? (facts as Facts) : {});
const isNotable = (f: Facts) => f.notable === 'loot' || f.notable === 'unlock';

/** A single, non-guaranteed item with a known rate at least as rare as 1 in `floor`. */
function rareEnough(f: Facts, floor: number): boolean {
  if (f.guaranteed === true) return false;
  const items = Array.isArray(f.items) ? f.items : [];
  if (items.length !== 1) return false;
  const rate = f.dropRate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return false;
  return rate <= 1 / floor + EPS;
}

/** What the post is worth: one item's value, or a haul's (a loot key, a bundled kill) total. */
function dropWorth(f: Facts): number {
  const items = Array.isArray(f.items) ? f.items : [];
  let total = 0;
  for (const it of items) {
    const v = typeof it === 'object' && it !== null ? (it as Facts).value : null;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) total += v;
  }
  return total;
}

/**
 * Does a drop post under a rarity floor alone?
 *
 *   always-post item (`notable`)  yes — the clan listed it to post whatever happens
 *   a drop with a known rate      only when it is at least as rare as 1 in `floor`
 *   no rate (posted on value, a multi-item haul, a guaranteed drop)
 *                                 no — "only drops rarer than 1 in N" can't be shown
 */
export function dropPassesFloor(facts: unknown, floor: number): boolean {
  const f = factsOf(facts);
  return isNotable(f) || rareEnough(f, floor);
}

/**
 * Does a drop from a game mode reach one clan, under that clan's thresholds for the mode?
 * `mainRarityFloor` is the clan's own main-game floor (lib/pluginConfig getDropRarityFloor), used
 * only for an unset rarity half.
 */
export function modeDropAllows(facts: unknown, filters: ModeFilters, mainRarityFloor = 0): boolean {
  const f = factsOf(facts);
  if (isNotable(f)) return true;
  const modeOnly = f.modeOnly === true;
  // Nothing set for the mode: the main game decides, and the plugin already applied it — unless
  // the post only went out because another clan loosened the mode.
  if (filters.dropFloor == null && filters.dropMinValue == null) return !modeOnly;
  const rarity =
    filters.dropFloor != null
      ? rareEnough(f, filters.dropFloor)
      : !modeOnly && rareEnough(f, Math.max(MAIN_GAME_RARITY_FLOOR, mainRarityFloor));
  const worth = dropWorth(f);
  const value = filters.dropMinValue != null ? worth >= filters.dropMinValue : !modeOnly && worth >= MAIN_GAME_MIN_VALUE;
  return rarity || value;
}

/**
 * The level rules a member's posts from a mode follow in one clan: the mode's own, after the
 * member's choice (lib/levelRules effectiveClanRules — 'off' stays off). Null = no level-ups.
 */
export function modeLevelRules(levels: LevelRules | null, choice: LevelPostsChoice): LevelRules | null {
  if (!levels) return null;
  const eff = effectiveClanRules({ ...levels, ...DEFAULT_XP_RULES, skillXpM: [] }, choice);
  return eff ? levelHalf(eff) : null;
}

/**
 * Does one post from a game mode get through that mode's thresholds in one clan?
 *
 * Only `kind` + `facts` posts can be judged; an older plugin's finished embed carries no facts and
 * passes, as it does today. Kinds the thresholds don't cover (deaths, pets, quests…) always pass —
 * the per-kind switches already handle those.
 */
export function modeFilterAllows(
  kind: unknown,
  facts: unknown,
  filters: ModeFilters,
  opts: { mainRarityFloor?: number; levelChoice?: LevelPostsChoice } = {},
): boolean {
  if (kind === undefined) return true;
  if (kind === 'drop') return modeDropAllows(facts, filters, opts.mainRarityFloor ?? 0);
  const post = levelPostOf(kind, facts);
  if (post) return levelPostMatches(post, modeLevelRules(filters.levels, opts.levelChoice ?? 'clan'));
  return true;
}

/**
 * The first plugin build that sends a mode's level-ups as real level posts through
 * /api/plugin/notify (when the mode has level rules). From it on, /api/plugin/mode-lines must not
 * also turn the game's "advanced your X level" lines into level posts — the same level-up twice.
 */
export const MODE_LEVEL_POSTS_MIN_PLUGIN = '1.15.1';

/** Does this plugin build (its X-Anvil-Plugin-Version) post mode level-ups itself? Unknown = no. */
export function pluginPostsModeLevels(version: string | null | undefined): boolean {
  const parts = (v: string | null | undefined) => /^\s*(\d+(?:\.\d+)*)/.exec(v ?? '')?.[1].split('.').map(Number) ?? null;
  const a = parts(version);
  const b = parts(MODE_LEVEL_POSTS_MIN_PLUGIN)!;
  if (!a) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

// ── What the plugin is told ───────────────────────────────────────────────────────────────────

/** The `modeThresholds` block of /api/plugin/config. */
export interface PluginModeThresholds {
  /** lib/worldModes key, e.g. 'hardcore'. */
  key: string;
  label: string;
  /** Post drops at least as rare as 1 in N; null = the main-game gate only. */
  dropRarityFloor: number | null;
  /** Post drops worth at least this; null = the main-game gate only. */
  dropMinValue: number | null;
  /** Level-ups the mode posts; null = none. */
  levelRules: LevelRules | null;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * One step/from pair that matches everything any of the given pairs match (a SUPERSET — each
 * destination re-checks its own rules in /api/plugin/notify, so the plugin only has to not miss
 * one). The shared step is the gcd, from the lowest start; when the starts don't line up on that
 * step, every level from the lowest start.
 */
function unionSteps(pairs: { step: number; from: number }[], startsMustAlign: boolean): { step: number; from: number } | null {
  const on = pairs.filter((p) => p.step > 0);
  if (on.length === 0) return null;
  const step = on.map((p) => p.step).reduce(gcd);
  const from = Math.min(...on.map((p) => p.from));
  if (!startsMustAlign || on.every((p) => (p.from - from) % step === 0)) return { step, from };
  return { step: 1, from };
}

/** Rules that post every level-up any of the given rule sets would (a superset, see unionSteps). */
export function unionLevelRules(sets: (LevelRules | null | undefined)[]): LevelRules | null {
  const rs = sets.filter((r): r is LevelRules => !!r);
  if (rs.length === 0) return null;
  if (rs.length === 1) return levelHalf(rs[0]);
  const skill = unionSteps(rs.map((r) => ({ step: r.skillStep, from: r.skillFrom })), true);
  // A total milestone is any multiple of the step at or past `from`, so the starts needn't align.
  const total = unionSteps(rs.map((r) => ({ step: r.totalStep, from: r.totalFrom })), false);
  return {
    ninetyNines: rs.some((r) => r.ninetyNines),
    skillStep: skill?.step ?? 0,
    skillFrom: skill?.from ?? 1,
    totalStep: total?.step ?? 0,
    totalFrom: total?.from ?? 0,
    maxTotal: rs.some((r) => r.maxTotal),
  };
}

const minOrNull = (xs: (number | null)[]): number | null => {
  const set = xs.filter((x): x is number => x != null);
  return set.length ? Math.min(...set) : null;
};

/**
 * The thresholds the plugin uses on a mode world, from each of the member's clans' settings for it
 * (level rules already after the member's choice): the MOST PERMISSIVE of them, because one post
 * fans out to every clan and each clan re-checks its own. Null when no clan set anything — the
 * plugin then behaves exactly as before.
 */
export function mergeModeThresholds(
  mode: { key: string; label: string },
  perClan: { dropFloor: number | null; dropMinValue: number | null; levels: LevelRules | null }[],
): PluginModeThresholds | null {
  const dropRarityFloor = minOrNull(perClan.map((c) => c.dropFloor));
  const dropMinValue = minOrNull(perClan.map((c) => c.dropMinValue));
  const levelRules = unionLevelRules(perClan.map((c) => c.levels));
  if (dropRarityFloor == null && dropMinValue == null && levelRules == null) return null;
  return { key: mode.key, label: mode.label, dropRarityFloor, dropMinValue, levelRules };
}
