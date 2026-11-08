/**
 * What a person's plugin posts to Discord — the switches and floors that used to be RuneLite config
 * items (AnvilConfig: notifyRareDrops, rareDropMinValue, …). They live on the login now, edited on
 * /settings, and reach the plugin already resolved as `me` on /api/plugin/config: the person's choice
 * AND the clan's channel switch, the enforced floors applied. The plugin only reads booleans.
 *
 * Pure: no database. The store is lib/notifyPrefsStore.
 */

import {
  hookKindsOn,
  NO_CLAN_KINDS,
  NO_PERSONAL_KINDS,
  noShotList,
  normalizePersonalKinds,
  pluginWatches,
  watchesFor,
  type ClanKinds,
  type PersonalKinds,
  type Watch,
} from '@/lib/notifyKinds';

export type DropMode = 'or' | 'and';
export const isDropMode = (v: unknown): v is DropMode => v === 'or' || v === 'and';

export const CA_TIERS = ['EASY', 'MEDIUM', 'HARD', 'ELITE', 'MASTER', 'GRANDMASTER'] as const;
export const QUEST_TIERS = ['ALL', 'INTERMEDIATE', 'EXPERIENCED', 'MASTER', 'GRANDMASTER'] as const;
export type CaTier = (typeof CA_TIERS)[number] | 'OFF';
export type QuestTier = (typeof QUEST_TIERS)[number] | 'OFF';

export interface NotifyPrefs {
  /** Rare drops to the clan drops channel. */
  drops: boolean;
  /**
   * Post drops worth at least this; 0 = off, else never below 1m. NULL = inherit: the clan's default,
   * else Anvil's (see dropGates). Inherit is stored as absent, never as a copied number, so a later
   * change to the clan default reaches everyone still following it.
   */
  dropMin: number | null;
  /** Also post drops rarer than 1 in N; 0 = off, else never looser than 1/1000. NULL = inherit. */
  rarity: number | null;
  /** How the two combine: 'or' (either one) or 'and' (both). NULL = inherit the clan's, else 'or'. */
  dropMode: DropMode | null;
  /** Post a loot key whose contents total at least this; 0 = off. */
  keyMin: number;
  pets: boolean;
  deaths: boolean;
  /** `{name}` is the RSN. */
  deathMsg: string;
  pvp: boolean;
  clog: boolean;
  levels: boolean;
  diaries: boolean;
  /** Combat tasks at or above this tier (and tier clears); OFF posts none. */
  ca: CaTier;
  /** Quests at or above this difficulty; OFF posts none. */
  quests: QuestTier;
  /** Screenshot privacy: chat kinds blanked out of every screenshot the plugin takes (proofs and posts). */
  hide: ShotHide;
  /** The newer kinds, per-kind screenshots, chat patterns (lib/notifyKinds). Absent fields inherit. */
  announce: PersonalKinds;
}

/**
 * Chat rows left out of this person's screenshots, by kind. Game messages, broadcasts and the plugin's
 * own lines have no sender, so they're always kept.
 */
export interface ShotHide {
  /** Private messages: the split-PM box and "From/To Name:" chatbox rows. */
  pm: boolean;
  public: boolean;
  /** Clan chat lines from other people. */
  clanOthers: boolean;
  /** Your own clan chat lines. */
  clanSelf: boolean;
  /** The chat channel (friends chat). */
  channel: boolean;
  /** The group ironman channel. */
  group: boolean;
}

export const SHOT_HIDE_DEFAULTS: ShotHide = { pm: true, public: false, clanOthers: false, clanSelf: false, channel: false, group: false };
const SHOT_HIDE_KEYS = Object.keys(SHOT_HIDE_DEFAULTS) as (keyof ShotHide)[];

/** Anvil's own default drop thresholds, under every clan default and every personal choice. */
/** ALL of them in one place: change a platform default here and every fallback follows. */
export const PLATFORM_DROP_DEFAULTS: { value: number; rarity: number; mode: DropMode } = { value: 1_000_000, rarity: 1_000, mode: 'or' };
export const PLATFORM_DROP_VALUE = PLATFORM_DROP_DEFAULTS.value;
export const PLATFORM_DROP_RARITY = PLATFORM_DROP_DEFAULTS.rarity;
/** The loosest a member's own number may be on a shared channel (0 = off is always allowed). */
export const DROP_MINIMUMS = { value: 1_000_000, rarity: 1_000 } as const;
/** The thresholds Anvil shipped before clans could set a default; a stored value equal to these was never chosen. */
export const OLD_DROP_VALUE = 5_000_000;
export const OLD_DROP_RARITY = 10_000;

