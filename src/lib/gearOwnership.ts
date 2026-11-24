// What a player owns, against what a setup asks for. PURE — the item equivalences come in as a
// function, so the server can build them from lib/itemVariants (server-only) and the tests from a map.
//
// OWNERSHIP = BANK + INVENTORY + WORN (+ the looting bag when known). An item the player is wearing
// is not missing from their bank; a setup says "Missing (2)" only for items found in none of them.
//
// A SLOT IS A LIST, best first: the slot's own item, then its fallbacks (GearSetup.alts). The player's
// version of a setup takes, per slot, the first item on that list they own and haven't skipped. A slot
// is missing only when nothing on its list is owned. Skipped items (can't afford / don't want) and
// anything over the player's budget cap count as not owned — unless they own it already, which a
// budget can't take away.
//
// EQUIVALENT FORMS count as the same item: charged/uncharged and (i) versions (lib/itemVariants
// groups), plus the cosmetic kits whose names differ (COSMETIC below, ids checked against
// src/data/gearItems.json): a Masori assembler IS an Ava's assembler for this purpose.

import { SLOTS, type Slot } from './dps/tables';
import type { GearSetup, InvItem } from './guideTiers';

/** One container the plugin read (phase 2, POST /api/plugin/items), with when it read it. */
export interface Container {
  items: InvItem[];
  /** ISO time the plugin read it. */
  readAt: string;
}
export type ContainerKind = 'bank' | 'inventory' | 'equipment' | 'lootingBag';
export const CONTAINER_KINDS: ContainerKind[] = ['bank', 'inventory', 'equipment', 'lootingBag'];

export type Snapshot = Partial<Record<ContainerKind, Container>>;

/**
 * Cosmetic / kit versions whose names differ from the base item, so the variant data doesn't group
 * them. Each row: one item and the ids that count as it. Ids from src/data/gearItems.json.
 */
export const COSMETIC: number[][] = [
  [22109, 27374, 21898], // Ava's assembler = Masori assembler = Assembler max cape
  [10499, 13337], // Ava's accumulator = Accumulator max cape
  [28951, 28902], // Dizana's quiver = Dizana's max cape
  [6570, 13329], // Fire cape = Fire max cape
  [21295, 21285], // Infernal cape = Infernal max cape
  [21012, 25916, 25918], // Dragon hunter crossbow = (t) = (b)
  [19553, 20366], // Amulet of torture = (or)
  [19547, 22249], // Necklace of anguish = (or)
  [6585, 12436], // Amulet of fury = (or)
  [12954, 19722], // Dragon defender = (t)
];

/** Each id → the ids that count as it (itself included). */
export type Equivalents = (id: number) => number[];

/** Equivalences from groups (variant groups + COSMETIC), merged transitively per id. */
export function equivalentsFrom(groups: number[][]): Equivalents {
  const map = new Map<number, Set<number>>();
  for (const g of [...groups, ...COSMETIC]) {
    const merged = new Set<number>();
    for (const id of g) for (const x of map.get(id) ?? [id]) merged.add(x);
    for (const id of g) merged.add(id);
    for (const id of merged) map.set(id, merged);
  }
  return (id) => [...(map.get(id) ?? new Set([id]))];
}

/** Every id the player holds, with the total count across containers. */
export function ownedCounts(snap: Snapshot | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const k of CONTAINER_KINDS) {
    for (const it of snap?.[k]?.items ?? []) {
      if (!Number.isInteger(it.id) || it.id <= 0) continue;
      out.set(it.id, (out.get(it.id) ?? 0) + Math.max(1, Math.floor(it.q ?? 1)));
    }
  }
  return out;
}

export interface Prefs {
  /** Items the player chose not to use (reason kept for the undo list). */
  skipped?: Set<number>;
  /** Anything costing more than this counts as skipped unless already owned. Null = no cap. */
  budgetCap?: number | null;
  /** GE prices by id (unknown = never over the cap). */
  prices?: Record<number, number>;
}

export interface Owned {
  has: (id: number) => boolean;
  count: (id: number) => number;
}

/** Ownership through equivalences: holding any form counts. */
export function ownership(counts: Map<number, number>, eq: Equivalents): Owned {
  const count = (id: number) => eq(id).reduce((a, x) => a + (counts.get(x) ?? 0), 0);
  return { has: (id) => count(id) > 0, count };
}

