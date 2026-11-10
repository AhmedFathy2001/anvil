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

interface RawClogItem {
  id: number;
  /** The in-game name — what an unlock line and a drop say, so what matching keys on. */
  name: string;
  /** The wiki's item page name, only on slots whose in-game name another slot shares. */
  label?: string;
}

/** One page entry for display: `name` is the slot's label, `gameName` what the game calls it. */
export interface ClogItem {
  id: number;
  name: string;
  gameName: string;
}

const raw = clogData as {
  activities?: Record<string, RawClogItem[]>;
  itemCount?: number;
  activityCount?: number;
};

let pageIndexCache: Map<string, Set<number>> | null = null;
let itemNameCache: Map<number, string> | null = null;
let itemLabelCache: Map<number, string> | null = null;
let pageItemsCache: Map<string, ClogItem[]> | null = null;
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

/**
 * Item id → in-game name, for MATCHING: unlock lines, drop names, the plugin's name lists. Several
 * slots share one ("Decorative armour" is fifteen of them), so never show this where the slot itself
 * matters; that is `clogItemLabels`.
 */
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
 * Item id → display label: the in-game name, or for a slot sharing its name with others the wiki's
 * page name for that one ("Decorative armour (gold platebody)"), so each reads as its own entry.
 */
export function clogItemLabels(): Map<number, string> {
  if (itemLabelCache) return itemLabelCache;
  const labels = new Map<number, string>();
  for (const items of Object.values(raw.activities ?? {})) {
    for (const item of items) if (!labels.has(item.id)) labels.set(item.id, item.label ?? item.name);
  }
  itemLabelCache = labels;
  return labels;
}

/** Ids of every slot that shares its in-game name with another slot, by that name (lowercased). */
export function clogSameNameGroups(): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const [id, name] of clogItemNames()) {
    const key = name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  for (const [key, ids] of groups) if (ids.length < 2) groups.delete(key);
  return groups;
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

/**
 * Turn a WHOLE-LOG item list into rows to store.
 *
 * The plugin can ask the server to transmit the entire collection log at once (the search-toggle
 * trick WikiSync found), and what comes back is a flat list of obtained item ids with no page
 * structure at all — the pages are ours to reconstruct, which is right: we own the catalogue and it
 * changes on Jagex's schedule, not the client's.
 *
 * Each item gets exactly ONE page, its owning one (`clogPageOfItem` — the boss rather than
 * "All Pets"), because that is what the table stores: `member_clog_items` is unique on
 * (member, item), so filing a pet under both its boss and All Pets makes a whole-log insert fail on
 * the duplicate. Per-page counts for display come from intersecting the stored item ids with the
 * catalogue, which is where a shared item legitimately appears in both places.
 *
 * `unknown` counts ids our catalogue has never heard of — the signal that `npm run data:clog` needs
 * re-running after a game update, rather than something to store.
 */
export function groupObtainedItems(
  items: { id: number; quantity: number }[],
): { pages: Map<string, { itemId: number; quantity: number }[]>; unknown: number } {
  const byId = new Map<number, number>();
  for (const item of items) {
    // Last write wins; a transmit shouldn't repeat an id, but a client that does mustn't produce
    // two rows for it.
    byId.set(item.id, item.quantity);
  }

  const owner = clogPageOfItem();
  const pages = new Map<string, { itemId: number; quantity: number }[]>();
  // Pages with nothing obtained are still returned, empty: "synced and you have none of it" is a
  // real answer, and the caller needs it to clear rows a re-sync no longer justifies.
  for (const page of Object.keys(raw.activities ?? {})) pages.set(page, []);

  let unknown = 0;
  for (const [id, quantity] of byId) {
    const page = owner.get(id);
    if (!page) {
      unknown++;
      continue;
    }
    pages.get(page)!.push({ itemId: id, quantity });
  }

  return { pages, unknown };
}


/**
 * Items on one page, in the order the game lists them, each under its display label (`name`) with
 * the in-game name alongside (`gameName`). Empty for an unknown page.
 */
export function clogPageItems(page: string): ClogItem[] {
  pageItemsCache ??= new Map();
  const hit = pageItemsCache.get(page);
  if (hit) return hit;
  const items = (raw.activities?.[page] ?? []).map((i) => ({ id: i.id, name: i.label ?? i.name, gameName: i.name }));
  if (raw.activities?.[page]) pageItemsCache.set(page, items);
  return items;
}

/** Total obtainable slots in the whole log — the denominator on a profile header. */
export function clogTotalSlots(): number {
  let total = 0;
  for (const items of Object.values(raw.activities ?? {})) total += items.length;
  return total;
}