export const NOTIFY_DEFAULTS: NotifyPrefs = {
  drops: true,
  dropMin: null,
  rarity: null,
  dropMode: null,
  keyMin: 1_000_000,
  pets: true,
  deaths: true,
  deathMsg: '{name} just died!',
  pvp: false,
  clog: true,
  levels: true,
  diaries: true,
  ca: 'MASTER',
  quests: 'MASTER',
  hide: SHOT_HIDE_DEFAULTS,
  announce: NO_PERSONAL_KINDS,
};

const MAX_GP = 2_147_483_647;
const DEATH_MSG_MAX = 200;

const gp = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(MAX_GP, Math.max(0, Math.round(n))) : fallback;
};
/** Absent / null / blank = inherit (null); anything else a clamped number. */
const gpOrInherit = (v: unknown): number | null => (v == null || v === '' ? null : gp(v, 0));
const bool = (v: unknown, fallback: boolean) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : fallback);
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T =>
  typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fallback;

/** Anything (a stored row, a PATCH body, nothing) → a complete, clamped NotifyPrefs. */
export function normalizeNotifyPrefs(raw: unknown): NotifyPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = NOTIFY_DEFAULTS;
  const msg = typeof o.deathMsg === 'string' ? o.deathMsg.trim().slice(0, DEATH_MSG_MAX) : '';
  return {
    drops: bool(o.drops, d.drops),
    dropMin: gpOrInherit(o.dropMin),
    rarity: gpOrInherit(o.rarity),
    dropMode: isDropMode(o.dropMode) ? o.dropMode : null,
    keyMin: gp(o.keyMin, d.keyMin),
    pets: bool(o.pets, d.pets),
    deaths: bool(o.deaths, d.deaths),
    deathMsg: msg || d.deathMsg,
    pvp: bool(o.pvp, d.pvp),
    clog: bool(o.clog, d.clog),
    levels: bool(o.levels, d.levels),
    diaries: bool(o.diaries, d.diaries),
    ca: oneOf(o.ca, [...CA_TIERS, 'OFF'] as const, d.ca),
    quests: oneOf(o.quests, [...QUEST_TIERS, 'OFF'] as const, d.quests),
    hide: normalizeShotHide(o.hide),
    announce: normalizePersonalKinds(o.announce),
  };
}

/** Anything → a complete ShotHide; each missing or junk key keeps its default. */
export function normalizeShotHide(raw: unknown): ShotHide {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(SHOT_HIDE_KEYS.map((k) => [k, bool(o[k], SHOT_HIDE_DEFAULTS[k])])) as unknown as ShotHide;
}

/** A stored users.notify_prefs value (JSON text, or NULL for never set) → NotifyPrefs. */
export function parseNotifyPrefs(raw: string | null | undefined): NotifyPrefs {
  if (!raw) return normalizeNotifyPrefs(null);
  try {
    return normalizeNotifyPrefs(JSON.parse(raw));
  } catch {
    return normalizeNotifyPrefs(null);
  }
}

/**
 * The RuneLite config the plugin carried before this move, as its raw stored strings (the plugin
 * uploads them once). Keys are the old AnvilConfig keyNames; anything missing keeps the default.
 */
export function prefsFromRuneLite(raw: Record<string, unknown>): NotifyPrefs {
  let rarity = raw.rareDropMinRarity;
  // The plugin's own one-time bump (migrateConfigDefaults v1): an install still on the 1/5000 shipped
  // default before it ran moves to 1/10000. A deliberate 1/5000 after it ran stays.
  if (String(rarity) === '5000' && !(Number(raw.configDefaultsVersion) >= 1)) rarity = 10_000;
  return normalizeNotifyPrefs({
    drops: raw.notifyRareDrops,
    // A value equal to the old platform default was never chosen: it inherits.
    dropMin: String(raw.rareDropMinValue) === String(OLD_DROP_VALUE) ? null : raw.rareDropMinValue,
    rarity: String(rarity) === String(OLD_DROP_RARITY) ? null : rarity,
    keyMin: raw.lootKeyMinValue,
    pets: raw.notifyPets,
    deaths: raw.notifyDeaths,
    deathMsg: raw.deathMessage,
    pvp: raw.notifyPvpKills,
    clog: raw.notifyClogSlots,
    levels: raw.notifyLevelUps,
    diaries: raw.notifyDiaries,
    ca: raw.caMinTaskTier,
    quests: raw.questAnnounce,
  });
}

