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

export interface MappingItem {
  id: number;
  name: string;
}

let cachedItems: MappingItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Collection-log item ids — the authoritative "this is the real obtainable drop" set. RuneLite's
// name cache sometimes lists two ids under one name (e.g. "Vorkath's head" = 2425, an unobtainable
// placeholder, AND 21907, the actual drop). When that happens we keep the id the clog tracks, so the
// picker surfaces the item players can actually get. Built once, lazily.
let clogIdSet: Set<number> | null = null;
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
  if (cachedItems && Date.now() - cacheTimestamp < CACHE_TTL) {
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

  cachedItems = merged;
  cacheTimestamp = Date.now();
  return cachedItems;
}

// Look up a single item by exact numeric id (across the merged tradeable+untradeable list).
export async function getItemById(id: number): Promise<MappingItem | null> {
  const items = await getItemMapping();
  return items.find((it) => it.id === id) ?? null;
}
