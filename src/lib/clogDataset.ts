import clogData from '@/data/clog.json';

// The collection-log catalogue, indexed for reading.
//
// The dataset ships in the repo (src/data/clog.json, rebuilt by `npm run data:clog` from the wiki's
// own module) rather than living in each clan's database: it's a megabyte of reference data that
// changes on Jagex's schedule, not the clan's, and every instance would otherwise hold its own
// drifting copy of it.
//
// Everything here is built once on first use and cached for the life of the process. The file is
// ~146 KB of JSON, so parsing it per request would be the most expensive thing on a profile page.

interface ClogItem {
  id: number;
  name: string;
}

const raw = clogData as {
  activities?: Record<string, ClogItem[]>;
  itemCount?: number;
  activityCount?: number;
};

let pageIndexCache: Map<string, Set<number>> | null = null;
let itemNameCache: Map<number, string> | null = null;
let pageOfItemCache: Map<number, string> | null = null;

/** Page name → the ids that belong on it. The membership check every ingest needs. */
export function clogPageIndex(): Map<string, Set<number>> {
  if (pageIndexCache) return pageIndexCache;
  const index = new Map<string, Set<number>>();
  for (const [page, items] of Object.entries(raw.activities ?? {})) {
    index.set(page, new Set(items.map((i) => i.id)));
  }
  pageIndexCache = index;
  return index;
}

/** Item id → display name, for anything rendering an item we hold. */
export function clogItemNames(): Map<number, string> {
  if (itemNameCache) return itemNameCache;
  const names = new Map<number, string>();
  for (const items of Object.values(raw.activities ?? {})) {
    for (const item of items) if (!names.has(item.id)) names.set(item.id, item.name);
  }
  itemNameCache = names;
  return names;
}

/**
 * Item id → the page it belongs to.
 *
 * First page wins. A handful of items appear on several pages (pets show under their boss AND under
 * "All Pets"), and for "where did this come from?" the boss is the useful answer.
 */
export function clogPageOfItem(): Map<number, string> {
  if (pageOfItemCache) return pageOfItemCache;
  const owner = new Map<number, string>();
  for (const [page, items] of Object.entries(raw.activities ?? {})) {
    if (page === 'All Pets') continue;
    for (const item of items) if (!owner.has(item.id)) owner.set(item.id, page);
  }
  // Anything that only ever appears under All Pets still needs a home.
  for (const item of raw.activities?.['All Pets'] ?? []) {
    if (!owner.has(item.id)) owner.set(item.id, 'All Pets');
  }
  pageOfItemCache = owner;
  return owner;
}

/** Every page name, in catalogue order. */
export function clogPageNames(): string[] {
  return Object.keys(raw.activities ?? {});
}

/** Items on one page, in the order the game lists them. Empty for an unknown page. */
export function clogPageItems(page: string): ClogItem[] {
  return raw.activities?.[page] ?? [];
}

/** Total obtainable slots in the whole log — the denominator on a profile header. */
export function clogTotalSlots(): number {
  let total = 0;
  for (const items of Object.values(raw.activities ?? {})) total += items.length;
  return total;
}
