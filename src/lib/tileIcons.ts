// Tile icon derivation. The DB `tiles.icon` URL column is legacy — nothing populates it in the
// current authoring flow — so board surfaces derive a display icon from the tile's structured
// tracking config instead. Item images come from RuneLite's static export of the game cache
// (the exact sprites the plugin renders in-game); skill icons come from the OSRS wiki. Both are
// served through our own asset cache (lib/assetUrls, app/img/*), never hotlinked.

import { BOSSES, SKILLS, metricKeys } from './constants';
import { parsePbActivity } from '@/lib/pbGroups';
import bossIcons from '@/data/bossIcons.json';
import bossImages from '@/data/bossImages.json';
import bossHiscoreIcons from '@/data/bossHiscoreIcons.json';
import { itemAssetUrl, proxyWikiUrl, wikiImageUrl } from '@/lib/assetUrls';

export { wikiImageUrl } from '@/lib/assetUrls';

/** RuneLite's cache sprite for an item, through our asset cache (`/img/item/<id>.png`). Relative — wrap
 *  in `absoluteAssetUrl` (lib/seo) wherever the URL leaves the browser (Discord, plugin, cards). */
export function itemIconUrl(itemId: number): string {
  return itemAssetUrl(itemId);
}

const COINS_ITEM_ID = 995;

// Signature reward per timed activity / boss (lowercased) — the icon a "clear X under Y" tile
// shows, mirroring what members associate with the content. Ids come from src/data/clog.json
// (npm run data:clog), so they match the game cache exactly.
export const NOTABLE_ACTIVITY_ITEMS: Record<string, number> = {
  'inferno': 21295, 'the inferno': 21295, 'tzkal-zuk': 21295,             // Infernal cape
  'fight caves': 6570, 'the fight caves': 6570, 'tztok-jad': 6570,        // Fire cape
  'fortis colosseum': 28947, 'colosseum': 28947, 'sol heredit': 28947,    // Dizana's quiver
  'chambers of xeric': 20997,                                             // Twisted bow
  'theatre of blood': 22486,                                              // Scythe of vitur
  'tombs of amascut': 27277,                                              // Tumeken's shadow
  'the gauntlet': 25859, 'gauntlet': 25859, 'corrupted gauntlet': 25859,  // Enhanced crystal weapon seed
  'crystalline hunllef': 25859, 'corrupted hunllef': 25859,               // kill tiles target the boss by name
  'hallowed sepulchre': 24844,                                            // Ring of endurance
  'tempoross': 25576,                                                     // Tome of water
  'the nightmare': 24417, 'nightmare': 24417, "phosani's nightmare": 24417, // Inquisitor's mace
  'barracuda trials': 31745, 'barracuda trial': 31745,                    // Captured wind mote
  'tempor tantrum': 31745, 'jubbly jive': 31745, 'gwenith glide': 31745,
  'maggot king': 33634,                                                   // Elder venator fang
  'mad angel': 34027, 'the mad angel': 34027,                             // Hallowfell
};

/** Item id of the signature reward for an activity name, or null. Mode suffixes fall back. */
export function notableItemFor(activity: string | null | undefined): number | null {
  if (!activity) return null;
  const key = activity.trim().toLowerCase();
  if (NOTABLE_ACTIVITY_ITEMS[key] != null) return NOTABLE_ACTIVITY_ITEMS[key];
  // "Chambers of Xeric: Challenge Mode" → "chambers of xeric"
  const base = key.split(':')[0].trim();
  return NOTABLE_ACTIVITY_ITEMS[base] ?? null;
}

// Generated from the clog dataset (npm run data:clog): activity name → first clog item.
// Keys are lowercased with a leading "The " stripped.
const BOSS_ICONS = bossIcons as Record<string, number>;

