// Does the monster a drop tile is restricted to actually drop the item?
//
// A drop tile with "only from Zulrah" on an item Zulrah never drops can never complete, and nobody
// finds out until the event is running. This looks each named source up in the wiki drop tables
// (npcDrops, `npm run data:drops`) and reports the items missing from it.
//
// Only sources the tables know are checked. Raids, chests, clue caskets and minigames aren't in
// them, so a tile restricted to "Chambers of Xeric" is never flagged. Server-side only: the
// dataset is too big to ship to the browser.

import npcDrops from '@/data/npcDrops.json';

type DropEntry = { i: number };

export interface DropSourceMiss {
  /** The source as the tile names it. */
  source: string;
  /** Tracked item ids that source doesn't drop. */
  missing: number[];
}

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Source name → item ids it drops. Variants ("Vorkath#Post-quest") fold into their base name.
let index: Map<string, Set<number>> | null = null;
function dropIndex(): Map<string, Set<number>> {
  if (index) return index;
  index = new Map();
  for (const [key, drops] of Object.entries(npcDrops as unknown as Record<string, DropEntry[]>)) {
    const name = norm(key.split('#')[0]);
    const ids = index.get(name) ?? new Set<number>();
    for (const d of drops) if (typeof d?.i === 'number') ids.add(d.i);
    index.set(name, ids);
  }
  return index;
}

/** Whether the drop tables have this source at all. */
export function knownDropSource(source: string): boolean {
  return dropIndex().has(norm(source));
}

/**
 * For each named source the tables know, the items it doesn't drop. Empty when everything checks
 * out or nothing could be checked. The noted form (id + 1) counts as the item.
 */
export function checkDropSources(itemIds: number[], sources: string[]): DropSourceMiss[] {
  const out: DropSourceMiss[] = [];
  if (itemIds.length === 0) return out;
  for (const source of sources) {
    const drops = dropIndex().get(norm(source));
    if (!drops) continue;
    const missing = itemIds.filter((id) => !drops.has(id) && !drops.has(id + 1));
    if (missing.length > 0) out.push({ source: source.trim(), missing });
  }
  return out;
}

/**
 * The tile-level verdict. With several sources the tile completes if ANY of them drops the item,
 * so an item only counts as unobtainable when every known source is missing it, and no named
 * source is outside the tables (that one might drop it).
 */
export function unobtainableItems(itemIds: number[], sources: string[]): number[] {
  const named = sources.map((s) => s.trim()).filter(Boolean);
  if (named.length === 0 || named.some((s) => !knownDropSource(s))) return [];
  const misses = checkDropSources(itemIds, named);
  if (misses.length < named.length) return [];
  return itemIds.filter((id) => misses.every((m) => m.missing.includes(id)));
}