/**
 * What a clan says about drop posts. `value` / `rarity` are the DEFAULT for its members (anyone who has
 * not set their own). `hardFloor` is the older clan control, kept: a 1-in-N the clan's channels never
 * go looser than, whatever a member chose. All null = nothing set.
 */
export interface ClanDropSettings {
  value: number | null;
  rarity: number | null;
  /** How its members' two thresholds combine by default; null = either ('or'). */
  mode: DropMode | null;
  hardFloor: number | null;
}
export const NO_CLAN_DROPS: ClanDropSettings = { value: null, rarity: null, mode: null, hardFloor: null };

export type DropSource = 'custom' | 'clan' | 'platform';

export interface DropGates {
  /** Value gate in gp; 0 = off. */
  value: number;
  /** Rarity gate as 1-in-N; 0 = off. */
  rarity: number;
  /** 'or': a drop posts on value OR rarity. 'and': it needs both (a threshold that is off isn't required). */
  mode: DropMode;
  valueSource: DropSource;
  raritySource: DropSource;
  modeSource: DropSource;
}

/**
 * The gates in force for ONE character: the person's own number if they set one, else the default of
 * the clan that character is in, else Anvil's. A character with no clan passes NO_CLAN_DROPS. Own
 * numbers stay clamped (value at least 1m, rarity at least 1/1000; 0 = off) so a shared channel can't be
 * spammed, and the clan's hard floor still lifts the rarity gate (off stays off).
 */
export function dropGates(p: Pick<NotifyPrefs, 'dropMin' | 'rarity'> & { dropMode?: DropMode | null }, clan: ClanDropSettings = NO_CLAN_DROPS): DropGates {
  const clanValue = clan.value != null && clan.value > 0 ? clan.value : null;
  const clanRarity = clan.rarity != null && clan.rarity > 0 ? clan.rarity : null;
  const valueSource: DropSource = p.dropMin != null ? 'custom' : clanValue != null ? 'clan' : 'platform';
  const raritySource: DropSource = p.rarity != null ? 'custom' : clanRarity != null ? 'clan' : 'platform';
  const modeSource: DropSource = p.dropMode != null ? 'custom' : clan.mode != null ? 'clan' : 'platform';
  const value = p.dropMin ?? clanValue ?? PLATFORM_DROP_DEFAULTS.value;
  const rarity = p.rarity ?? clanRarity ?? PLATFORM_DROP_DEFAULTS.rarity;
  const hard = clan.hardFloor != null && clan.hardFloor > 0 ? clan.hardFloor : 0;
  return {
    value: value <= 0 ? 0 : Math.max(DROP_MINIMUMS.value, value),
    rarity: rarity <= 0 ? 0 : Math.max(DROP_MINIMUMS.rarity, rarity, hard),
    mode: p.dropMode ?? clan.mode ?? PLATFORM_DROP_DEFAULTS.mode,
    valueSource,
    raritySource,
    modeSource,
  };
}

/**
 * One of a person's own webhooks: its explicit filters, null = follow the person's gates. A webhook
 * is the person's own channel, so its numbers may be looser than the shared floors (value at least 1,
 * rarity at least 1).
 */
export interface HookDropFilter {
  id: number;
  minValue: number | null;
  minRarity: number | null;
  mode: DropMode | null;
}

export function hookGates(base: DropGates, h: Pick<HookDropFilter, 'minValue' | 'minRarity' | 'mode'>): DropGates {
  return {
    value: h.minValue != null ? Math.max(1, h.minValue) : base.value,
    rarity: h.minRarity != null ? Math.max(1, h.minRarity) : base.rarity,
    mode: h.mode ?? base.mode,
    valueSource: base.valueSource,
    raritySource: base.raritySource,
    modeSource: base.modeSource,
  };
}

