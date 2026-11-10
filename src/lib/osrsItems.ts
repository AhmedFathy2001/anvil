// Shared OSRS item-mapping lookup, used by the admin item-icon picker (items-search route)
// and the bulk tile importer (resolving CSV item names → item IDs). One in-memory cache per
// server lifecycle so we don't refetch the lists per request.
//
// TWO sources, merged:
//   1. OSRS Wiki real-time-prices mapping — GE-tradeable items only, clean canonical names.
//   2. RuneLite's full item-id → name cache — EVERY item including untradeables (pets, a few
//      uniques). Used to fill in names the Wiki can't, so a pet like "Pet zilyana" (12651)
//      resolves by name. The plugin detects drops by numeric itemId, so an untradeable's id
//      is all that's needed for auto-detection.
// The Wiki list is layered first (canonical for tradeables); RuneLite supplies anything the
// Wiki lacks, lowest-id-wins to prefer the real item over bank-placeholder duplicates.

import clogData from '@/data/clog.json';
import droppableData from '@/data/droppableItems.json';

export interface MappingItem {
  id: number;
  name: string;
  /**
   * The in-game name, only where `name` is a collection-log label that differs from it: slots that
   * share one name ("Decorative armour" ×15) are listed one per id under the wiki's page name.
   */
  gameName?: string;
}

let cachedItems: MappingItem[] | null = null;
let cacheTimestamp = 0;
let cacheTtl = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
// A list built while one source was down is missing a whole class of items (RuneLite down → no
// untradeables by name), so it's only kept briefly before the next request retries both.
const PARTIAL_CACHE_TTL = 1000 * 60 * 5;

// Untradeable skilling / minigame currencies and resources that gain tiles commonly count. The
// RuneLite name cache normally supplies these, but it's a live fetch — this keeps them findable by
// name when it's unreachable. IDs checked against the OSRS Wiki infoboxes (and RuneLite's cache).
// Only fills names the two live sources didn't supply, so it never overrides them.
const UNTRADEABLE_SUPPLEMENT: MappingItem[] = [
  { id: 12012, name: 'Golden nugget' },          // Motherlode Mine
  { id: 21341, name: 'Unidentified minerals' },  // Mining Guild / MLM
  { id: 25527, name: 'Stardust' },               // Shooting stars
  { id: 24711, name: 'Hallowed mark' },          // Hallowed Sepulchre
  { id: 26792, name: 'Abyssal pearls' },         // Guardians of the Rift
  { id: 11849, name: 'Mark of Grace' },          // Rooftop agility
  { id: 29482, name: 'Brimhaven voucher' },      // Brimhaven Agility Arena
  { id: 29480, name: 'Agility arena ticket' },
  { id: 22820, name: 'Molch pearl' },            // Aerial fishing
  { id: 22840, name: 'Golden tench' },
  { id: 25588, name: 'Spirit flakes' },          // Tempoross
  { id: 30038, name: 'Termites' },
  { id: 23962, name: 'Crystal shard' },
  { id: 6529, name: 'Tokkul' },
  { id: 33539, name: 'Bucket of bloodwood sap' }, // Varlamore
  { id: 33621, name: 'Leechfin' },
  { id: 34020, name: 'Sunstone' },
];

// Collection-log item ids — the authoritative "this is the real obtainable drop" set. RuneLite's
// name cache sometimes lists two ids under one name (e.g. "Vorkath's head" = 2425, an unobtainable
// placeholder, AND 21907, the actual drop). When that happens we keep the id the clog tracks, so the
// picker surfaces the item players can actually get. Built once, lazily.
let clogIdSet: Set<number> | null = null;
let clogLabelled: MappingItem[] | null = null;
function getClogItemIds(): Set<number> {
  if (clogIdSet) return clogIdSet;
  const ids = new Set<number>();
  const activities = (clogData as { activities?: Record<string, { id: number }[]> }).activities ?? {};
  for (const items of Object.values(activities)) {
    for (const it of items) if (typeof it.id === 'number') ids.add(it.id);
  }
  clogIdSet = ids;
  return ids;
}

/**
 * Every clog slot whose in-game name another slot shares, one entry per id under its label. The
 * name-collapsing merge below keeps one id per name, which turned fifteen "Decorative armour" slots
 * into a single pick; these replace that one entry.
 */
export function clogLabelledItems(): MappingItem[] {
  if (clogLabelled) return clogLabelled;
  const activities = (clogData as { activities?: Record<string, { id: number; name: string; label?: string }[]> }).activities ?? {};
  const seen = new Set<number>();
  const out: MappingItem[] = [];
  for (const items of Object.values(activities)) {
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      if (it.label) out.push({ id: it.id, name: it.label, gameName: it.name });
    }
  }
  clogLabelled = out;
  return out;
}

/**
 * Name → item for exact-name lookups (CSV import, library tasks, chat names). A labelled entry
 * answers to its label and, failing an entry actually named so, to its in-game name: the lowest id,
 * as the old one-per-name list resolved it.
 */
export function itemsByName(mapping: MappingItem[]): Map<string, MappingItem> {
  const byName = new Map<string, MappingItem>();
  for (const it of mapping) {
    const key = it.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, it);
  }
  for (const it of mapping) {
    if (!it.gameName) continue;
    const key = it.gameName.toLowerCase();
    const cur = byName.get(key);
    if (!cur || (cur.gameName && it.id < cur.id)) byName.set(key, it);
  }
  return byName;
}

