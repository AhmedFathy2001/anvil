/**
 * What a person's plugin posts to Discord — the switches and floors that used to be RuneLite config
 * items (AnvilConfig: notifyRareDrops, rareDropMinValue, …). They live on the login now, edited on
 * /settings, and reach the plugin already resolved as `me` on /api/plugin/config: the person's choice
 * AND the clan's channel switch, the enforced floors applied. The plugin only reads booleans.
 *
 * Pure: no database. The store is lib/notifyPrefsStore.
 */

export const CA_TIERS = ['EASY', 'MEDIUM', 'HARD', 'ELITE', 'MASTER', 'GRANDMASTER'] as const;
export const QUEST_TIERS = ['ALL', 'INTERMEDIATE', 'EXPERIENCED', 'MASTER', 'GRANDMASTER'] as const;
export type CaTier = (typeof CA_TIERS)[number] | 'OFF';
export type QuestTier = (typeof QUEST_TIERS)[number] | 'OFF';

export interface NotifyPrefs {
  /** Rare drops to the clan drops channel. */
  drops: boolean;
  /** Post drops worth at least this; 0 = off, else never below 1m. */
  dropMin: number;
  /** Also post drops rarer than 1 in N; 0 = off, else never looser than 1/1000. */
  rarity: number;
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
}

/** The plugin's old defaults, so nobody's posts change by moving. */
export const NOTIFY_DEFAULTS: NotifyPrefs = {
  drops: true,
  dropMin: 5_000_000,
  rarity: 10_000,
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
};

const MAX_GP = 2_147_483_647;
const DEATH_MSG_MAX = 200;

const gp = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(MAX_GP, Math.max(0, Math.round(n))) : fallback;
};
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
    dropMin: gp(o.dropMin, d.dropMin),
    rarity: gp(o.rarity, d.rarity),
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
  };
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
    dropMin: raw.rareDropMinValue,
    rarity,
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

/** The value gate in force: 0 = off, else at least 1m (so nobody spams a shared channel). */
export const mainValueGate = (p: NotifyPrefs) => (p.dropMin <= 0 ? 0 : Math.max(1_000_000, p.dropMin));

/**
 * The rarity gate in force, 1-in-N or 0 for off. The member's number is a preference; the clan's
 * floor is one they can tighten but not loosen. Off stays off — the clan floor doesn't re-enable it.
 */
export const mainRarityGate = (p: NotifyPrefs, clanFloor: number | null | undefined) =>
  p.rarity <= 0 ? 0 : Math.max(Math.max(1000, p.rarity), clanFloor && clanFloor > 0 ? clanFloor : 0);

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
}

export function pluginMe(
  prefs: NotifyPrefs,
  flags: NotifyChannelFlags | null | undefined,
  clanFloor: number | null | undefined,
  mode: { dropMinValue: number | null; dropRarityFloor: number | null } | null | undefined,
): PluginMe {
  const f = flags ?? {};
  const caFrom = CA_TIERS.indexOf(prefs.ca as (typeof CA_TIERS)[number]);
  const questFrom = QUEST_TIERS.indexOf(prefs.quests as (typeof QUEST_TIERS)[number]);
  return {
    drops: prefs.drops && !!f.rareDrops,
    dropMin: modeGate(mainValueGate(prefs), mode?.dropMinValue),
    keyMin: prefs.keyMin,
    floor: modeGate(mainRarityGate(prefs, clanFloor), mode?.dropRarityFloor),
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
  };
}
