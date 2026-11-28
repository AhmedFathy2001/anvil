// "Your version (from what you own)": a guide setup rebuilt from the reader's own bank, inventory and
// worn gear. PURE — the gear data, equivalences, names and prices come in, so the guide page, the
// plugin's guide view and the tests share it. Owner-only data: it only ever runs on the signed-in
// owner's own snapshot (lib/playerItems snapshotForViewer).
//
// PER SLOT, in order (lib/gearOwnership resolveSetup does 1, 2 and 4; this adds 3 and upgrades):
//   1. the guide's item, when they own it (any form of it: lib/itemFamilies 'needs')
//   2. else the guide's own fallbacks for the slot, best first, when owned
//   3. else the best item THEY own for the slot, by the DPS engine against the guide's monster with
//      the rest of their version worn: same combat kind, ammo the weapon fires (arrows for a bow,
//      bolts for a crossbow), no shield beside a two-handed weapon, the quiver's ammo only with a
//      quiver on. Ties go to the cheaper item. Never a restricted copy (lib/restrictedItems), never a
//      skipped item, never a hidden one.
//   4. else empty, and listed as missing.
// UPGRADES: a slot they fill with the guide's item (or a fallback) takes an item of theirs that gives
// more DPS than the guide's item — labelled 'upgrade'. The weapon is never upgraded (it is the setup),
// and protective/utility picks (anti-dragon shields, slayer helms, recoil rings…) are never swapped
// for DPS: they stay, or stay missing.
// SUPPLIES: an unowned supply takes an owned stand-in — another dose or charge count, the same potion
// family, food that heals about as much, another way to the same teleport — else stays missing.

import type { GearItem, Monster } from './dps/engine';
import { SLOTS, type Slot } from './dps/tables';
import type { GearIndex } from './dps/summary';
import { setupResult, withSlot } from './gearNow';
import { ownedCounts, ownership, type Equivalents, type Prefs, type Resolved, type SlotPick, type Snapshot, type SupplyPick } from './gearOwnership';
import type { GearSetup, InvItem } from './guideTiers';
import { isRestricted } from './restrictedItems';
import { ammoFits } from './tripCheck';

/** Dizana's quiver (and its blessed form and max cape): the second ammo slot. */
export const QUIVER_CAPES = [28951, 28947, 28902];

/** Guide picks kept for what they do, not their DPS: never swapped out for a DPS upgrade or stand-in. */
const PROTECTIVE = /anti-dragon|dragonfire|wyvern shield|mirror shield|earmuffs|facemask|nose peg|spiny helmet|slayer helmet|black mask|insulated boots|witchwood icon|bug lantern|ring of recoil|ring of suffering|ring of wealth|explorer's ring|graceful/i;

/** A gain smaller than this is no reason to change the guide's pick. */
const MIN_GAIN = 0.005;

export interface OwnedPool {
  /** Owned gear the calc may use, by gear-data slot ('2h' as 'weapon'). */
  bySlot: Map<Slot, GearItem[]>;
}

const slotOf = (it: GearItem): Slot | null => {
  const s = it.s === '2h' ? 'weapon' : it.s;
  return (SLOTS as readonly string[]).includes(s) ? (s as Slot) : null;
};

/**
 * The owned gear the calc may pick from: each held id as the gear data knows it (itself, or a form of
 * it the data holds through `holds`), minus restricted copies, hidden entries and skipped items.
 */
export function ownedPool(snap: Snapshot | null | undefined, idx: Pick<GearIndex, 'item'>, holds: Equivalents, name: (id: number) => string | undefined, prefs: Prefs = {}): OwnedPool {
  const bySlot = new Map<Slot, GearItem[]>();
  const seen = new Set<number>();
  for (const raw of ownedCounts(snap).keys()) {
    if (prefs.skipped?.has(raw) || isRestricted(name(raw))) continue;
    const known = idx.item(raw) ? raw : holds(raw).find((x) => idx.item(x));
    if (known == null || seen.has(known)) continue;
    const it = idx.item(known)!;
    if (it.hid || isRestricted(it.n) || prefs.skipped?.has(known)) continue;
    const slot = slotOf(it);
    if (!slot) continue;
    seen.add(known);
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), it]);
  }
  return { bySlot };
}

export interface YourVersionCtx {
  idx: GearIndex;
  /** The guide's monster (null: no DPS, so only the guide's lists and supplies apply). */
  monster: Monster | null;
  pool: OwnedPool;
  snapshot: Snapshot;
  /** Ownership equivalences ('needs'), as resolveSetup took. */
  needs: Equivalents;
  name: (id: number) => string | undefined;
  price: (id: number) => number | undefined;
}

type Gear = Record<string, number>;

