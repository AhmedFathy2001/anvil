// Which items count as the same piece of gear: one shared rule for "do they own it" (lib/gearOwnership
// via equivalentsFor) and "are they wearing it" (lib/guideSetupMatch via lib/guideAutoUsed).
//
// THE RULE: an item and its variants are one family. Holding a variant counts as holding the base
// (Twisted ancestral robe top is an Ancestral robe top), and a variant a guide names never counts as
// something to buy when the base or another variant is held. Built from the bundled gear data
// (src/data/gearItems.json, the wiki's equipment bonuses), so new kits join without a hand list:
//
//   - a parenthesised tag on the same slot with the same bonuses: ornament kits (or), trims (t)/(g),
//     locked (l), heraldic and god kits, broken-and-repaired (bh)…
//   - an imbued or fortified tag, (i) (ei) (f) (e), whose bonuses are the base's or better
//   - one or two words in front on the same slot with the same bonuses: recolours and cosmetic kits
//     (Twisted ancestral, Sanguine torva, Volcanic abyssal whip, Black slayer helmet, Blessed Dizana's quiver)
//
// Families chain (Black slayer helmet (i) → Black slayer helmet → Slayer helmet). Ammunition is left
// out: enchanted and poisoned ammo are different items with the same bonuses. Each id then widens
// to every id the game gives it under (lib/itemVariants: charged/uncharged, noted, placeholders) and
// the kits whose names differ (gearOwnership COSMETIC: max capes, the assembler).
//
// Server-side only: it reads the variant data (~95KB). The rule itself, itemFamilies, is pure.

import gearData from '@/data/gearItems.json';
import { equivalentsFrom, type Equivalents } from '@/lib/gearOwnership';
import { withItemVariants } from '@/lib/itemVariants';

/** One wiki equipment entry as the gear data stores it: id, name, slot, bonuses. */
export interface GearEntry {
  id: number;
  n: string;
  s: string;
  b: number[];
}

/** Tags that make an item better than its base and still count as it (imbued, fortified, enchanted). */
const UPGRADE_TAGS = new Set(['i', 'ei', 'f', 'e']);
const TAG_RE = /^(.*?)\s*\(([^()]{1,24})\)$/;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const atLeast = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x >= b[i]);

/** The item `variant` is a form of, from the names and bonuses alone, or null. */
export function variantBase(variant: GearEntry, byName: Map<string, GearEntry>): GearEntry | null {
  if (variant.s === 'ammo') return null;
  const name = variant.n.trim().toLowerCase();
  const ok = (base: GearEntry | undefined, tag: string | null): base is GearEntry =>
    !!base && base.id !== variant.id && base.s === variant.s && (same(variant.b, base.b) || (tag !== null && UPGRADE_TAGS.has(tag) && atLeast(variant.b, base.b)));
  const m = TAG_RE.exec(name);
  if (m) {
    const base = byName.get(m[1].trim());
    if (ok(base, m[2].trim())) return base;
  }
  const words = name.split(/\s+/);
  for (const k of [1, 2]) {
    if (words.length <= k) break;
    const base = byName.get(words.slice(k).join(' '));
    if (ok(base, null)) return base;
  }
  return null;
}

/** Every family of two or more gear ids (a base and its variants), merged through chains. */
export function itemFamilies(items: readonly GearEntry[]): number[][] {
  const byName = new Map(items.map((x) => [x.n.trim().toLowerCase(), x]));
  const parent = new Map<number, number>();
  const find = (id: number): number => {
    let r = id;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(id, r);
    return r;
  };
  for (const it of items) {
    const base = variantBase(it, byName);
    if (base) parent.set(find(it.id), find(base.id));
  }
  const groups = new Map<number, number[]>();
  for (const it of items) {
    if (!parent.has(it.id)) continue;
    const r = find(it.id);
    groups.set(r, [...(groups.get(r) ?? []), it.id]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

let familyOf: Map<number, number[]> | null = null;
let nameOf: Map<number, string> | null = null;

function load() {
  if (familyOf) return;
  const items = (gearData as unknown as { items: GearEntry[] }).items;
  familyOf = new Map();
  nameOf = new Map(items.map((x) => [x.id, x.n]));
  for (const g of itemFamilies(items)) for (const id of g) familyOf.set(id, g);
}

/** The ids in `id`'s family (itself first), before the game's other ids for each. */
export function familyIds(id: number): number[] {
  load();
  const g = familyOf!.get(id);
  return g ? [id, ...g.filter((x) => x !== id)] : [id];
}

/** The plain item a variant is a form of (the family member with the shortest name), with its name. */
export function baseItem(id: number): { id: number; name: string } | null {
  load();
  const g = familyOf!.get(id);
  if (!g) return nameOf!.has(id) ? { id, name: nameOf!.get(id)! } : null;
  const best = [...g].sort((a, b) => nameOf!.get(a)!.length - nameOf!.get(b)!.length || a - b)[0];
  return { id: best, name: nameOf!.get(best)! };
}

/**
 * Item equivalences for a set of ids: each id's family, every member widened to all its game ids,
 * plus the cosmetic kits. Ownership asks "what counts as X" and the worn-gear match asks "what does
 * holding X count as" — the families are symmetric, so one answer serves both.
 */
export function equivalentsFor(ids: readonly number[]): Equivalents {
  const groups: number[][] = [];
  for (const id of new Set(ids)) {
    if (!Number.isInteger(id) || id <= 0) continue;
    groups.push(withItemVariants(familyIds(id)));
  }
  return equivalentsFrom(groups);
}
