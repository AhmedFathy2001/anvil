// Which items count as the same piece of gear: one shared rule for "do they own it" (lib/gearOwnership
// via equivalentsFor) and "are they wearing it" (lib/guideSetupMatch via lib/guideAutoUsed).
//
// THE RULE: an item and its COSMETIC variants are one family, either way round: same slot, same
// bonuses (Twisted ancestral robe top is an Ancestral robe top). So are stat twins (statTwins): same
// slot, bonuses and kind under another name (Blazing blowpipe, the imbued god capes). An UPGRADE — imbued or fortified,
// (i) (ei) (f) (e), with better bonuses — is a different item (Masori body (f) is not Masori body):
// holding it covers a guide that asks for the plain one, never the reverse. Built from the bundled
// gear data (src/data/gearItems.json, the wiki's equipment bonuses), so new kits join without a hand list:
//
//   - a parenthesised tag on the same slot with the same bonuses: ornament kits (or), trims (t)/(g),
//     locked (l), heraldic and god kits, broken-and-repaired (bh)… A (Deadman) reward copy on the
//     same slot counts whatever its bonuses (COPY_TAG).
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
  /** Attack speed, two-handed, combat style, defence total: two items alike in every one are interchangeable. */
  sp?: number;
  h2?: number;
  c?: string;
  df?: number;
}

/** Tags that make an item better than its base and still count as it (imbued, fortified, enchanted). */
const UPGRADE_TAGS = new Set(['i', 'ei', 'f', 'e']);
const TAG_RE = /^(.*?)\s*\(([^()]{1,24})\)$/;
/** A Deadman reward copy ("Imbued Zamorak cape (Deadman)", "… (Deadman Mode)") is the item it copies, whatever the wiki lists for it. */
const COPY_TAG = /^deadman( mode)?$/;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const atLeast = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x >= b[i]);

/** The item `variant` is a form of, from the names and bonuses alone, or null. */
export function variantBase(variant: GearEntry, byName: Map<string, GearEntry>): GearEntry | null {
  if (variant.s === 'ammo') return null;
  const name = variant.n.trim().toLowerCase();
  const ok = (base: GearEntry | undefined): base is GearEntry => !!base && base.id !== variant.id && base.s === variant.s && same(variant.b, base.b);
  const m = TAG_RE.exec(name);
  if (m) {
    const base = byName.get(m[1].trim());
    const copy = COPY_TAG.test(m[2].trim()) && !!base && base.id !== variant.id && base.s === variant.s;
    if (copy || ok(base)) return base!;
  }
  const words = name.split(/\s+/);
  for (const k of [1, 2]) {
    if (words.length <= k) break;
    const base = byName.get(words.slice(k).join(' '));
    if (ok(base)) return base;
  }
  return null;
}

/** The plain item an upgrade (imbued, fortified: a tag and better bonuses) is made from, or null. */
export function upgradeOf(item: GearEntry, byName: Map<string, GearEntry>): GearEntry | null {
  if (item.s === 'ammo') return null;
  const m = TAG_RE.exec(item.n.trim().toLowerCase());
  if (!m || !UPGRADE_TAGS.has(m[2].trim())) return null;
  const base = byName.get(m[1].trim());
  return base && base.id !== item.id && base.s === item.s && atLeast(item.b, base.b) && !same(item.b, base.b) ? base : null;
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

/**
 * Stat twins: the same slot, the same bonuses (none of them all zero) and the same kind of item, the
 * name's last word: Blazing blowpipe is a Toxic blowpipe, and the imbued god capes and their max capes
 * are one cape. Different names, one item for a guide. Ammo is left out (enchanted bolts).
 */
export function statTwins(items: readonly GearEntry[]): number[][] {
  const groups = new Map<string, number[]>();
  for (const it of items) {
    if (it.s === 'ammo' || !it.b.some((x) => x !== 0)) continue;
    const kind = it.n.trim().toLowerCase().replace(/\s*\([^()]*\)$/, '').split(/\s+/).pop();
    const key = [it.s, kind, it.b.join(','), it.sp ?? '', it.h2 ?? '', it.c ?? '', it.df ?? ''].join('|');
    groups.set(key, [...(groups.get(key) ?? []), it.id]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

let familyOf: Map<number, number[]> | null = null;
/** Each id's kit family only (no stat twins): what the Missing list names it by. */
let kitOf: Map<number, number[]> | null = null;
let nameOf: Map<number, string> | null = null;
/** Plain id → the upgrades made from it; upgrade id → the plain ids it covers. */
const ups = new Map<number, number[]>();
const downs = new Map<number, number[]>();

function load() {
  if (familyOf) return;
  const items = (gearData as unknown as { items: GearEntry[] }).items;
  familyOf = new Map();
  kitOf = new Map();
  nameOf = new Map(items.map((x) => [x.id, x.n]));
  for (const g of itemFamilies(items)) for (const id of g) kitOf.set(id, g);
  // Kits and twins merged: a twin of a kitted item brings its kits too.
  for (const g of [...itemFamilies(items), ...statTwins(items)]) {
    const merged = new Set<number>();
    for (const id of g) for (const x of familyOf.get(id) ?? [id]) merged.add(x);
    const all = [...merged];
    for (const id of all) familyOf.set(id, all);
  }
  const byName = new Map(items.map((x) => [x.n.trim().toLowerCase(), x]));
  for (const it of items) {
    const base = upgradeOf(it, byName);
    if (!base) continue;
    ups.set(base.id, [...(ups.get(base.id) ?? []), it.id]);
    downs.set(it.id, [...(downs.get(it.id) ?? []), base.id]);
  }
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
  const g = kitOf!.get(id);
  if (!g) return nameOf!.has(id) ? { id, name: nameOf!.get(id)! } : null;
  const best = [...g].sort((a, b) => nameOf!.get(a)!.length - nameOf!.get(b)!.length || a - b)[0];
  return { id: best, name: nameOf!.get(best)! };
}

/**
 * Item equivalences for a set of ids: each id's cosmetic family, every member widened to all its game
 * ids, plus the cosmetic kits — and the upgrades, one way only. `needs` (ownership: what counts as
 * having X) adds X's upgrades: Masori body (f) covers Masori body. `holds` (worn gear: what holding X
 * counts as) adds what X was upgraded from. Never the reverse: plain Masori is not Masori (f).
 */
export function equivalentsFor(ids: readonly number[], dir: 'needs' | 'holds' = 'needs'): Equivalents {
  load();
  const edge = dir === 'needs' ? ups : downs;
  const groups: number[][] = [];
  const extra = new Map<number, number[]>();
  for (const id of new Set(ids)) {
    if (!Number.isInteger(id) || id <= 0) continue;
    const fam = familyIds(id);
    groups.push(withItemVariants(fam));
    const more = fam.flatMap((x) => edge.get(x) ?? []);
    if (more.length) extra.set(id, more);
  }
  const same = equivalentsFrom(groups);
  const wide = (x: number) => withItemVariants(familyIds(x));
  return (id) => {
    const out = new Set(same(id));
    for (const m of [...out].flatMap((x) => extra.get(x) ?? [])) for (const x of wide(m)) out.add(x);
    return [...out];
  };
}