// Boss labels / NPC names whose clog page is named differently (combined wildy pages,
// display shorthands, raid-mode abbreviations). Values are BOSS_ICONS keys.
const BOSS_NAME_ALIASES: Record<string, string> = {
  'callisto': 'callisto and artio',
  'artio': 'callisto and artio',
  "vet'ion": "vet'ion and calvar'ion",
  "calvar'ion": "vet'ion and calvar'ion",
  'venenatis': 'venenatis and spindel',
  'spindel': 'venenatis and spindel',
  'barrows': 'barrows chests',
  'dagannoth prime': 'dagannoth kings',
  'dagannoth rex': 'dagannoth kings',
  'dagannoth supreme': 'dagannoth kings',
  'lunar chests': 'moons of peril',
  'thermy': 'thermonuclear smoke devil',
  'cox': 'chambers of xeric',
  'tob': 'theatre of blood',
  'toa': 'tombs of amascut',
};

// Generated from the OSRS wiki (npm run data:bossimages): activity name → the boss's own picture.
// Same keys as BOSS_ICONS. Only bosses the wiki has a monster/logo image for — a skilling activity
// or a combined wildy page has none, which is why bossItemFor's drop sprite stays the fallback.
// The dataset stores the wiki's own URLs; they are mapped onto our asset cache once, here.
const BOSS_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(bossImages as Record<string, string>).map(([k, v]) => [k, proxyWikiUrl(v)]),
);

/** The BOSS_ICONS/BOSS_IMAGES key for a boss/activity name — lowercase, drop a leading "the ",
 *  apply the display-name aliases. Shared so the drop-sprite and the picture resolve alike. */
function bossKey(name: string): string {
  let key = name.trim().toLowerCase();
  if (key.startsWith('the ')) key = key.slice(4);
  return BOSS_NAME_ALIASES[key] ?? key;
}

/**
 * Representative item for a boss/activity NAME — curated signature reward first, then the
 * activity's first collection-log item. Covers every clog activity, so boss-KC and kill
 * tiles get an icon even when nobody hand-picked one.
 */
export function bossItemFor(name: string | null | undefined): number | null {
  if (!name) return null;
  const notable = notableItemFor(name);
  if (notable != null) return notable;
  const key = bossKey(name);
  if (BOSS_ICONS[key] != null) return BOSS_ICONS[key];
  const base = key.split(':')[0].trim();
  const aliasedBase = BOSS_NAME_ALIASES[base] ?? base;
  return BOSS_ICONS[aliasedBase] ?? null;
}

/**
 * The boss's OWN picture (the monster or the raid logo), from the wiki. Falls back to the signature
 * DROP sprite when the wiki has no image for it, so a "Boss of the Week" thumbnail is never blank —
 * the fallback is the same art bossItemFor would have shown before this dataset existed.
 */
export function bossImageUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = bossKey(name);
  if (BOSS_IMAGES[key] != null) return BOSS_IMAGES[key];
  const base = key.split(':')[0].trim();
  const aliasedBase = BOSS_NAME_ALIASES[base] ?? base;
  if (BOSS_IMAGES[aliasedBase] != null) return BOSS_IMAGES[aliasedBase];
  const item = bossItemFor(name);
  return item != null ? itemIconUrl(item) : null;
}

/** As {@link bossImageUrl}, but from a hiscores boss KEY ("zulrah", "kreeArra"). */
export function bossImageForStatKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return bossImageUrl(BOSSES.find((b) => b.key === key)?.label ?? key);
}

// Generated from the OSRS wiki (npm run data:bosshiscoreicons): hiscores boss KEY → the wiki file of
// that boss's HISCORES sprite ("Nex_icon.png", ~25px). These are the sprites RuneLite's hiscore panel
// draws (HiscoreSkill's sprite ids), so a boss on the site is the same little head a member picked in
// RuneLite — not its signature drop (Nex used to be a Nihil horn). Every BOSSES key has one
// (tests/bossHiscoreIcons.test.ts); anything else falls back to the picture/drop below.
const BOSS_HISCORE_ICONS = bossHiscoreIcons as Record<string, string>;

