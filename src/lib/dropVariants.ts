// Which variant of an item actually drops?
//
// A lot of endgame uniques drop in a different state from the one people know them by: Tumeken's
// shadow and the Scythe come out of the chest uncharged, the Eye of Ayak too, a Kraken's trident
// arrives full. The charged item is a separate id that nothing ever drops, and the plugin credits
// drop tiles by id — so a tile built on "Tumeken's shadow" can never complete, and nobody finds out
// until someone gets one mid-event. The picker's Drops-only list hides those ids, but CSV imports,
// library boards, typed ids and the toggle all let them in.
//
// Data-driven rather than a list: an item that doesn't drop, whose name differs from a droppable
// item's only by a trailing "(…)" state or a leading "Uncharged", is that item in another state.
// "Corrupted tumeken's shadow (uncharged)" stays a different item — its base name is different.

import { getItemMapping, isDroppableItem, type MappingItem } from '@/lib/osrsItems';

// The states an item drops in that its everyday form doesn't carry. Only these count as "the same
// item": "Reward casket (master)" vs "(elite)" or "Rainbow crab (3)" vs "(1)" are different items
// that happen to share a stem, and poisoned "(p++)" weapons are made, not dropped.
const STATE = '(?:uncharged|broken|inactive|empty|full|damaged)';
const STATE_SUFFIX = new RegExp(`\\s*\\(${STATE}\\)`, 'g');
const STATE_PREFIX = new RegExp(`^${STATE}\\s+`);

// "Tumeken's shadow (uncharged)" → "tumeken's shadow"; "Uncharged trident" → "trident". Other
// parentheticals stay: "Trident of the Seas (e)" is not the Kraken's "(full)" drop.
function baseName(name: string): string {
  return name.trim().toLowerCase().replace(STATE_SUFFIX, '').replace(STATE_PREFIX, '').trim();
}

// When several droppable variants share a base name, the one named for a state is the drop.
const STATE_WORDS = new RegExp(`\\b${STATE}\\b`);

// base name → the droppable items carrying it, one per distinct name (the lowest id, which skips
// the noted copy). Rebuilt when the mapping cache is.
let index: { from: MappingItem[]; byBase: Map<string, MappingItem[]> } | null = null;

function variantIndex(mapping: MappingItem[]): Map<string, MappingItem[]> {
  if (index && index.from === mapping) return index.byBase;
  const byName = new Map<string, MappingItem>();
  for (const it of mapping) {
    if (!isDroppableItem(it)) continue;
    const key = it.name.toLowerCase();
    const cur = byName.get(key);
    if (!cur || it.id < cur.id) byName.set(key, it);
  }
  const byBase = new Map<string, MappingItem[]>();
  for (const it of byName.values()) {
    const b = baseName(it.name);
    const list = byBase.get(b) ?? [];
    list.push(it);
    byBase.set(b, list);
  }
  for (const list of byBase.values()) {
    list.sort((a, b) => Number(STATE_WORDS.test(b.name.toLowerCase())) - Number(STATE_WORDS.test(a.name.toLowerCase())) || a.id - b.id);
  }
  index = { from: mapping, byBase };
  return byBase;
}

/** The droppable variant of an item that doesn't drop itself, or null (it drops, or nothing close does). */
export function dropVariantIn(mapping: MappingItem[], item: MappingItem): MappingItem | null {
  if (isDroppableItem(item)) return null;
  const candidates = variantIndex(mapping).get(baseName(item.name)) ?? [];
  return candidates.find((c) => c.id !== item.id) ?? null;
}

/**
 * For each id that doesn't drop but has a variant that does: id → that variant. Ids the mapping
 * doesn't know are skipped — nothing to compare a name against. Empty when the mapping is out.
 */
export async function dropVariants(ids: number[]): Promise<Record<number, MappingItem>> {
  const out: Record<number, MappingItem> = {};
  if (ids.length === 0) return out;
  let mapping: MappingItem[];
  try {
    mapping = await getItemMapping();
  } catch {
    return out;
  }
  const want = new Set(ids);
  for (const it of mapping) {
    if (!want.has(it.id) || out[it.id]) continue;
    const v = dropVariantIn(mapping, it);
    if (v) out[it.id] = { id: v.id, name: v.name };
  }
  return out;
}