/** Each slot's likeliest few items for one kind of attack, by the bonuses that kind reads. */
function shortlist(list: GearItem[], kind: 'melee' | 'ranged' | 'magic', n = 8): GearItem[] {
  const score = (b: number[]) => (kind === 'melee' ? Math.max(b[0], b[1], b[2]) + 1.5 * b[5] : kind === 'ranged' ? b[4] + 1.5 * b[6] : b[3] + 3 * b[7]);
  return [...list].sort((a, b) => score(b.b) - score(a.b)).slice(0, n);
}

/** The player's version of `setup`, from resolveSetup's result and what they own. */
export function yourVersion(setup: GearSetup, resolved: Resolved, ctx: YourVersionCtx): Resolved {
  const supplies = yourSupplies(setup.inventory ?? [], ctx.snapshot, ctx.needs, ctx.name);
  const withSupplies = (r: Resolved): Resolved => ({ ...r, supplies, missingSupplies: supplies.filter((s) => s.kind === 'missing').map((s) => ({ id: s.id, need: need(setup.inventory ?? [], s.id), have: 0 })) });
  const { idx, monster } = ctx;
  if (!monster) return withSupplies(resolved);
  const guideRes = setupResult(setup, monster, idx);
  if (!guideRes) return withSupplies(resolved);
  const kind = guideRes.kind;
  const dps = (g: Gear) => {
    const r = setupResult({ ...setup, gear: g }, monster, idx);
    return r && r.kind === kind ? r.dps : 0;
  };
  const cheaper = (a: number, b: number) => (ctx.price(a) ?? 0) < (ctx.price(b) ?? 0);
  const picks = new Map<string, SlotPick>(resolved.slots.map((s) => [s.slot, { ...s }]));
  const gear: Gear = {};
  for (const s of resolved.slots) if (s.slot !== 'quiver' && s.kind !== 'missing' && s.use != null) gear[s.slot] = s.use;
  const isMissing = (slot: string) => picks.get(slot)?.kind === 'missing';
  const owned = (slot: Slot) => ctx.pool.bySlot.get(slot) ?? [];
  const protectedSlot = (slot: string) => PROTECTIVE.test(ctx.name(picks.get(slot)?.guide ?? 0) ?? idx.item(picks.get(slot)?.guide)?.n ?? '');
  const ammoFor = (w: GearItem, g: Gear): number | null => {
    const cands = owned('ammo').filter((a) => ammoFits(w, a));
    let best: { id: number; d: number } | null = null;
    for (const a of cands.sort((x, y) => y.b[6] - x.b[6]).slice(0, 5)) {
      const d = dps({ ...g, weapon: w.id, ammo: a.id });
      if (!best || d > best.d + 1e-9 || (Math.abs(d - best.d) <= 1e-9 && cheaper(a.id, best.id))) best = { id: a.id, d };
    }
    return best?.id ?? null;
  };
  const place = (slot: string, id: number, k: 'owned' | 'upgrade') => {
    const prev = picks.get(slot);
    // A slot the guide leaves empty (a shield freed by a one-handed stand-in) has guide 0.
    picks.set(slot, { slot: slot as Slot, guide: prev?.guide ?? 0, use: id, kind: k, options: prev?.options ?? [], delta: null });
  };

  // 3a. The weapon: their best one of the same kind, with the best ammo of theirs it fires.
  if (isMissing('weapon')) {
    let best: { w: GearItem; g: Gear; d: number } | null = null;
    for (const w of owned('weapon')) {
      const g: Gear = { ...gear, weapon: w.id };
      if (w.h2) delete g.shield;
      const cur = g.ammo != null ? idx.item(g.ammo) : null;
      if (!cur || !ammoFits(w, cur)) {
        const a = ammoFor(w, g);
        if (a != null) g.ammo = a;
        else delete g.ammo;
      }
      const d = dps(g);
      if (d <= 0) continue;
      if (!best || d > best.d + 1e-9 || (Math.abs(d - best.d) <= 1e-9 && cheaper(w.id, best.w.id))) best = { w, g, d };
    }
    if (best) {
      const before = gear.ammo;
      Object.keys(gear).forEach((k) => delete gear[k]);
      Object.assign(gear, best.g);
      place('weapon', best.w.id, 'owned');
      if (best.w.h2) picks.delete('shield');
      if (gear.ammo !== before) {
        if (gear.ammo != null) place('ammo', gear.ammo, 'owned');
        else picks.delete('ammo');
      }
    }
  }
  const weapon = idx.item(gear.weapon);
  // The ammo the weapon doesn't fire: theirs that it does, else nothing (an ammoless bow needs none).
  if (weapon) {
    const cur = gear.ammo != null ? idx.item(gear.ammo) : null;
    if ((cur && !ammoFits(weapon, cur)) || isMissing('ammo')) {
      const a = ammoFor(weapon, gear);
      const guideAmmo = idx.item(picks.get('ammo')?.guide);
      if (a != null) {
        gear.ammo = a;
        place('ammo', a, 'owned');
      } else {
        delete gear.ammo;
        // The weapon fires nothing the guide's ammo slot held: the slot isn't needed, not missing.
        if (picks.has('ammo') && guideAmmo && !ammoFits(weapon, guideAmmo)) picks.delete('ammo');
      }
    }
    if (weapon.h2 && gear.shield != null) {
      delete gear.shield;
      picks.delete('shield');
    }
  }

  // 3b. Every other missing slot (and a shield freed up by a one-handed stand-in): their best item.
  const open = SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo' && (isMissing(s) || (s === 'shield' && weapon && !weapon.h2 && !picks.has('shield') && picks.get('weapon')?.kind === 'owned')));
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of open) {
      if (protectedSlot(slot)) continue;
      let best: { id: number; d: number } | null = null;
      for (const c of shortlist(owned(slot), kind)) {
        const d = dps({ ...gear, [slot]: c.id });
        if (!best || d > best.d + 1e-9 || (Math.abs(d - best.d) <= 1e-9 && cheaper(c.id, best.id))) best = { id: c.id, d };
      }
      if (best) {
        gear[slot] = best.id;
        place(slot, best.id, 'owned');
      }
    }
  }

  // Upgrades: an item of theirs that beats the guide's own pick (never the weapon, never a protective pick).
  for (const slot of SLOTS) {
    const p = picks.get(slot);
    if (!p || slot === 'weapon' || (p.kind !== 'guide' && p.kind !== 'fallback') || protectedSlot(slot)) continue;
    const guideItem = idx.item(p.guide);
    const current = dps(gear);
    const bar = Math.max(current, guideItem && (slot !== 'ammo' || !weapon || ammoFits(weapon, guideItem)) ? dps({ ...gear, [slot]: p.guide }) : 0);
    let best: { id: number; d: number } | null = null;
    for (const c of shortlist(owned(slot), kind)) {
      if (c.id === gear[slot] || (slot === 'ammo' && weapon && !ammoFits(weapon, c))) continue;
      const d = dps({ ...gear, [slot]: c.id });
      if (d > bar * (1 + MIN_GAIN) && (!best || d > best.d + 1e-9)) best = { id: c.id, d };
    }
    if (best) {
      gear[slot] = best.id;
      place(slot, best.id, 'upgrade');
    }
  }

  // The quiver: only with a quiver on. A missing quiver ammo takes theirs of the same sort.
  let quiver = resolved.quiver;
  const qp = picks.get('quiver');
  const quiverOn = gear.cape != null && QUIVER_CAPES.some((q) => q === gear.cape || ctx.needs(q).includes(gear.cape));
  if (!quiverOn) {
    quiver = null;
    picks.delete('quiver');
  } else if (qp?.kind === 'missing') {
    const want = (idx.item(qp.guide)?.n ?? ctx.name(qp.guide) ?? '').toLowerCase();
    const sort = /bolt/.test(want) ? /bolt/ : /arrow/.test(want) ? /arrow/ : /arrow|bolt/;
    const c = owned('ammo')
      .filter((a) => a.id !== gear.ammo && sort.test(a.n.toLowerCase()))
      .sort((a, b) => b.b[6] - a.b[6] || (ctx.price(a.id) ?? 0) - (ctx.price(b.id) ?? 0))[0];
    if (c) {
      quiver = c.id;
      place('quiver', c.id, 'owned');
    } else quiver = null;
  }

  // Each stand-in's worth: DPS with it minus DPS with the guide's item back in that one slot.
  const final = dps(gear);
  for (const p of picks.values()) {
    if ((p.kind !== 'owned' && p.kind !== 'upgrade') || p.slot === 'quiver') continue;
    let g: Gear = p.guide ? withSlot({ ...setup, gear }, p.slot, p.guide, idx).gear : Object.fromEntries(Object.entries(gear).filter(([k]) => k !== p.slot));
    if (p.slot === 'weapon' && setup.gear.ammo != null) g = { ...g, ammo: setup.gear.ammo };
    const delta = Math.round((final - dps(g)) * 100) / 100;
    p.delta = delta;
    if (p.kind === 'owned' && delta > 0) p.kind = 'upgrade';
  }

  const slots = resolved.slots.map((s) => picks.get(s.slot)).filter((s): s is SlotPick => !!s);
  for (const p of picks.values()) if (!slots.includes(p)) slots.push(p);
  return withSupplies({
    gear,
    quiver,
    slots,
    missing: slots.filter((s) => s.kind === 'missing'),
    missingSupplies: resolved.missingSupplies,
    fallbacks: slots.filter((s) => s.kind === 'fallback'),
  });
}

