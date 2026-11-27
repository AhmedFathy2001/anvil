// Defence-drain special attacks: how much Defence a spec takes off a target on average, within the
// target's drain limits, so the loadout engine can rank the specs a player owns and fight the later
// phases at the drained Defence. Plus the Voidwaker's guaranteed hit, the one damage spec the wiki
// states plainly enough to model.
//
// PURE. Facts from the OSRS Wiki's weapon pages, in our own words. Left out on purpose (the wiki is
// unclear or the rule needs fight state we don't have): the bone dagger and Dorgeshuun crossbow
// ("unsuspecting target" guarantee), Statius's warhammer (PvP worlds only), Seercull (drains Magic).

import { calculate, hitChance, type DpsResult, type GearItem, type ItemLookup, type Loadout, type Monster } from './engine';
import type { EffectRule } from './effects';
import { givesDefenceXp, stylesFor } from './tables';
import { targetMods } from './targets';

type Drain =
  /** A share of the target's CURRENT Defence on a successful hit (stacks, each from the lowered level). */
  | { kind: 'current'; pct: number }
  /** A share of the BASE Defence plus one on a successful hit; demons lose more. */
  | { kind: 'base'; pct: number; demonPct: number }
  /** Levels equal to a share of the damage dealt. */
  | { kind: 'damage'; share: number }
  /** Down to a share below base at most, never stacking past it. */
  | { kind: 'upTo'; pct: number };

export interface DrainSpec {
  key: string;
  label: string;
  match: RegExp;
  /** Special attack energy used. */
  cost: number;
  /** Multiplier on the attack roll. */
  acc: number;
  /** Max-hit multipliers, each floored in turn (a godsword: 1.1 then 1.1). */
  dmg: number[];
  /** The defence it always rolls against, whatever the style. */
  vs?: 'stab' | 'slash' | 'crush';
  drain: Drain;
  /** Tekton: the first maul or warhammer spec always lands, a miss still drains 5%; the BGS drains at least 10. */
  tekton?: 'hammer' | 'bgs';
}

export const DRAIN_SPECS: DrainSpec[] = [
  { key: 'elder-maul', label: 'Elder maul', match: /^elder maul/i, cost: 50, acc: 1.25, dmg: [1], drain: { kind: 'current', pct: 35 }, tekton: 'hammer' },
  { key: 'dwh', label: 'Dragon warhammer', match: /^dragon warhammer/i, cost: 50, acc: 1, dmg: [1.5], drain: { kind: 'current', pct: 30 }, tekton: 'hammer' },
  { key: 'bgs', label: 'Bandos godsword', match: /^bandos godsword/i, cost: 50, acc: 2, dmg: [1.1, 1.1], vs: 'slash', drain: { kind: 'damage', share: 1 }, tekton: 'bgs' },
  { key: 'emberlight', label: 'Emberlight', match: /^emberlight/i, cost: 50, acc: 1, dmg: [1], vs: 'stab', drain: { kind: 'base', pct: 5, demonPct: 15 } },
  { key: 'arclight', label: 'Arclight', match: /^arclight/i, cost: 50, acc: 1, dmg: [1], vs: 'stab', drain: { kind: 'base', pct: 5, demonPct: 10 } },
  { key: 'darklight', label: 'Darklight', match: /^darklight/i, cost: 50, acc: 1, dmg: [1], vs: 'stab', drain: { kind: 'base', pct: 5, demonPct: 10 } },
  { key: 'anchor', label: 'Barrelchest anchor', match: /^barrelchest anchor$/i, cost: 50, acc: 2, dmg: [1.1], drain: { kind: 'damage', share: 0.1 } },
  { key: 'accursed', label: 'Accursed sceptre', match: /^accursed sceptre/i, cost: 50, acc: 1.5, dmg: [1.5], drain: { kind: 'upTo', pct: 15 } },
];

export const drainSpecFor = (weaponName: string | null | undefined): DrainSpec | null => DRAIN_SPECS.find((s) => s.match.test(weaponName ?? '')) ?? null;

/** The target's base Defence (before any drain this fight). */
const baseDefence = (m: Monster) => m.lv[0] + (m.drained ?? 0);

/** How many more Defence levels the target lets drains take off. */
export function drainRoom(m: Monster): number {
  const mods = targetMods(m);
  if (mods.noDrain || mods.awakened) return 0;
  let room = m.lv[0];
  if (mods.drainLevels != null) room = Math.min(room, mods.drainLevels - (m.drained ?? 0));
  if (mods.drainFloor != null) room = Math.min(room, m.lv[0] - mods.drainFloor);
  return Math.max(0, room);
}

/** The target with `levels` of Defence drained (whole levels, within its limits). */
export function applyDrain(m: Monster, levels: number): Monster {
  const take = Math.max(0, Math.min(Math.round(levels), drainRoom(m)));
  if (!take) return m;
  return { ...m, lv: [m.lv[0] - take, m.lv[1]], drained: (m.drained ?? 0) + take };
}

export interface SpecDrain {
  spec: DrainSpec;
  /** The style index the spec is used on. */
  style: number;
  hitChance: number;
  maxHit: number;
  /** Levels drained on a successful hit / on a miss (Tekton's 5%, the BGS's 10). Within the target's limits. */
  onHit: number;
  onMiss: number;
  /** The mean levels drained by one spec. */
  expected: number;
  /** Mean levels per full special bar (100%). */
  perBar: number;
}

/**
 * One spec's drain against a target, from the player's loadout with the spec weapon wielded. `first`:
 * the fight's first spec (Tekton's first maul or warhammer spec always lands).
 */