// Names that reach us for a boss but aren't its key or label: NPC names, clog pages, the long
// hiscores spellings of the raid modes. Lowercased, leading "the " already stripped.
const BOSS_NAME_TO_KEY: Record<string, string> = {
  'callisto and artio': 'callisto',
  "vet'ion and calvar'ion": 'vetion',
  'venenatis and spindel': 'venenatis',
  'barrows chests': 'barrows',
  'moons of peril': 'lunarChests',
  'thermonuclear smoke devil': 'thermonuclearSmokeDevil',
  'chambers of xeric: challenge mode': 'chambersOfXericChallengeMode',
  'chambers of xeric challenge mode': 'chambersOfXericChallengeMode',
  'theatre of blood: hard mode': 'theatreOfBloodHardMode',
  'theatre of blood hard mode': 'theatreOfBloodHardMode',
  'tombs of amascut: expert mode': 'tombsOfAmascutExpertMode',
  'tombs of amascut expert mode': 'tombsOfAmascutExpertMode',
  'corrupted gauntlet': 'corruptedGauntlet',
  'crystalline hunllef': 'gauntlet',
  'corrupted hunllef': 'corruptedGauntlet',
  'great olm': 'chambersOfXeric',
  'verzik vitur': 'theatreOfBlood',
  'fight caves': 'tzTokJad',
  'inferno': 'tzKalZuk',
  'fortis colosseum': 'solHeredit',
  'colosseum': 'solHeredit',
  'demonic brutus': 'brutus',
  'cox': 'chambersOfXeric',
  'tob': 'theatreOfBlood',
  'toa': 'tombsOfAmascut',
};

let BOSS_KEY_BY_NAME: Map<string, string> | null = null;
/** The hiscores boss key for a boss NAME (label, key, NPC name, clog page), or null. */
export function bossStatKeyFor(name: string | null | undefined): string | null {
  if (!name) return null;
  if (!BOSS_KEY_BY_NAME) {
    const m = new Map<string, string>();
    const norm = (s: string) => s.trim().toLowerCase().replace(/^the /, '');
    for (const b of BOSSES) {
      m.set(b.key.toLowerCase(), b.key);
      m.set(norm(b.label), b.key);
    }
    for (const [n, k] of Object.entries(BOSS_NAME_TO_KEY)) if (!m.has(n)) m.set(n, k);
    BOSS_KEY_BY_NAME = m;
  }
  const key = name.trim().toLowerCase().replace(/^the /, '');
  return BOSS_KEY_BY_NAME.get(key) ?? null;
}

/** The boss's hiscores sprite (as RuneLite shows it) for a hiscores KEY, or null when it has none. */
export function bossHiscoreIconUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const file = BOSS_HISCORE_ICONS[key];
  return file ? wikiImageUrl(file) : null;
}

/**
 * The ICON for a boss NAME — what a list row, a tile, a pin or a Discord thumbnail shows: its hiscores
 * sprite (the one RuneLite draws), else {@link bossImageUrl}'s picture/drop fallback. For a big hero
 * picture (a link card, a Wrapped feature) keep using bossImageUrl: a 25px sprite blown up to 500px
 * is mush.
 */
export function bossIconUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  return bossHiscoreIconUrl(bossStatKeyFor(name)) ?? bossImageUrl(name);
}

/** As {@link bossIconUrl}, but from a hiscores boss KEY ("zulrah", "kreeArra"). */
export function bossIconForStatKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return bossHiscoreIconUrl(key) ?? bossImageForStatKey(key);
}

/** OSRS wiki icon for a hiscores skill key ("mining"), or null for unknown skills. */
export function skillIconUrl(skill: string | null | undefined): string | null {
  if (!skill) return null;
  const key = skill.trim().toLowerCase();
  if (key === 'overall') return wikiImageUrl('Stats_icon.png');
  if (!(SKILLS as readonly string[]).includes(key)) return null;
  const file = key.charAt(0).toUpperCase() + key.slice(1);
  return wikiImageUrl(`${file}_icon.png`);
}

