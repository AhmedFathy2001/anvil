// Tile icon derivation. The DB `tiles.icon` URL column is legacy — nothing populates it in the
// current authoring flow — so board surfaces derive a display icon from the tile's structured
// tracking config instead. Item images come from RuneLite's static export of the game cache
// (the exact sprites the plugin renders in-game); skill icons come from the OSRS wiki.

import { BOSSES, SKILLS } from './constants';
import bossIcons from '@/data/bossIcons.json';

export function itemIconUrl(itemId: number): string {
  return `https://static.runelite.net/cache/item/icon/${itemId}.png`;
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

/**
 * Representative item for a boss/activity NAME — curated signature reward first, then the
 * activity's first collection-log item. Covers every clog activity, so boss-KC and kill
 * tiles get an icon even when nobody hand-picked one.
 */
export function bossItemFor(name: string | null | undefined): number | null {
  if (!name) return null;
  const notable = notableItemFor(name);
  if (notable != null) return notable;
  let key = name.trim().toLowerCase();
  if (key.startsWith('the ')) key = key.slice(4);
  key = BOSS_NAME_ALIASES[key] ?? key;
  if (BOSS_ICONS[key] != null) return BOSS_ICONS[key];
  const base = key.split(':')[0].trim();
  const aliasedBase = BOSS_NAME_ALIASES[base] ?? base;
  return BOSS_ICONS[aliasedBase] ?? null;
}

/** OSRS wiki icon for a hiscores skill key ("mining"), or null for unknown skills. */
export function skillIconUrl(skill: string | null | undefined): string | null {
  if (!skill) return null;
  const key = skill.trim().toLowerCase();
  if (key === 'overall') return 'https://oldschool.runescape.wiki/images/Stats_icon.png';
  if (!(SKILLS as readonly string[]).includes(key)) return null;
  const file = key.charAt(0).toUpperCase() + key.slice(1);
  return `https://oldschool.runescape.wiki/images/${file}_icon.png`;
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
  lastManStanding: 'https://oldschool.runescape.wiki/images/Skull_(status)_icon.png',
  pvpArena: 'https://oldschool.runescape.wiki/images/Skull_(status)_icon.png',
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
  if (tile.icon) return tile.icon;

  const item = firstItemId(tile.trackedItemIds, tile.itemRequirements);
  if (item != null) return itemIconUrl(item);

  const type = (tile.tileType ?? 'standard').toLowerCase();
  if (type === 'timed' || type === 'deathless') {
    const notable = notableItemFor(tile.timedActivity);
    return notable != null ? itemIconUrl(notable) : null;
  }
  if (type === 'value') return itemIconUrl(COINS_ITEM_ID);
  if (type === 'kill') {
    try {
      const npcs = tile.targetNpcs ? (JSON.parse(tile.targetNpcs) as string[]) : [];
      const item = bossItemFor(Array.isArray(npcs) ? npcs[0] : null);
      return item != null ? itemIconUrl(item) : null;
    } catch { return null; }
  }
  // Agility laps: the skill icon. Course-specific art would need a per-course sprite table for a
  // detail nobody reads off a 48px tile — the Agility icon already says exactly what the tile is.
  if (type === 'lap') return skillIconUrl('agility');
  if (type === 'diary') return 'https://oldschool.runescape.wiki/images/Achievement_Diaries_icon.png';
  if (type === 'ca') return 'https://oldschool.runescape.wiki/images/Combat_Achievements_icon.png';
  // PvP kills: the wilderness skull — the universal "dangerous PvP" marker.
  if (type === 'pvp') return 'https://oldschool.runescape.wiki/images/Skull_(status)_icon.png';

  // Stat tiles: skill icon for skill XP, the boss's representative item for KC. Composite
  // trackedStat (comma-separated keys, gains summed) uses the FIRST key's icon.
  if (tile.trackedStat) {
    const firstKey = tile.trackedStat.split(',')[0].trim();
    if ((tile.statType ?? 'skill') === 'skill') return skillIconUrl(firstKey);
    // Non-boss counters (clues, GOTR, BH…) have no clog activity to derive a drop from.
    const activityIcon = activityIconUrl(firstKey);
    if (activityIcon) return activityIcon;
    const label = BOSSES.find((b) => b.key === firstKey)?.label;
    const item = bossItemFor(label);
    return item != null ? itemIconUrl(item) : null;
  }
  return null;
}