export function specDrain(loadout: Loadout, m: Monster, items: ItemLookup, rules: EffectRule[] = [], opts: { first?: boolean } = {}): SpecDrain | null {
  const weapon = items(loadout.gear.weapon);
  const spec = drainSpecFor(weapon?.n);
  if (!spec || !weapon) return null;
  const room = drainRoom(m);
  const demon = (m.a ?? []).some((a) => a.toLowerCase() === 'demon');
  const tekton = /^tekton$/i.test(m.n);
  const defIdx = spec.vs === 'stab' ? 0 : spec.vs === 'slash' ? 1 : spec.vs === 'crush' ? 2 : -1;

  let best: { style: number; r: DpsResult; p: number; max: number } | null = null;
  stylesFor(weapon.c).forEach((s, style) => {
    if (loadout.avoidDefenceXp && givesDefenceXp(s)) return;
    const r = calculate({ ...loadout, style }, m, items, rules);
    if (!r) return;
    const att = Math.floor(r.attackRoll * spec.acc);
    let def = r.defenceRoll;
    if (defIdx >= 0) {
      def = (m.lv[0] + 9) * (m.d[defIdx] + 64);
      if (m.raidLevel) def = Math.floor(def * (1 + m.raidLevel / 250));
    }
    const p = hitChance(att, def);
    const max = spec.dmg.reduce((h, x) => Math.floor(h * x), r.maxHit);
    if (!best || p > best.p || (p === best.p && max > best.max)) best = { style, r, p, max };
  });
  if (!best) return null;
  const { style, max } = best as { style: number; r: DpsResult; p: number; max: number };
  let p = (best as { p: number }).p;
  if (tekton && spec.tekton === 'hammer' && opts.first) p = 1;

  const cap = (n: number) => Math.max(0, Math.min(n, room));
  const base = baseDefence(m);
  let onHit = 0;
  let onMiss = 0;
  switch (spec.drain.kind) {
    case 'current':
      onHit = cap(Math.floor((m.lv[0] * spec.drain.pct) / 100));
      if (tekton && spec.tekton === 'hammer') onMiss = cap(Math.floor(m.lv[0] * 0.05));
      break;
    case 'base':
      onHit = cap(Math.floor((base * (demon ? spec.drain.demonPct : spec.drain.pct)) / 100) + 1);
      break;
    case 'upTo':
      onHit = cap(Math.floor((base * spec.drain.pct) / 100) - (m.drained ?? 0));
      break;
    case 'damage': {
      // The mean of min(damage × share, room) over an accurate roll 0..max (a 0 lands as 1).
      const share = spec.drain.share;
      let sum = 0;
      for (let k = 0; k <= max; k++) sum += cap(Math.floor(Math.max(1, k) * share));
      onHit = max >= 0 ? sum / (max + 1) : 0;
      if (tekton && spec.tekton === 'bgs') {
        onMiss = cap(10);
        let s2 = 0;
        for (let k = 0; k <= max; k++) s2 += cap(Math.max(10, Math.floor(Math.max(1, k) * share)));
        onHit = s2 / (max + 1);
      }
      break;
    }
  }
  const expected = p * onHit + (1 - p) * onMiss;
  return { spec, style, hitChance: p, maxHit: max, onHit, onMiss, expected, perBar: (expected * 100) / spec.cost };
}

/**
 * The drain specs the player owns, best first by mean Defence taken per full special bar. `base` is
 * the loadout to swap each spec weapon into (its armour, levels, prayers and boost).
 */
export function rankDrainSpecs(base: Loadout, weapons: GearItem[], m: Monster, items: ItemLookup, rules: EffectRule[] = [], opts: { first?: boolean } = {}): SpecDrain[] {
  const out: SpecDrain[] = [];
  for (const w of weapons) {
    if (!drainSpecFor(w.n)) continue;
    const gear = { ...base.gear, weapon: w.id };
    if (w.h2) delete gear.shield;
    const got = specDrain({ ...base, gear, spell: null }, m, items, rules, opts);
    if (got) out.push(got);
  }
  return out.sort((a, b) => b.perBar - a.perBar || b.expected - a.expected);
}

/**
 * The target after a run of specs, each landing its mean drain (rounded to whole levels): the Defence
 * the later phases are fought at.
 */
export function afterSpecs(base: Loadout, specWeapons: GearItem[], m: Monster, items: ItemLookup, rules: EffectRule[] = []): { monster: Monster; steps: { label: string; levels: number }[] } {
  let cur = m;
  const steps: { label: string; levels: number }[] = [];
  specWeapons.forEach((w, i) => {
    const gear = { ...base.gear, weapon: w.id };
    if (w.h2) delete gear.shield;
    const got = specDrain({ ...base, gear, spell: null }, cur, items, rules, { first: i === 0 });
    if (!got) return;
    const next = applyDrain(cur, got.expected);
    steps.push({ label: got.spec.label, levels: next.lv[0] === cur.lv[0] ? 0 : cur.lv[0] - next.lv[0] });
    cur = next;
  });
  return { monster: cur, steps };
}

/**
 * The Voidwaker's spec: a guaranteed hit for 50–150% of the melee max (mean: the max), dealt as
 * magic damage. `r` is the Voidwaker's own melee result on the target.
 */
export function voidwakerSpec(r: DpsResult): { min: number; max: number; mean: number; hitChance: 1 } {
  return { min: Math.floor(r.maxHit * 0.5), max: Math.floor(r.maxHit * 1.5), mean: (Math.floor(r.maxHit * 0.5) + Math.floor(r.maxHit * 1.5)) / 2, hitChance: 1 };
}