const firstItemId = (trackedItemIds?: string | null, itemRequirements?: string | null): number | null => {
  try {
    if (itemRequirements) {
      const reqs = JSON.parse(itemRequirements) as { itemId?: number }[];
      if (Array.isArray(reqs) && typeof reqs[0]?.itemId === 'number') return reqs[0].itemId;
    }
  } catch { /* ignore malformed JSON */ }
  try {
    if (trackedItemIds) {
      const ids = JSON.parse(trackedItemIds) as number[];
      if (Array.isArray(ids) && typeof ids[0] === 'number') return ids[0];
    }
  } catch { /* ignore malformed JSON */ }
  return null;
};

// Icons for the non-boss hiscores counters. These have no collection-log activity to derive a
// signature drop from, so each points at the item players associate with it — the clue caskets, an
// abyssal pearl for GOTR, a BH emblem — keeping the board recognisable at a glance.
const ACTIVITY_ITEM_IDS: Record<string, number> = {
  riftsClosed: 26372,        // Abyssal pearls
  soulWarsZeal: 25320,       // Spoils of war
  colosseumGlory: 28947,     // Dizana's quiver
  collectionsLogged: 22711,  // Collection log
  cluesAll: 19835,           // Reward casket (master) — stands in for "clues" generally
  cluesBeginner: 23245,
  cluesEasy: 20546,
  cluesMedium: 20545,
  cluesHard: 20544,
  cluesElite: 20543,
  cluesMaster: 19835,
  bhHunter: 12746,           // Bounty hunter emblem (tier 10)
  bhRogue: 12746,
  bhHunterLegacy: 12746,
  bhRogueLegacy: 12746,
};

// LMS and PvP Arena are RANKS, not counters — the wiki skull reads better than a reward item.
const ACTIVITY_ICON_URLS: Record<string, string> = {
  lastManStanding: wikiImageUrl('Skull_(status)_icon.png'),
  pvpArena: wikiImageUrl('Skull_(status)_icon.png'),
};

/** Display icon for a non-boss hiscores counter, or null when the key isn't one. */
export function activityIconUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (ACTIVITY_ICON_URLS[key]) return ACTIVITY_ICON_URLS[key];
  const itemId = ACTIVITY_ITEM_IDS[key];
  return itemId != null ? itemIconUrl(itemId) : null;
}

/** As {@link bossItemFor}, but from a hiscores boss KEY ("maggotKing") instead of a name. */
export function bossItemForStatKey(key: string | null | undefined): number | null {
  if (!key) return null;
  return bossItemFor(BOSSES.find((b) => b.key === key)?.label ?? key);
}

export interface IconableTile {
  icon?: string | null;
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  timedActivity?: string | null;
  targetNpcs?: string | null;
}

/**
 * Display icon URL for a tile: the explicit icon if an admin set one, else the first tracked
 * item, a skill icon for skill tiles, the boss/activity's signature reward for boss KC / kill /
 * timed tiles, coins for loot-value tiles. Null = no icon (e.g. manual tiles).
 */
