// The ids the game gives one item under (data/itemVariants.json, scripts/build-item-variants.mjs).
// A tile tracking one of them counts them all: Pyramid Plunder's sceptre lands as 26950 while the
// picker stored 9044, the old sceptre that still carries the name. Server-side only (~95KB).
//
// Collection-log slots that share a name ("Decorative armour" ×15) are separate slots, never one
// item: none of them widens, and none joins another id's group.

import clogData from '@/data/clog.json';
import variantData from '@/data/itemVariants.json';
import npcDrops from '@/data/npcDrops.json';

let groupOf: Map<number, number[]> | null = null;
let clogShared: Set<number> | null = null;
let droppedBy: Map<number, Set<string>> | null = null;

function load() {
  if (groupOf) return;
  groupOf = new Map();
  for (const g of (variantData as { groups: number[][] }).groups) for (const id of g) groupOf.set(id, g);
  const byName = new Map<string, number[]>();
  for (const items of Object.values((clogData as { activities?: Record<string, { id: number; name: string }[]> }).activities ?? {})) {
    for (const it of items) {
      const k = it.name.toLowerCase();
      const ids = byName.get(k) ?? [];
      if (!ids.includes(it.id)) ids.push(it.id);
      byName.set(k, ids);
    }
  }
  // Slots whose in-game name another slot shares: each is its own item.
  clogShared = new Set([...byName.values()].filter((ids) => ids.length > 1).flat());
  droppedBy = new Map();
  for (const [npc, rows] of Object.entries(npcDrops as Record<string, { i: number }[]>)) {
    for (const r of rows) {
      const s = droppedBy.get(r.i) ?? new Set<string>();
      s.add(npc);
      droppedBy.set(r.i, s);
    }
  }
}

/**
 * Two ids monsters drop, from no monster in common: different items under one name (a quest's
 * "Key"s, the tribal mask colours), or one item each source gives in its own form, which a tile
 * means apart (a cave kraken's uncharged trident is not the Kraken's charged one).
 */
function apart(a: number, b: number): boolean {
  const sa = droppedBy!.get(a);
  const sb = droppedBy!.get(b);
  if (!sa || !sb) return false;
  for (const n of sa) if (sb.has(n)) return false;
  return true;
}

/** Every id the tracked ones stand for, the tracked ones first. */
export function withItemVariants(ids: readonly number[]): number[] {
  load();
  const out = [...ids];
  const seen = new Set(ids);
  for (const id of ids) {
    // A shared-name log slot means only itself.
    if (clogShared!.has(id)) continue;
    for (const v of groupOf!.get(id) ?? []) {
      if (seen.has(v) || clogShared!.has(v) || apart(id, v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