const need = (inv: readonly (InvItem | null)[], id: number) => inv.reduce((a, it) => a + (it && it.id === id ? Math.max(1, it.q ?? 1) : 0), 0);

// ── Supplies ────────────────────────────────────────────────────────────────────────────────────

/** "Prayer potion(4)" → "prayer potion"; "Ring of dueling(8)" → "ring of dueling". */
const base = (n: string) => n.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();

/** Potions that stand in for each other, best first. Each family is one job (no plain antifire for a super). */
const POTION_FAMILIES: string[][] = [
  ['divine bastion potion', 'bastion potion', 'divine ranging potion', 'ranging potion'],
  ['divine super combat potion', 'super combat potion'],
  ['divine battlemage potion', 'battlemage potion', 'divine magic potion', 'magic potion'],
  ['super restore', 'blighted super restore', 'prayer potion', 'sanfew serum'],
  ['extended super antifire', 'super antifire potion'],
  ['extended antifire', 'antifire potion'],
  ['anti-venom+', 'anti-venom'],
  ['saradomin brew'],
  ['stamina potion', 'super energy', 'energy potion'],
  ['divine super strength potion', 'super strength'],
  ['divine super attack potion', 'super attack'],
];

/** Teleports to the same place (and the pouches that hold the same runes), best first. */
const SAME_PLACE: string[][] = [
  ['teleport to house', 'construct. cape', 'construct. cape(t)'],
  ['divine rune pouch', 'rune pouch'],
  ['varrock teleport', 'varrock teleport tablet'],
  ['camelot teleport', 'camelot teleport tablet'],
  ['falador teleport', 'falador teleport tablet'],
  ['lumbridge teleport', 'lumbridge teleport tablet'],
  ['ardougne teleport', 'ardougne teleport tablet', 'ardougne cloak 4', 'ardougne cloak 3', 'ardougne cloak 2', 'ardougne cloak 1'],
  ['rellekka teleport', 'fremennik sea boots 4', 'fremennik sea boots 3', 'enchanted lyre'],
];