export function deriveTileIcon(tile: IconableTile): string | null {
  // An admin-set wiki image URL still goes through our cache rather than being hotlinked.
  if (tile.icon) return proxyWikiUrl(tile.icon);

  const item = firstItemId(tile.trackedItemIds, tile.itemRequirements);
  if (item != null) return itemIconUrl(item);

  const type = (tile.tileType ?? 'standard').toLowerCase();
  if (type === 'timed' || type === 'deathless') {
    const notable = notableItemFor(tile.timedActivity);
    return notable != null ? itemIconUrl(notable) : null;
  }
  if (type === 'value') return itemIconUrl(COINS_ITEM_ID);
  if (type === 'kill') {
    // The boss itself — its hiscores sprite, as RuneLite shows it (picture/drop when it has none).
    try {
      const npcs = tile.targetNpcs ? (JSON.parse(tile.targetNpcs) as string[]) : [];
      return bossIconUrl(Array.isArray(npcs) ? npcs[0] : null);
    } catch { return null; }
  }
  // Agility laps: the skill icon. Course-specific art would need a per-course sprite table for a
  // detail nobody reads off a 48px tile — the Agility icon already says exactly what the tile is.
  if (type === 'lap') return skillIconUrl('agility');
  if (type === 'diary') return wikiImageUrl('Achievement_Diaries_icon.png');
  if (type === 'ca') return wikiImageUrl('Combat_Achievements_icon.png');
  if (type === 'clog') return itemIconUrl(22711); // the Collection log book
  // PvP kills: the wilderness skull — the universal "dangerous PvP" marker.
  if (type === 'pvp') return wikiImageUrl('Skull_(status)_icon.png');

  // Stat tiles: skill icon for skill XP, the boss itself for KC. Composite trackedStat
  // (comma-separated keys, gains summed) uses the FIRST key's icon.
  if (tile.trackedStat) {
    const firstKey = tile.trackedStat.split(',')[0].trim();
    if ((tile.statType ?? 'skill') === 'skill') return skillIconUrl(firstKey);
    // Non-boss counters (clues, GOTR, BH…) have no clog activity to derive a drop from.
    const activityIcon = activityIconUrl(firstKey);
    if (activityIcon) return activityIcon;
    // The boss's hiscores sprite, falling back to its picture / signature drop.
    return bossIconForStatKey(firstKey);
  }
  return null;
}

/**
 * The ICON of a weekly competition: the skill's wiki icon, the boss's hiscores sprite (as RuneLite
 * shows it), or the stats icon for an efficiency week. Same art the boards already use, so a
 * competition and the tile that tracks it look like the same thing.
 */
export function competitionIconUrl(type: string, metric: string): string | null {
  if (type === 'skill') return skillIconUrl(metric);
  if (type === 'efficiency') return wikiImageUrl('Stats_icon.png');
  return bossIconForStatKey(metricKeys(metric)[0] ?? metric);
}

/**
 * As {@link competitionIconUrl}, but a boss competition shows the boss's big PICTURE (the monster
 * render) — for hero art drawn hundreds of pixels wide (the Boss of the Week link card), where the
 * 25px hiscores sprite would be mush. Skill and efficiency are unchanged, and a boss with no wiki
 * image still falls back to the drop sprite.
 */
export function competitionImageUrl(type: string, metric: string): string | null {
  if (type === 'skill') return skillIconUrl(metric);
  if (type === 'efficiency') return wikiImageUrl('Stats_icon.png');
  // A raid across its modes draws as its first mode.
  return bossImageForStatKey(metricKeys(metric)[0] ?? metric);
}

/**
 * An icon for a personal-best activity (a boss's hiscores sprite where it has one). The game names them by team and mode — "Chambers of Xeric
 * Challenge Mode 5 Players", "Duke Sucellus (awakened)" — which no boss table knows, so the boss is
 * parsed out first (lib/pbGroups); then a boss whose name it contains ("Demonic Brutus" → Brutus); then
 * a skill it names (agility courses). Null only when nothing fits — callers draw a plain clock.
 */
export function activityImageUrl(activity: string | null | undefined): string | null {
  if (!activity) return null;
  const direct = bossIconUrl(activity);
  if (direct) return direct;
  const { base } = parsePbActivity(activity);
  const byBase = base !== activity ? bossIconUrl(base) : null;
  if (byBase) return byBase;
  const lower = base.toLowerCase();
  let best: { label: string; len: number } | null = null;
  for (const b of BOSSES) {
    const l = b.label.toLowerCase();
    if (l.length >= 4 && lower.includes(l) && (!best || l.length > best.len)) best = { label: b.label, len: l.length };
  }
  if (best) {
    const img = bossIconUrl(best.label);
    if (img) return img;
  }
  const skill = (SKILLS as readonly string[]).find((k) => k !== 'overall' && lower.includes(k));
  return skill ? skillIconUrl(skill) : null;
}
