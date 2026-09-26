// "What should I buy next?" — an upgrade route from a reader's gear toward a guide's setups. PURE.
//
// Candidates are the items the guide's own setups use for the same combat style (a guide already
// says what is worth having; the route orders it for THIS reader). Each step is the single swap that
// buys the most DPS per coin, applied, then the next — so the list reads as a shopping order, with
// the running cost and DPS after each purchase. Items with no GE price (quest, minigame and raid
// rewards) can't be ranked by cost; they are listed apart, by DPS gained.

import { bestStyle, type GearItem, type ItemLookup, type Loadout, type Monster } from './engine';
import { stylesFor, type Slot } from './tables';
import type { GearSetup } from '../guideTiers';

export interface RouteStep {
  item: GearItem;
  slot: Slot;
  price: number | null;
  gain: number;
  dpsAfter: number;
  totalCost: number;
}

export interface Route {
  start: number;
  steps: RouteStep[];
  /** Untradeable upgrades, each measured alone against the reader's current gear. */
  untradeable: { item: GearItem; slot: Slot; gain: number }[];
}

const kindOf = (weapon: GearItem | null, style: number) => {
  const st = stylesFor(weapon?.c)[style] ?? stylesFor(weapon?.c)[0];
  return st.type === 'magic' ? 'magic' : st.type === 'ranged' ? 'ranged' : 'melee';
};

/** Put `item` on, the way a player would: a weapon brings its setup's ammo/darts/spell along. */
function wear(loadout: Loadout, item: GearItem, kit: GearSetup | undefined, items: ItemLookup): Loadout {
  const slot = item.s as Slot;
  const gear = { ...loadout.gear, [slot]: item.id };
  let next: Loadout = { ...loadout, gear };
  if (slot === 'weapon') {
    if (item.h2) delete gear.shield;
    if (kit) {
      if (kit.gear.ammo != null) gear.ammo = kit.gear.ammo;
      next = { ...next, spell: kit.spell ?? next.spell, dart: kit.dart ?? next.dart };
    }
  }
  if (slot === 'shield' && items(gear.weapon)?.h2) delete gear.weapon;
  return next;
}

function dpsOf(l: Loadout, monster: Monster, items: ItemLookup): { dps: number; style: number } {
  const b = bestStyle(l, monster, items);
  return b ? { dps: b.result.dps, style: b.index } : { dps: 0, style: l.style };
}

export function upgradeRoute(
  current: Loadout,
  setups: GearSetup[],
  monster: Monster,
  items: ItemLookup,
  prices: Record<number, number>,
  maxSteps = 10,
): Route {
  const myKind = kindOf(items(current.gear.weapon), current.style);
  const same = setups.filter((s) => kindOf(items(s.gear.weapon), s.style) === myKind);
  // Candidate items, each remembering the setup it came from (for a weapon's ammo and spell).
  const candidates = new Map<number, { item: GearItem; kit: GearSetup }>();
  for (const s of same) {
    for (const id of Object.values(s.gear)) {
      const it = items(id);
      if (it && !candidates.has(it.id)) candidates.set(it.id, { item: it, kit: s });
    }
  }

  let loadout = { ...current, ...dpsOfStyle(current, monster, items) };
  const start = dpsOf(loadout, monster, items).dps;
  let dps = start;
  let total = 0;
  const steps: RouteStep[] = [];
  const owned = () => new Set(Object.values(loadout.gear));

  for (let n = 0; n < maxSteps; n++) {
    let best: { c: { item: GearItem; kit: GearSetup }; next: Loadout; dps: number; score: number } | null = null;
    const have = owned();
    for (const c of candidates.values()) {
      const price = prices[c.item.id];
      if (price == null || have.has(c.item.id)) continue;
      const next = wear(loadout, c.item, c.kit, items);
      const r = dpsOf(next, monster, items);
      const gain = r.dps - dps;
      if (gain <= 0.001) continue;
      const score = gain / Math.max(price, 1);
      if (!best || score > best.score) best = { c, next: { ...next, style: r.style }, dps: r.dps, score };
    }
    if (!best) break;
    const price = prices[best.c.item.id];
    total += price;
    steps.push({ item: best.c.item, slot: best.c.item.s as Slot, price, gain: best.dps - dps, dpsAfter: best.dps, totalCost: total });
    loadout = best.next;
    dps = best.dps;
  }

  const have = new Set(Object.values(current.gear));
  const untradeable = [...candidates.values()]
    .filter((c) => prices[c.item.id] == null && !have.has(c.item.id))
    .map((c) => ({ item: c.item, slot: c.item.s as Slot, gain: dpsOf(wear(current, c.item, c.kit, items), monster, items).dps - start }))
    .filter((u) => u.gain > 0.001)
    .sort((a, b) => b.gain - a.gain);

  return { start, steps, untradeable };
}

function dpsOfStyle(l: Loadout, monster: Monster, items: ItemLookup): { style: number } {
  return { style: dpsOf(l, monster, items).style };
}