/** The loosest of several gates: off (0) is ignored unless nothing else is set. */
const loosest = (xs: number[]) => {
  const on = xs.filter((x) => x > 0);
  return on.length ? Math.min(...on) : 0;
};

/** A drop gate with a mode's own threshold folded in: off stays off, else the looser of the two. */
export const modeGate = (main: number, mode: number | null | undefined) =>
  main <= 0 || !mode || mode <= 0 ? main : Math.min(main, mode);

/** The clan's channel switches as /api/plugin/config sends them (lib/pluginConfigEnrolled notifyFlags). */
export type NotifyChannelFlags = Partial<
  Record<'rareDrops' | 'deaths' | 'combatAchievements' | 'pvpKills' | 'pets' | 'levels' | 'quests' | 'diaries' | 'collectionLog', boolean>
>;

/** What the plugin reads (PluginConfigResponse.Me). */
export interface PluginMe {
  drops: boolean;
  /** The screenshot gate: the loosest value floor in force here (the site judges the post itself). */
  dropMin: number;
  keyMin: number;
  /** The loosest rarity floor in force here — /api/plugin/rules builds its rare table from it. */
  floor: number;
  pets: boolean;
  deaths: boolean;
  deathMsg: string;
  pvp: boolean;
  clog: boolean;
  levels: boolean;
  /** The clan's level channel is on (LevelRules.resolve's clan half). */
  levelsClan: boolean;
  diaries: boolean;
  /** CombatAchievementTier names that post; empty = none (tier clears too). */
  ca: string[];
  /** Quest difficulties that post; "*" = every quest, listed or not. */
  quests: string[];
  /** Screenshot privacy (every screenshot, not gated by any clan switch). */
  hide: ShotHide;
  /** Game lines that post (lib/notifyKinds watchesFor). */
  watch: Watch[];
  /** Post kinds whose announcement goes without a screenshot. Tile proofs are never affected. */
  noShot: string[];
  /** Private hook kinds that are on, with their floor (GE gp). */
  on: Record<string, number>;
}

export function pluginMe(
  prefs: NotifyPrefs,
  flags: NotifyChannelFlags | null | undefined,
  clan: ClanDropSettings,
  mode: { dropMinValue: number | null; dropRarityFloor: number | null } | null | undefined,
  hooks: HookDropFilter[] = [],
  clanKinds: ClanKinds = NO_CLAN_KINDS,
): PluginMe {
  const gates = dropGates(prefs, clan);
  // The screenshot gate is the loosest of the person's gates and their drop webhooks' own filters; the
  // site then judges each destination (lib/notifyDrops judgeDropFor).
  const each = [gates, ...hooks.map((h) => hookGates(gates, h))];
  const f = flags ?? {};
  const caFrom = CA_TIERS.indexOf(prefs.ca as (typeof CA_TIERS)[number]);
  const questFrom = QUEST_TIERS.indexOf(prefs.quests as (typeof QUEST_TIERS)[number]);
  return {
    drops: prefs.drops && !!f.rareDrops,
    dropMin: modeGate(loosest(each.map((g) => g.value)), mode?.dropMinValue),
    keyMin: prefs.keyMin,
    floor: modeGate(loosest(each.map((g) => g.rarity)), mode?.dropRarityFloor),
    // The server decides a pet's destinations live (a personal webhook needs no clan channel), so
    // only the person's own switch gates it — the plugin's old petAnnouncementEnabled.
    pets: prefs.pets,
    deaths: prefs.deaths && !!f.deaths,
    deathMsg: prefs.deathMsg,
    pvp: prefs.pvp && !!f.pvpKills,
    clog: prefs.clog && !!f.collectionLog,
    levels: prefs.levels,
    levelsClan: !!f.levels,
    diaries: prefs.diaries && !!f.diaries,
    ca: f.combatAchievements && caFrom >= 0 ? CA_TIERS.slice(caFrom) : [],
    // "ALL" is rank 0: every quest, including one the difficulty list doesn't know.
    quests: !f.quests || questFrom < 0 ? [] : questFrom === 0 ? ['*'] : QUEST_TIERS.slice(questFrom),
    hide: { ...prefs.hide },
    watch: pluginWatches(watchesFor(prefs.announce, clanKinds)),
    noShot: noShotList(prefs.announce, clanKinds),
    on: hookKindsOn(prefs.announce),
  };
}
