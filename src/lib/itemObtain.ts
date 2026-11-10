// How players come by an item — the one question the tile creator asks about items ("they land in
// the inventory" vs "a monster drops them"), answered from the datasets so the likely reading is
// pre-picked. Server-side only: the drop tables are ~800KB and never ship to the client.
//
//   • on a monster's drop table, a raid's reward chest, or a pet → a DROP tile (the plugin credits
//     the loot event, pets included — duplicates too);
//   • anything else (reward searches, gathering, minigame shops, currencies) → an ITEM GAIN tile,
//     counted as it lands in the inventory.
//
// No database: tests and the matcher can use it directly.

import clogData from '@/data/clog.json';
import droppableData from '@/data/droppableItems.json';
import npcDrops from '@/data/npcDrops.json';
import raidRewards from '@/data/raidRewards.json';
import { PET_GROUPS } from '@/lib/petGroups';
import type { MatchItem } from '@/lib/taskMatch';

let monsterIds: Set<number> | null = null;
function monsterDropIds(): Set<number> {
  if (monsterIds) return monsterIds;
  const ids = new Set<number>((droppableData as { combat?: number[] }).combat ?? []);
  const clog = clogIds();
  // Raid chests: only their collection-log uniques — the chest's runes and herbs are not what a
  // tile about "a Twisted bow" means.
  for (const raid of Object.values(raidRewards as Record<string, { items: { i: number }[] }>)) {
    for (const it of raid.items) if (clog.has(it.i)) ids.add(it.i);
  }
  for (const group of PET_GROUPS) for (const it of group.items) ids.add(it.id);
  monsterIds = ids;
  return ids;
}

let clogIdSet: Set<number> | null = null;
let pageByItem: Map<number, string> | null = null;
function clogIds(): Set<number> {
  if (!clogIdSet) {
    clogIdSet = new Set<number>();
    pageByItem = new Map();
    for (const [page, its] of Object.entries(clogActivities())) {
      for (const it of its) {
        clogIdSet.add(it.id);
        if (!pageByItem.has(it.id)) pageByItem.set(it.id, page);
      }
    }
  }
  return clogIdSet;
}

// Same-name slots ("Decorative armour" ×15) carry their wiki label, so each is its own pick.
let activitiesCache: Record<string, MatchItem[]> | null = null;
function clogActivities(): Record<string, MatchItem[]> {
  if (activitiesCache) return activitiesCache;
  const raw = (clogData as { activities?: Record<string, { id: number; name: string; label?: string }[]> }).activities ?? {};
  activitiesCache = Object.fromEntries(
    Object.entries(raw).map(([page, items]) => [page, items.map((it) => ({ id: it.id, name: it.label ?? it.name }))]),
  );
  return activitiesCache;
}

/** The collection-log pages, for "any GOTR reward" style tasks. "All Pets" is a page too. */
export function clogPages(): { name: string; items: MatchItem[] }[] {
  return Object.entries(clogActivities()).map(([name, items]) => ({ name, items }));
}

/** True when a monster (or a raid chest) drops it, or it is a pet. */
export function isMonsterDrop(id: number): boolean {
  return monsterDropIds().has(id);
}

let sourcesByItem: Map<number, { npc: string; d: number }[]> | null = null;
/** The monsters that drop an item, likeliest first (lowest 1-in-N). */
export function dropSourcesFor(id: number, limit = 6): string[] {
  if (!sourcesByItem) {
    sourcesByItem = new Map();
    for (const [npc, rows] of Object.entries(npcDrops as Record<string, { i: number; d: number }[]>)) {
      for (const r of rows) {
        const list = sourcesByItem.get(r.i) ?? [];
        const prev = list.find((x) => x.npc === npc);
        if (prev) prev.d = Math.min(prev.d, r.d);
        else list.push({ npc, d: r.d });
        sourcesByItem.set(r.i, list);
      }
    }
  }
  return (sourcesByItem.get(id) ?? []).slice().sort((a, b) => a.d - b.d).slice(0, limit).map((s) => s.npc);
}

export interface ItemObtainInfo {
  id: number;
  /** A monster / raid chest drops it, or it is a pet → "a monster drops them". */
  monster: boolean;
  pet: boolean;
  /** Top monster sources (empty for rewards and gathered items). */
  sources: string[];
  /** The collection-log page it sits on, if any. */
  clogPage: string | null;
}

const PET_IDS = new Set(PET_GROUPS.flatMap((g) => g.items.map((i) => i.id)));

export function itemObtainInfo(id: number): ItemObtainInfo {
  clogIds();
  return {
    id,
    monster: isMonsterDrop(id),
    pet: PET_IDS.has(id),
    sources: dropSourcesFor(id),
    clogPage: pageByItem?.get(id) ?? null,
  };
}

/** The whole page's items, for "+ All <page> items". */
export function clogPageItems(page: string): MatchItem[] {
  return clogActivities()[page] ?? [];
}