/** May the player use this item: owned, and not skipped (a skip wins even over owning it). */
function usable(id: number, owned: Owned, prefs: Prefs): boolean {
  if (prefs.skipped?.has(id)) return false;
  return owned.has(id);
}

/** Is this item one the player would still be pointed at to get (not skipped, under the cap)? */
export function wanted(id: number, owned: Owned, prefs: Prefs): boolean {
  if (prefs.skipped?.has(id)) return false;
  if (owned.has(id)) return true;
  const cap = prefs.budgetCap;
  const price = prefs.prices?.[id];
  return !(cap != null && price != null && price > cap);
}

export interface SlotPick {
  slot: Slot | 'quiver';
  /** The guide's item for the slot (first on its list). */
  guide: number;
  /** What this player will wear: the best owned on the list, else the best they'd still get. */
  use: number | null;
  /** 'guide' = they own the guide's item · 'fallback' = an owned fallback · 'missing' = nothing owned. */
  kind: 'guide' | 'fallback' | 'missing';
  /** The list, best first. */
  options: number[];
}

/** A slot's list, best first: the setup's item, then its fallbacks (duplicates dropped). */
export function slotOptions(setup: Pick<GearSetup, 'gear' | 'alts' | 'quiver'>, slot: Slot | 'quiver'): number[] {
  const first = slot === 'quiver' ? setup.quiver : setup.gear[slot];
  const alts = setup.alts?.[slot] ?? [];
  const out: number[] = [];
  for (const id of [first, ...alts]) if (typeof id === 'number' && Number.isInteger(id) && id > 0 && !out.includes(id)) out.push(id);
  return out;
}

export interface Resolved {
  /** The player's gear per slot (for the DPS engine and the exports). */
  gear: Record<string, number>;
  quiver: number | null;
  slots: SlotPick[];
  /** Slots where nothing on the list is owned, with the item to get (the best they'd still get). */
  missing: SlotPick[];
  /** Inventory items (supplies) not held in the needed count. */
  missingSupplies: { id: number; need: number; have: number }[];
  /** Fallbacks in use, for "Using 1 fallback: Ava's assembler for Dizana's quiver". */
  fallbacks: SlotPick[];
}

/**
 * The player's version of a setup. With no snapshot at all (logged out, nothing pushed) the guide's
 * own items stand and nothing is called missing — "missing" needs evidence.
 */
export function resolveSetup(setup: GearSetup, snap: Snapshot | null | undefined, eq: Equivalents, prefs: Prefs = {}): Resolved {
  const known = !!snap && CONTAINER_KINDS.some((k) => snap[k]);
  const owned = ownership(ownedCounts(snap), eq);
  const gear: Record<string, number> = {};
  const slots: SlotPick[] = [];
  let quiver: number | null = null;
  for (const slot of [...SLOTS, 'quiver'] as (Slot | 'quiver')[]) {
    const options = slotOptions(setup, slot);
    if (!options.length) continue;
    let use: number | null;
    let kind: SlotPick['kind'];
    if (!known) {
      use = options[0];
      kind = 'guide';
    } else {
      const ownedIdx = options.findIndex((id) => usable(id, owned, prefs));
      if (ownedIdx === 0) {
        use = options[0];
        kind = 'guide';
      } else if (ownedIdx > 0) {
        use = options[ownedIdx];
        kind = 'fallback';
      } else {
        // Nothing owned: show the best one they'd still go for (skips and the cap step past items).
        use = options.find((id) => wanted(id, owned, prefs)) ?? null;
        kind = 'missing';
      }
    }
    slots.push({ slot, guide: options[0], use, kind, options });
    if (use != null) {
      if (slot === 'quiver') quiver = use;
      else gear[slot] = use;
    }
  }
  const need = new Map<number, number>();
  for (const it of setup.inventory ?? []) if (it && it.id > 0) need.set(it.id, (need.get(it.id) ?? 0) + Math.max(1, it.q ?? 1));
  const missingSupplies = known
    ? [...need.entries()].map(([id, n]) => ({ id, need: n, have: owned.count(id) })).filter((x) => x.have < 1)
    : [];
  return {
    gear,
    quiver,
    slots,
    missing: slots.filter((s) => s.kind === 'missing'),
    missingSupplies,
    fallbacks: slots.filter((s) => s.kind === 'fallback'),
  };
}

/** The setup as the player will run it: their items in place of the guide's (for exports and DPS). */
export function personalSetup(setup: GearSetup, r: Resolved): GearSetup {
  return { ...setup, gear: r.gear, quiver: r.quiver };
}