/** Hitpoints healed per bite. */
const HEALS: Record<string, number> = {
  'manta ray': 22, anglerfish: 22, 'dark crab': 22, 'tuna potato': 22, 'sea turtle': 21, shark: 20, curry: 19,
  'cooked karambwan': 18, 'pineapple pizza': 11, monkfish: 16, 'potato with cheese': 16, swordfish: 14, bass: 13, lobster: 12,
};

/**
 * The reader's supplies: each guide supply they hold any form of stays; one they don't takes the
 * best owned stand-in; else missing (shown dimmed, listed). Counts are not enforced (a supply is
 * missing at 0 held, as before).
 */
export function yourSupplies(inventory: readonly (InvItem | null)[], snap: Snapshot | null | undefined, needs: Equivalents, name: (id: number) => string | undefined): SupplyPick[] {
  const counts = ownedCounts(snap);
  const own = ownership(counts, needs);
  const byBase = new Map<string, { id: number; n: number; q: number }[]>();
  for (const [id, q] of counts) {
    const n = name(id);
    if (!n || isRestricted(n)) continue;
    const dose = Number(/\((\d+)\)\s*$/.exec(n)?.[1] ?? 0);
    const b = base(n);
    byBase.set(b, [...(byBase.get(b) ?? []), { id, n: dose, q }]);
  }
  const bestOf = (b: string) => (byBase.get(b) ?? []).sort((x, y) => y.n - x.n || y.q - x.q)[0]?.id ?? null;
  const standIn = (id: number): number | null => {
    const n = name(id);
    if (!n) return null;
    const b = base(n);
    // Another dose or charge count of the same thing.
    const same = bestOf(b);
    if (same != null) return same;
    for (const fam of [...POTION_FAMILIES, ...SAME_PLACE]) {
      if (!fam.includes(b)) continue;
      for (const other of fam) {
        const x = other === b ? null : bestOf(other);
        if (x != null) return x;
      }
    }
    const heal = HEALS[b];
    if (heal != null) {
      const food = Object.entries(HEALS)
        .filter(([f, h]) => f !== b && Math.abs(h - heal) <= 4 && byBase.has(f))
        .sort((x, y) => Math.abs(x[1] - heal) - Math.abs(y[1] - heal) || y[1] - x[1] || (byBase.get(y[0])![0].q - byBase.get(x[0])![0].q))[0];
      if (food) return bestOf(food[0]);
    }
    return null;
  };
  const out: SupplyPick[] = [];
  const seen = new Set<number>();
  for (const it of inventory) {
    if (!it || it.id <= 0 || seen.has(it.id)) continue;
    seen.add(it.id);
    if (own.has(it.id)) {
      out.push({ id: it.id, use: it.id, kind: 'have' });
      continue;
    }
    const s = standIn(it.id);
    out.push(s != null ? { id: it.id, use: s, kind: 'swap' } : { id: it.id, use: it.id, kind: 'missing' });
  }
  return out;
}