/** Pure: the merged list with each same-name clog slot as its own labelled entry (see above). */
export function withClogLabels(merged: MappingItem[], labelled: MappingItem[]): MappingItem[] {
  if (labelled.length === 0) return merged;
  const ids = new Set(labelled.map((it) => it.id));
  // The collapsed entry for such a name carries one of the group's ids; a different id under the
  // same name (a tradeable namesake) is a separate item and stays.
  return [...merged.filter((it) => !ids.has(it.id)), ...labelled];
}

// "Is this item obtainable as loot?" — the filter behind the picker's Drops-only toggle. The
// merged mapping above is every item that EXISTS (shop stock, skilling resources, quest junk,
// bank placeholders); a drop tile can only ever be about the small slice something actually
// drops. Three sources, unioned:
//   • droppableItems.json .combat — items on a monster's kill drop table
//   • droppableItems.json .other  — chest/casket rewards, pickpocket and skilling loot, all of
//     which the plugin still credits as a drop (raid uniques live here — a Twisted bow comes
//     from the Ancient chest, not from a kill)
//   • the collection log — catches anything the wiki's drop tables miss, e.g. pets
// Names are matched alongside ids because a few items are known to the picker under a different
// id than the wiki lists (bank placeholders, renamed variants); matching either way keeps a real
// drop from silently vanishing out of the dropdown. Regenerate with `npm run data:drops`.
let droppableIdSet: Set<number> | null = null;
let droppableNameSet: Set<string> | null = null;
function loadDroppable(): { ids: Set<number>; names: Set<string> } {
  if (!droppableIdSet || !droppableNameSet) {
    const data = droppableData as { combat?: number[]; other?: number[]; names?: string[] };
    droppableIdSet = new Set<number>([...(data.combat ?? []), ...(data.other ?? []), ...getClogItemIds()]);
    droppableNameSet = new Set<string>(data.names ?? []);
  }
  return { ids: droppableIdSet, names: droppableNameSet };
}

/** True when the item is obtainable as loot (monster drop, chest/casket reward, or clog unlock). */
export function isDroppableItem(item: MappingItem): boolean {
  const { ids, names } = loadDroppable();
  return ids.has(item.id) || names.has(item.name.toLowerCase());
}

const WIKI_MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const RUNELITE_NAMES_URL = 'https://static.runelite.net/cache/item/names.json';
const USER_AGENT = 'osrs-bingo-anvil (admin item picker)';

async function fetchWikiItems(): Promise<MappingItem[]> {
  const res = await fetch(WIKI_MAPPING_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch OSRS Wiki item mapping: HTTP ${res.status}`);
  const data = (await res.json()) as { id: number; name: string }[];
  return data
    .filter((item) => typeof item.id === 'number' && typeof item.name === 'string')
    .map((item) => ({ id: item.id, name: item.name }));
}

async function fetchRuneLiteItems(): Promise<MappingItem[]> {
  const res = await fetch(RUNELITE_NAMES_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch RuneLite item names: HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, string>;
  const items: MappingItem[] = [];
  for (const [idStr, name] of Object.entries(data)) {
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') continue; // skip placeholder/empty entries
    items.push({ id, name: trimmed });
  }
  return items;
}

export async function getItemMapping(): Promise<MappingItem[]> {
  if (cachedItems && Date.now() - cacheTimestamp < cacheTtl) {
    return cachedItems;
  }

  // Fetch both in parallel; tolerate either failing so a single outage degrades gracefully
  // (Wiki down → still have untradeables; RuneLite down → still have tradeables).
  const [wikiRes, rlRes] = await Promise.allSettled([fetchWikiItems(), fetchRuneLiteItems()]);
  const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : [];
  const rl = rlRes.status === 'fulfilled' ? rlRes.value : [];
  if (wiki.length === 0 && rl.length === 0) {
    throw new Error('Item mapping unavailable: both Wiki and RuneLite fetches failed');
  }

  // Wiki first (canonical tradeable names), then RuneLite for any name the Wiki lacks.
  const merged = [...wiki];
  const seen = new Set(wiki.map((i) => i.name.toLowerCase()));

  // Collapse RuneLite's duplicate names to one best id: an id the collection log tracks wins (the
  // real obtainable item), otherwise the lowest id (real item over bank-placeholder duplicates).
  // This is why "Vorkath's head" resolves to 21907 (the drop) and not 2425 (an unobtainable dupe).
  const clogIds = getClogItemIds();
  const bestByName = new Map<string, MappingItem>();
  for (const it of rl) {
    const key = it.name.toLowerCase();
    const cur = bestByName.get(key);
    if (!cur) {
      bestByName.set(key, it);
      continue;
    }
    const curClog = clogIds.has(cur.id);
    const itClog = clogIds.has(it.id);
    if (itClog !== curClog) {
      if (itClog) bestByName.set(key, it); // a clog id beats a non-clog one
    } else if (it.id < cur.id) {
      bestByName.set(key, it); // same clog status → lowest id wins
    }
  }
  for (const it of bestByName.values()) {
    const key = it.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }

  for (const it of UNTRADEABLE_SUPPLEMENT) {
    const key = it.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }

  cachedItems = withClogLabels(merged, clogLabelledItems());
  cacheTimestamp = Date.now();
  cacheTtl = wiki.length > 0 && rl.length > 0 ? CACHE_TTL : PARTIAL_CACHE_TTL;
  return cachedItems;
}

// Look up a single item by exact numeric id (across the merged tradeable+untradeable list).
export async function getItemById(id: number): Promise<MappingItem | null> {
  const items = await getItemMapping();
  return items.find((it) => it.id === id) ?? null;
}
