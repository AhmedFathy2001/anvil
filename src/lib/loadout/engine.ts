// The loadout engine: a boss profile + a preset + a player → a real loadout (worn gear, switches,
// a 28-slot inventory, rune pouch, spellbook), each pick with a short reason. PURE: the gear index
// comes in, nothing reads the database.
//
// It is meant to replace the pre-trip check's per-target calc (lib/tripCheck bestLoadout) later,
// and differs from it on purpose: it scores the WHOLE fight (each phase's damage over that phase's
// DPS, summed), not one target's DPS, so a switch is only packed when it saves time somewhere.
//
// The search, in order:
//   1. kits: per style, the owned weapons that can hurt the phases allowing it (ammo paired, darts,
//      an autocast spell), the best few by weapon alone; then armour by coordinate ascent over each
//      slot's shortlist, with SETS (Void, Inquisitor's, crystal) tried as whole units; empty slots
//      filled with the best defence that costs nothing. A phase that must be cast (Crumble Undead)
//      gets a weapon-only caster kit.
//   2. for each style as the WORN kit: spec weapons first, then a weapon switch for every required
//      style, then pieces packed greedily by seconds saved per inventory slot (a switch costs a
//      tick per phase entry) under the preset's switch budget, never two pieces of one family.
//      The worn style with the shortest fight wins.
//   3. the inventory: switches, then the preset's supply plan from what the player holds, the rest
//      empty; the rune pouch from the spells carried.
//   4. the hard rules (required styles, immunities, the profile's rules): a break is an entry in
//      `requirementsUnmet`, never dropped.
//
// Helpers copied from lib/tripCheck (not exported there, and that file is being edited elsewhere):
// slotOf, shortlist/kindScore and SETS. Imported from it: ammoFits, isSpecWeapon, usableHeld,
// raidScaled, calcSpell, SPELL_RUNES, staffRunes.

import { TOA_MONSTER, calculate, type DpsResult, type GearItem, type Monster, type Stats } from '../dps/engine';
import { POWERED_MAX, SLOTS, spellByName, stylesFor, type AttackType, type Slot } from '../dps/tables';
import type { GearIndex } from '../dps/summary';
import { SPELL_RUNES, ammoFits, calcSpell, isSpecWeapon, raidScaled, staffRunes, usableHeld } from '../tripCheck';
import { SUPPLY_FORMS, SUPPLY_LABEL, pickSupplies } from './supplies';
import { STYLES, type BossProfile, type InvSlot, type Loadout, type LoadoutPhase, type PhaseProfile, type PlayerInput, type Preset, type Style, type Unmet, type Why } from './types';

export interface EngineInput {
  profile: BossProfile;
  preset: Preset;
  player: PlayerInput;
  idx: GearIndex;
}

type Gear = Partial<Record<Slot, number>>;

interface Kit {
  /** 'melee' | 'ranged' | 'magic' | 'cast:<spell>' */
  key: string;
  style: Style;
  weapon: GearItem;
  gear: Gear;
  spell: string | null;
  dart: number | null;
  cast?: string;
  /** Which set unit the ascent settled on, for the reasons. */
  set?: string;
}

interface Target {
  p: PhaseProfile;
  m: Monster;
  /** Hitpoints dealt in this phase. */
  damage: number;
}

interface Ctx {
  idx: GearIndex;
  stats: Stats;
  prayers: string[];
  boosts: Partial<Record<Style, string>>;
  /** dpsOn's answers for this run, by phase, style, spell, darts and gear. */
  memo: Map<string, { dps: number; r: DpsResult } | null>;
}

const TICK = 0.6;
const INV = 28;
const EPS = 1e-9;

const kindOfType = (t: AttackType): Style => (t === 'ranged' ? 'ranged' : t === 'magic' ? 'magic' : 'melee');

/** The gear data's slot for an item ('2h' is worn in the weapon slot). Copied from lib/tripCheck. */
const slotOf = (it: GearItem | null): Slot | null => {
  if (!it) return null;
  const s = it.s === '2h' ? 'weapon' : it.s;
  return (SLOTS as readonly string[]).includes(s) ? (s as Slot) : null;
};

/** What a kind of attack reads off a piece. Copied from lib/tripCheck. */
const kindScore = (b: number[], kind: Style) => (kind === 'melee' ? Math.max(b[0], b[1], b[2]) + 1.5 * b[5] : kind === 'ranged' ? b[4] + 1.5 * b[6] : b[3] + 3 * b[7]);

/**
 * Each slot's few likeliest items for one style, by the bonuses it reads; a piece made for another
 * style (a ranged body in a melee kit) is left out. Copied from lib/tripCheck, plus zero-bonus
 * utility pieces kept for the empty-slot fill.
 */
function shortlist(pool: GearItem[], kind: Style): Map<Slot, GearItem[]> {
  const others = (['melee', 'ranged', 'magic'] as const).filter((k) => k !== kind);
  const by = new Map<Slot, GearItem[]>();
  for (const it of pool) {
    const s = slotOf(it);
    if (!s || s === 'weapon' || s === 'ammo') continue;
    const own = Math.max(0, kindScore(it.b, kind));
    if (others.some((k) => kindScore(it.b, k) > 3 * own + 3)) continue;
    by.set(s, [...(by.get(s) ?? []), it]);
  }
  for (const [s, list] of by) by.set(s, list.sort((a, b) => kindScore(b.b, kind) - kindScore(a.b, kind) || (b.df ?? 0) - (a.df ?? 0)).slice(0, 6));
  return by;
}

/** Sets whose bonus no single swap shows: tried whole. Copied from lib/tripCheck (with names). */
const voidHelm = (kind: Style) => (kind === 'melee' ? /^void melee helm/i : kind === 'ranged' ? /^void ranger helm/i : /^void mage helm/i);
const SETS: { name: string; kind: Style; pieces: [Slot, RegExp][] }[] = [
  ...(['melee', 'ranged', 'magic'] as const).map((kind) => ({
    name: 'Elite Void',
    kind,
    pieces: [['head', voidHelm(kind)], ['body', /^elite void top/i], ['legs', /^elite void robe/i], ['hands', /^void knight gloves/i]] as [Slot, RegExp][],
  })),
  ...(['melee', 'ranged', 'magic'] as const).map((kind) => ({
    name: 'Void',
    kind,
    pieces: [['head', voidHelm(kind)], ['body', /^void knight top/i], ['legs', /^void knight robe/i], ['hands', /^void knight gloves/i]] as [Slot, RegExp][],
  })),
  { name: "Inquisitor's", kind: 'melee', pieces: [['head', /^inquisitor's great helm/i], ['body', /^inquisitor's hauberk/i], ['legs', /^inquisitor's plateskirt/i]] },
  { name: 'Crystal', kind: 'ranged', pieces: [['head', /^crystal helm/i], ['body', /^crystal body/i], ['legs', /^crystal legs/i]] },
];

const AMMOLESS = /crystal bow|bow of faerdhinen|craw's bow|webweaver|blowpipe/i;
const needsAmmo = (w: GearItem) => (w.c === 'Bow' && !AMMOLESS.test(w.n)) || w.c === 'Crossbow';
const isPowered = (w: GearItem) => POWERED_MAX.some((p) => p.match.test(w.n));
const canAutocast = (w: GearItem) => (w.c === 'Staff' || w.c === 'Bladed Staff') && !isPowered(w);
const LIGHTBEARER = /^lightbearer$/i;
const QUIVER = /^(blessed )?dizana's quiver/i;
/** Off-hands that block dragonfire (the Twisted buckler does too). */
const DRAGONFIRE_SHIELD = /^(dragonfire (shield|ward)|anti-dragon shield|ancient wyvern shield|twisted buckler)/i;

/** One piece across its forms: "Masori body (f)" and "Masori body" are one piece to carry. */
const defaultFamily = (name: string) => {
  let n = name.trim().toLowerCase();
  for (let i = 0; i < 3 && /\s*\([^()]*\)$/.test(n); i++) n = n.replace(/\s*\([^()]*\)$/, '');
  return n;
};

/** The mean of min(roll, cap) for a uniform roll 0..m. */
const cappedMean = (m: number, cap: number) => {
  if (m <= cap) return m / 2;
  const below = (cap * (cap + 1)) / 2;
  return (below + (m - cap) * cap) / (m + 1);
};

const fmt = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));
const secs = (s: number) => (Number.isFinite(s) ? `${s.toFixed(1)}s` : 'never');

// ── DPS of one gear set on one target ───────────────────────────────────────────────────────

function dpsOn(gear: Gear, kit: Pick<Kit, 'style' | 'spell' | 'dart'>, t: Target, ctx: Ctx): { dps: number; r: DpsResult } | null {
  const key = `${t.p.key}|${kit.style}|${kit.spell ?? ''}|${kit.dart ?? ''}|${SLOTS.map((s) => gear[s] ?? '').join(',')}`;
  if (ctx.memo.has(key)) return ctx.memo.get(key)!;
  const out = dpsOnUncached(gear, kit, t, ctx);
  ctx.memo.set(key, out);
  return out;
}

function dpsOnUncached(gear: Gear, kit: Pick<Kit, 'style' | 'spell' | 'dart'>, t: Target, ctx: Ctx): { dps: number; r: DpsResult } | null {
  const weapon = ctx.idx.item(gear.weapon);
  if (!weapon) return null;
  let best: { dps: number; r: DpsResult } | null = null;
  stylesFor(weapon.c).forEach((s, i) => {
    if (kindOfType(s.type) !== kit.style) return;
    const r = calculate(
      { gear, style: i, spell: kit.spell, dart: kit.dart, stats: ctx.stats, prayer: ctx.prayers, boost: ctx.boosts[kit.style] ?? null, onTask: false },
      t.m,
      ctx.idx.item,
      ctx.idx.rules,
    );
    if (!r || !(r.maxHit > 0)) return;
    let dps = r.dps;
    // Osmumten's fang on stab rolls accuracy twice (the DPS engine only notes it). From the wiki's
    // item page: inside ToA the whole check repeats, 1 − (1 − p)²; outside, two attack rolls.
    if (/^osmumten's fang/i.test(weapon.n) && s.type === 'stab' && r.accuracy > 0) {
      const a = r.attackRoll;
      const d = r.defenceRoll;
      const p2 = TOA_MONSTER.test(t.m.n) ? 1 - (1 - r.accuracy) ** 2 : a >= d ? 1 - ((d + 2) * (2 * d + 3)) / (6 * (a + 1) ** 2) : (a * (4 * a + 5)) / (6 * (a + 1) * (d + 1));
      dps *= p2 / r.accuracy;
    }
    if (t.p.alwaysMaxHit) dps = r.maxHit / (r.speed * TICK);
    else if (t.p.maxHitCap && r.maxHit > t.p.maxHitCap && r.maxHit > 0) dps *= cappedMean(r.maxHit, t.p.maxHitCap) / (r.maxHit / 2);
    if (!best || dps > best.dps) best = { dps, r };
  });
  return best;
}

const usable = (kit: Pick<Kit, 'style' | 'cast'>, p: PhaseProfile) =>
  kit.cast ? p.cast === kit.cast : !p.cast && p.allowed.includes(kit.style) && !(p.immune ?? []).includes(kit.style);

/** Seconds a gear set needs over the phases it is meant for (Infinity if it can't hurt one). */
function phaseCost(gear: Gear, kit: Pick<Kit, 'style' | 'spell' | 'dart'>, targets: Target[], ctx: Ctx): number {
  let total = 0;
  for (const t of targets) {
    const d = dpsOn(gear, kit, t, ctx);
    if (!d || d.dps <= 0) return Infinity;
    total += t.damage / d.dps;
  }
  return total;
}

// ── The engine ──────────────────────────────────────────────────────────────────────────────

export function buildLoadout(input: EngineInput): Loadout {
  const { profile, preset, player, idx } = input;
  const plan = profile.presets[preset];
  const lv = player.levels;
  const unmet: Unmet[] = [];
  const warnings: string[] = [];
  const why: Why[] = [];
  const banned = new Set(player.constraints?.bannedItems ?? []);
  const bannedStyles = new Set(player.constraints?.bannedStyles ?? []);
  const fam = (id: number) => (player.familyOf ? String(player.familyOf(id)) : defaultFamily(idx.item(id)?.n ?? String(id)));
  const nameOf = (id: number | null | undefined) => idx.item(id)?.n ?? `Item ${id}`;

  // Prayers: the best of each style the levels (and unlocks, when known) allow.
  const pray = lv.prayer;
  const unlocked = (k: string) => (player.prayers ? player.prayers.includes(k) : true);
  const prayers = [
    ...(pray >= 70 && lv.defence >= 70 && unlocked('piety') ? ['piety'] : pray >= 31 ? ['ultimate_strength', 'incredible_reflexes'] : pray >= 13 ? ['superhuman', 'improved_reflexes'] : []),
    pray >= 74 && lv.defence >= 70 && unlocked('rigour') ? 'rigour' : pray >= 44 ? 'eagle_eye' : pray >= 26 ? 'hawk_eye' : 'sharp_eye',
    pray >= 77 && lv.defence >= 70 && unlocked('augury') ? 'augury' : pray >= 45 ? 'mystic_might' : pray >= 27 ? 'mystic_lore' : 'mystic_will',
  ];
  const ctx: Ctx = {
    idx,
    stats: { attack: lv.attack, strength: lv.strength, ranged: lv.ranged, magic: lv.magic, hitpoints: lv.hitpoints },
    prayers,
    boosts: profile.boosts ?? {},
    memo: new Map(),
  };

  // The fight's targets, scaled to the mode (a ToA raid level).
  const raidLevel = profile.modes?.some((m) => m.key === 'raidLevel') ? (player.mode?.raidLevel ?? profile.modes.find((m) => m.key === 'raidLevel')!.default) : null;
  const targets: Target[] = [];
  for (const p of profile.phases) {
    const base = idx.monster(p.monster);
    if (!base) {
      unmet.push({ code: 'nothing', message: `${p.name}: the gear data has no ${p.monster}` });
      continue;
    }
    let m: Monster = { ...base, ...(p.asName ? { n: p.asName } : {}), ...(p.size ? { sz: p.size } : {}) };
    if (p.tags?.length) m = { ...m, a: [...new Set([...(m.a ?? []), ...p.tags])] };
    if (raidLevel) m = raidScaled(m, raidLevel);
    targets.push({ p, m, damage: m.hp * p.share });
  }

  // The pool: what the player holds that main-game PvM can use.
  const pool = [...new Set(player.owned)]
    .filter((id) => !banned.has(id))
    .map((id) => idx.item(id))
    .filter((x): x is GearItem => !!x && !x.hid && usableHeld(x.n));
  const weapons = pool.filter((x) => slotOf(x) === 'weapon');
  const ammoPool = pool.filter((x) => x.s === 'ammo');
  const darts = pool.filter((x) => /dart$/i.test(x.n) && x.c === 'Thrown').sort((a, b) => b.b[6] - a.b[6]);

  // ── 1. Kits ──
  const styleTargets = (style: Style) => targets.filter((t) => usable({ style }, t.p));
  const kits = new Map<string, Kit>();
  const lists = { melee: shortlist(pool, 'melee'), ranged: shortlist(pool, 'ranged'), magic: shortlist(pool, 'magic') };

  /** The best kit of one style over these targets: weapon candidates, then armour by ascent. */
  function kitFor(style: Style, ts: Target[]): Kit | null {
    if (!ts.length) return null;
    const heaviest = [...ts].sort((a, b) => b.damage - a.damage)[0];
    // A staff's bash is no melee weapon.
    const ofStyle = weapons.filter((w) => stylesFor(w.c).some((s) => kindOfType(s.type) === style) && !(style === 'melee' && (canAutocast(w) || isPowered(w))));
    const plain = ofStyle.filter((w) => !isSpecWeapon(w.n));
    const cands: { kit: Kit; cost: number }[] = [];
    for (const w of plain.length ? plain : ofStyle) {
      const dart = /blowpipe/i.test(w.n) ? (darts[0]?.id ?? null) : null;
      if (/blowpipe/i.test(w.n) && dart == null) continue;
      let spell: string | null = null;
      if (style === 'magic' && !isPowered(w)) {
        if (!canAutocast(w) && w.c !== 'Salamander') continue;
        spell = calcSpell(0, lv.magic, heaviest.m.ew);
        if (!spell) continue;
      }
      const base = { key: style, style, weapon: w, spell, dart } as const;
      let gear: Gear = { weapon: w.id };
      if (style === 'ranged' && needsAmmo(w)) {
        const fits = ammoPool.filter((a) => ammoFits(w, a)).sort((a, b) => b.b[6] - a.b[6]).slice(0, 6);
        let bestA: { id: number; cost: number } | null = null;
        for (const a of fits) {
          const c = phaseCost({ weapon: w.id, ammo: a.id }, base, ts, ctx);
          if (!bestA || c < bestA.cost) bestA = { id: a.id, cost: c };
        }
        if (!bestA) continue;
        gear = { ...gear, ammo: bestA.id };
      }
      const cost = phaseCost(gear, base, ts, ctx);
      if (Number.isFinite(cost)) cands.push({ kit: { ...base, gear }, cost });
    }
    let best: { kit: Kit; cost: number } | null = null;
    for (const c of cands.sort((a, b) => a.cost - b.cost).slice(0, 3)) {
      const k = ascend(c.kit, ts);
      const cost = phaseCost(k.gear, k, ts, ctx);
      if (!best || cost < best.cost) best = { kit: k, cost };
    }
    return best?.kit ?? null;
  }

  for (const style of ['melee', 'ranged', 'magic'] as const) {
    if (bannedStyles.has(style)) continue;
    const k = kitFor(style, styleTargets(style));
    if (k) kits.set(style, k);
  }

  // Caster kits: a staff that autocasts the phase's spell, weapon only.
  for (const t of targets.filter((x) => x.p.cast)) {
    const spell = t.p.cast!;
    const key = `cast:${spell}`;
    if (kits.has(key)) continue;
    const rule = profile.rules.find((r) => r.kind === 'spell' && r.spell === spell);
    if (rule && rule.kind === 'spell' && lv.magic < rule.magic) {
      unmet.push({ code: 'spell', message: `${spell} needs ${rule.magic} Magic (you have ${lv.magic})` });
      continue;
    }
    let best: { kit: Kit; dps: number } | null = null;
    for (const w of weapons.filter(canAutocast)) {
      const kit: Kit = { key, style: 'magic', weapon: w, gear: { weapon: w.id }, spell, dart: null, cast: spell };
      const d = dpsOn(kit.gear, kit, t, ctx);
      if (d && d.dps > 0 && (!best || d.dps > best.dps)) best = { kit, dps: d.dps };
    }
    if (best) kits.set(key, best.kit);
  }

  function ascend(kit: Kit, ts: Target[]): Kit {
    const gear: Gear = { ...kit.gear };
    const w = kit.weapon;
    let cost = phaseCost(gear, kit, ts, ctx);
    const list = lists[kit.style];
    const slots = SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo' && !(s === 'shield' && w.h2));
    const tryGear = (trial: Gear) => {
      const c = phaseCost(trial, kit, ts, ctx);
      if (c < cost - EPS) {
        Object.keys(gear).forEach((k) => delete gear[k as Slot]);
        Object.assign(gear, trial);
        cost = c;
        return true;
      }
      return false;
    };
    let set: string | undefined;
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const slot of slots) {
        for (const c of list.get(slot) ?? []) if (gear[slot] !== c.id && tryGear({ ...gear, [slot]: c.id })) changed = true;
        if (gear[slot] != null) {
          const off = { ...gear };
          delete off[slot];
          if (tryGear(off)) changed = true;
        }
      }
      // Ammo for a ranged weapon that fires it: re-paired once the armour is on.
      if (kit.style === 'ranged' && needsAmmo(w)) for (const a of ammoPool.filter((x) => ammoFits(w, x))) if (gear.ammo !== a.id && tryGear({ ...gear, ammo: a.id })) changed = true;
      for (const s of SETS.filter((x) => x.kind === kit.style)) {
        const pieces = s.pieces.map(([slot, re]) => [slot, pool.find((it) => slotOf(it) === slot && re.test(it.n))] as const);
        if (pieces.some(([, it]) => !it)) continue;
        if (tryGear({ ...gear, ...Object.fromEntries(pieces.map(([slot, it]) => [slot, it!.id])) })) {
          set = s.name;
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (set && !SETS.find((s) => s.name === set && s.kind === kit.style)!.pieces.every(([slot, re]) => re.test(nameOf(gear[slot])))) set = undefined;
    // An empty slot takes the sturdiest owned piece of the style that costs nothing.
    for (const slot of slots) {
      if (gear[slot] != null) continue;
      const opts = [...(list.get(slot) ?? [])].filter((c) => !LIGHTBEARER.test(c.n)).sort((a, b) => (b.df ?? 0) - (a.df ?? 0));
      for (const c of opts) {
        const trial = { ...gear, [slot]: c.id };
        if (phaseCost(trial, kit, ts, ctx) <= cost + EPS) {
          gear[slot] = c.id;
          break;
        }
      }
    }
    return { ...kit, gear, ...(set ? { set } : {}) };
  }

  // ── 2. Worn kit + switches ──
  const budget = Math.min(plan.switchBudget, player.constraints?.maxSwitches ?? Infinity);
  const specCount = player.constraints?.noSpec ? 0 : plan.specs;

  interface Packed {
    id: number;
    slot: Slot;
    kit: string;
    why: string;
  }
  interface Assembly {
    wornKit: Kit;
    worn: Gear;
    packed: Packed[];
    specs: GearItem[];
    time: number;
    phases: LoadoutPhase[];
    /** Slots the required switches went over the budget by. */
    over: number;
  }

  const specPicks = (wornWeapon: GearItem): GearItem[] => {
    if (!specCount || !profile.spec) return [];
    const out: GearItem[] = [];
    for (const pat of profile.spec.prefer) {
      const re = new RegExp(pat, 'i');
      const it = weapons.find((w) => re.test(w.n) && fam(w.id) !== fam(wornWeapon.id) && !out.some((o) => fam(o.id) === fam(w.id)));
      if (it && out.length < specCount) out.push(it);
    }
    return out;
  };

  function effective(kit: Kit, a: Pick<Assembly, 'wornKit' | 'worn' | 'packed'>): Gear | null {
    if (kit === a.wornKit) return a.worn;
    const ids = new Set(a.packed.map((p) => p.id));
    if (!ids.has(kit.weapon.id)) return null;
    const g: Gear = { ...a.worn };
    for (const slot of SLOTS) {
      const id = kit.gear[slot];
      if (id != null && ids.has(id)) g[slot] = id;
    }
    if (kit.weapon.h2) delete g.shield;
    if (kit.style === 'ranged' && needsAmmo(kit.weapon) && (g.ammo == null || !ammoFits(kit.weapon, idx.item(g.ammo)!))) return null;
    return g;
  }

  function evaluate(a: Pick<Assembly, 'wornKit' | 'worn' | 'packed'>): { time: number; phases: LoadoutPhase[] } {
    const carried = [...kits.values()].map((k) => ({ k, g: effective(k, a) })).filter((x): x is { k: Kit; g: Gear } => !!x.g);
    let time = 0;
    const phases: LoadoutPhase[] = [];
    for (const t of targets) {
      let best: { kit: string; dps: number; s: number } | null = null;
      for (const { k, g } of carried) {
        if (!usable(k, t.p)) continue;
        const d = dpsOn(g, k, t, ctx);
        if (!d || d.dps <= 0) continue;
        const off = t.p.prefer && !t.p.prefer.includes(k.style) ? (t.p.offStyle ?? 1.5) : 1;
        // A switch costs a tick per three pieces put on (about three clicks a tick), each entry.
        const swap = k === a.wornKit ? 0 : TICK * Math.ceil(a.packed.filter((p) => p.kit === k.key).length / 3) * (t.p.entries ?? 1);
        const s = (t.damage / d.dps) * off + swap;
        if (!best || s < best.s) best = { kit: k.key, dps: d.dps, s };
      }
      const s = (best?.s ?? Infinity) + (t.p.downtime ?? 0);
      time += s;
      phases.push({ key: t.p.key, name: t.p.name, kit: best?.kit ?? null, dps: best?.dps ?? 0, seconds: s, timeShare: 0 });
    }
    for (const ph of phases) ph.timeShare = Number.isFinite(time) && time > 0 ? ph.seconds / time : 0;
    return { time, phases };
  }

  /** Strongest pieces first (by the bonuses the style reads). */
  const strongest = (ids: number[], style: Style) => [...ids].sort((x, y) => kindScore(idx.item(y)!.b, style) - kindScore(idx.item(x)!.b, style));

  /**
   * The worn kit plus switches. `seed`: a kit's weapon and its `n` strongest pieces packed before
   * the greedy, so a kit that only pays with many pieces on gets a fair try (a knapsack the
   * one-step greedy can't see).
   */
  function assemble(wornKit: Kit, seed?: { key: string; n: number }): Assembly {
    const worn: Gear = { ...wornKit.gear };
    const specs = specPicks(wornKit.weapon);
    const lightbearer = plan.lightbearer && specs.length ? pool.find((x) => LIGHTBEARER.test(x.n)) : undefined;
    if (lightbearer) worn.ring = lightbearer.id;
    const packed: Packed[] = [];
    const a = { wornKit, worn, packed };
    let slotsLeft = budget - specs.length;
    const families = () => new Set([...Object.values(worn), ...packed.map((p) => p.id), ...specs.map((s) => s.id)].filter((x): x is number => x != null).map(fam));
    const isNew = (id: number) => !packed.some((p) => p.id === id) && !Object.values(worn).includes(id);
    const famOk = (ids: number[]) => {
      const f = families();
      return ids.every((id) => !f.has(fam(id)));
    };
    const bundle = (k: Kit) => {
      const ids = [k.weapon.id];
      if (k.style === 'ranged' && k.gear.ammo != null && k.gear.ammo !== worn.ammo) ids.push(k.gear.ammo);
      return ids.filter(isNew);
    };
    const pack = (k: Kit, ids: number[], reason: string) => {
      for (const id of ids) packed.push({ id, slot: slotOf(idx.item(id))!, kit: k.key, why: reason });
      slotsLeft -= ids.length;
    };

    // Required styles (and casts) get their weapon whatever the budget.
    const others = [...kits.values()].filter((k) => k !== wornKit);
    for (const t of targets) {
      const need = [...(t.p.required ?? [])].filter((s) => !(t.p.cast && s === 'magic'));
      for (const s of need) {
        if (wornKit.key === s || packed.some((p) => p.kit === s)) continue;
        const k = kits.get(s);
        if (!k) continue;
        const ids = bundle(k);
        if (!famOk(ids)) continue;
        pack(k, ids, `needed: ${t.p.name} can't be done without ${s}`);
      }
    }
    for (const t of targets) {
      if (t.p.cast) {
        const k = kits.get(`cast:${t.p.cast}`);
        if (k && !packed.some((p) => p.kit === k.key)) {
          const ids = bundle(k);
          // A worn staff that casts it already: nothing to pack.
          if (ids.length) pack(k, ids, `needed: ${t.p.name} dies only to ${t.p.cast}`);
        }
      }
    }
    for (const t of targets) {
      // Two styles for a boss that prays against one: the best other one it can use.
      if (t.p.minStyles && t.p.minStyles > 1) {
        const have = () => new Set([wornKit, ...others.filter((k) => packed.some((p) => p.id === k.weapon.id))].filter((k) => usable(k, t.p)).map((k) => k.style));
        while (have().size < t.p.minStyles) {
          const opts = others
            .filter((k) => usable(k, t.p) && !have().has(k.style))
            .map((k) => ({ k, d: dpsOn({ ...worn, ...k.gear }, k, t, ctx)?.dps ?? 0 }))
            .sort((x, y) => y.d - x.d);
          const pick = opts.find((o) => famOk(bundle(o.k)));
          if (!pick) break;
          pack(pick.k, bundle(pick.k), `needed: ${t.p.name} prays against one style, so a second one comes along`);
        }
      }
    }
    const over = Math.max(0, -slotsLeft);
    const restOf = (k: Kit) => SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo').map((s) => k.gear[s]).filter((id): id is number => id != null && isNew(id) && famOk([id]));
    const sk = seed ? kits.get(seed.key) : undefined;
    if (sk && sk !== wornKit) {
      const carried = packed.some((p) => p.id === sk.weapon.id);
      const ids = [...(carried ? [] : bundle(sk)), ...strongest(restOf(sk), sk.style).slice(0, seed!.n)];
      if (ids.length && ids.length <= slotsLeft && famOk(ids) && new Set(ids.map(fam)).size === ids.length) {
        const before = evaluate(a).time;
        const after = evaluate({ wornKit, worn, packed: [...packed, ...ids.map((id) => ({ id, slot: slotOf(idx.item(id))!, kit: sk.key, why: '' }))] }).time;
        if (after < before - EPS) pack(sk, ids, Number.isFinite(before) ? `${sk.key} switch: saves ${(before - after).toFixed(1)}s a kill with the rest of the ${sk.key} kit` : `${sk.key} switch`);
      }
    }

    // Greedy: the pack that saves the most seconds per slot, while it saves any.
    let cur = evaluate(a).time;
    for (;;) {
      if (slotsLeft <= 0) break;
      let best: { k: Kit; ids: number[]; gain: number; time: number } | null = null;
      for (const k of others) {
        const carried = packed.some((p) => p.id === k.weapon.id) || k === wornKit;
        // Single pieces, and the whole rest of the kit at once: a kit often pays only with
        // several pieces on (a melee weapon in robes is no melee setup).
        const rest = restOf(k);
        const ranked = strongest(rest, k.style);
        const lead = carried ? [] : bundle(k);
        const options: number[][] = [...(carried ? rest.map((id) => [id]) : [lead])];
        // The kit's strongest pieces together, as many as fit.
        for (let n = 2; n <= ranked.length; n++) if (lead.length + n <= slotsLeft) options.push([...lead, ...ranked.slice(0, n)]);
        for (const ids of options) {
          if (!ids.length || ids.length > slotsLeft || !famOk(ids) || new Set(ids.map(fam)).size < ids.length) continue;
          const trial = { wornKit, worn, packed: [...packed, ...ids.map((id) => ({ id, slot: slotOf(idx.item(id))!, kit: k.key, why: '' }))] };
          const time = evaluate(trial).time;
          const gain = Number.isFinite(cur) ? (cur - time) / ids.length : Number.isFinite(time) ? 1e9 : 0;
          if (gain > 0.2 && (!best || gain > best.gain)) best = { k, ids, gain, time };
        }
      }
      if (!best) break;
      const saved = Number.isFinite(cur) ? cur - best.time : Infinity;
      pack(best.k, best.ids, Number.isFinite(saved) ? `${best.k.key} switch: saves ${saved.toFixed(1)}s a kill` : `${best.k.key} switch: the only way to hurt a phase`);
      cur = best.time;
    }
    const ev = evaluate(a);
    return { wornKit, worn, packed, specs, time: ev.time, phases: ev.phases, over };
  }

  const pickWorn = (): Assembly | null => {
    let best: Assembly | null = null;
    // Within 2% of the fastest, wear the style that fights the most: fewer swaps than the numbers show.
    // The fastest assembly per worn style; the tolerance below only chooses between styles.
    const all: Assembly[] = [];
    const main = [...kits.values()].filter((x) => !x.cast);
    for (const w of main) {
      let top = assemble(w);
      for (const k of main) {
        if (k === w) continue;
        for (const n of [2, 4, 6, 8]) {
          const x = assemble(w, { key: k.key, n });
          if (x.time < top.time - EPS) top = x;
        }
      }
      all.push(top);
    }
    const fastest = Math.min(...all.map((x) => x.time));
    const covered = (x: Assembly) => x.phases.filter((p) => p.kit === x.wornKit.key).reduce((acc, p) => acc + p.timeShare, 0);
    for (const asm of all) {
      if (!(asm.time <= fastest * 1.02 + EPS)) continue;
      if (!best || covered(asm) > covered(best) + EPS || (Math.abs(covered(asm) - covered(best)) <= EPS && asm.time < best.time)) best = asm;
    }
    return best ?? all[0] ?? null;
  };
  let chosen = pickWorn();
  // Each kit was tuned on every phase its style may fight; re-tune it on the phases it ends up
  // doing (a melee switch carried only for the Wardens' core wants the core's weapon, not Ba-Ba's)
  // and keep the result when the whole fight gets faster.
  for (let round = 0; chosen && round < 2; round++) {
    const before = new Map(kits);
    let changed = false;
    for (const style of STYLES) {
      const k = kits.get(style);
      const used = targets.filter((t) => chosen!.phases.find((p) => p.key === t.p.key)?.kit === style);
      if (!k || !used.length) continue;
      const nk = kitFor(style, used);
      if (nk && JSON.stringify(nk.gear) !== JSON.stringify(k.gear)) {
        kits.set(style, nk);
        changed = true;
      }
    }
    if (!changed) break;
    const next = pickWorn();
    if (next && next.time < chosen.time - EPS) chosen = next;
    else {
      kits.clear();
      before.forEach((v, key) => kits.set(key, v));
      break;
    }
  }
  if (chosen && chosen.over) warnings.push(`The required switches go ${chosen.over} slot${chosen.over > 1 ? 's' : ''} over the ${preset} budget of ${budget}`);

  if (!chosen) {
    unmet.push({ code: 'nothing', message: `Nothing you own can fight ${profile.name}` });
    return {
      profile: profile.key,
      preset,
      wornStyle: null,
      worn: {},
      switches: [],
      specs: [],
      inventory: Array(INV).fill(null),
      runePouch: null,
      spellbook: 'standard',
      quiverAmmo: null,
      phases: targets.map((t) => ({ key: t.p.key, name: t.p.name, kit: null, dps: 0, seconds: Infinity, timeShare: 0 })),
      expectedTime: Infinity,
      killsPerTrip: null,
      why,
      requirementsUnmet: unmet,
      warnings,
    };
  }
  const { wornKit, worn, packed, specs } = chosen;

  // A worn Dizana's quiver holds a switch's ammo: one slot back.
  let quiverAmmo: number | null = null;
  if (worn.cape != null && QUIVER.test(nameOf(worn.cape))) {
    const ammoSwitch = packed.find((p) => p.slot === 'ammo');
    if (ammoSwitch) {
      quiverAmmo = ammoSwitch.id;
      packed.splice(packed.indexOf(ammoSwitch), 1);
    }
  }

  // ── Reasons for the worn kit ──
  const wornTargets = targets.filter((t) => chosen!.phases.find((p) => p.key === t.p.key)?.kit === wornKit.key);
  const wornCost = phaseCost(worn, wornKit, wornTargets, ctx);
  const main = wornTargets.length ? [...wornTargets].sort((x, y) => y.damage - x.damage)[0] : null;
  const mainDps = main ? dpsOn(worn, wornKit, main, ctx)?.dps ?? 0 : 0;
  why.push({ pick: wornKit.weapon.n, why: `worn ${wornKit.style}: the fastest style you own for ${wornTargets.map((t) => t.p.name).join(', ') || 'this fight'}${main ? ` (${fmt(mainDps)} DPS on ${main.p.name})` : ''}` });
  if (wornKit.set) why.push({ pick: `${wornKit.set} set`, why: 'worn whole: its set bonus beats the best single pieces' });
  for (const slot of SLOTS) {
    const id = worn[slot];
    if (id == null || slot === 'weapon') continue;
    const n = nameOf(id);
    if (LIGHTBEARER.test(n)) {
      why.push({ pick: n, why: 'spec ring: faster special attack energy for the spec weapons' });
      continue;
    }
    const off = { ...worn };
    delete off[slot];
    const without = phaseCost(off, wornKit, wornTargets, ctx);
    const pct = Number.isFinite(without) && wornCost > 0 ? (without / wornCost - 1) * 100 : 0;
    if (slot === 'ammo') why.push({ pick: n, why: `ammo the ${wornKit.weapon.n} fires best here` });
    else if (slot === 'shield' && DRAGONFIRE_SHIELD.test(n)) why.push({ pick: n, why: `dragonfire protection, and ${pct > 0.05 ? `${pct.toFixed(1)}% faster than an empty hand` : 'free in the off-hand'}` });
    else why.push({ pick: n, why: pct > 0.05 ? `${slot}: ${pct.toFixed(1)}% slower without it` : `${slot}: no damage to gain here, the sturdiest piece you own` });
  }
  for (const s of specs) why.push({ pick: s.n, why: profile.spec?.why ?? 'spec weapon' });
  for (const p of packed) why.push({ pick: nameOf(p.id), why: p.why });

  // ── 3. Inventory ──
  const inventory: (InvSlot | null)[] = [];
  for (const s of specs) inventory.push({ id: s.id, name: s.n, kind: 'spec' });
  for (const p of packed) inventory.push({ id: p.id, name: nameOf(p.id), kind: 'switch' });

  // Spells carried → rune pouch and spellbook.
  const carriedKits = [...kits.values()].filter((k) => k === wornKit || packed.some((p) => p.id === k.weapon.id));
  const spells = carriedKits.filter((k) => k.spell).map((k) => ({ spell: k.spell!, staff: k.weapon.n }));
  const ruleSpell = profile.rules.find((r) => r.kind === 'spell');
  const books = new Set(spells.map((s) => spellByName(s.spell)?.book ?? 'standard'));
  const runes = new Map<string, number>();
  for (const s of spells) {
    const cost = SPELL_RUNES[s.spell.toLowerCase()];
    if (!cost) continue;
    const free = new Set(staffRunes(s.staff));
    for (const [r, n] of Object.entries(cost)) if (!free.has(r as never) && n) runes.set(r, Math.max(runes.get(r) ?? 0, n));
  }
  const runePouch = runes.size ? [...runes].map(([rune, perCast]) => ({ rune: rune[0].toUpperCase() + rune.slice(1), perCast })) : null;
  if (runePouch) {
    inventory.push({ id: null, name: 'Rune pouch', kind: 'pouch' });
    why.push({ pick: 'Rune pouch', why: `${runePouch.map((r) => r.rune).join(', ')} runes for ${[...new Set(spells.map((s) => s.spell))].join(', ')}` });
  }
  const bookRule = profile.rules.find((r) => r.kind === 'spellbook');
  const spellbook = (bookRule?.kind === 'spellbook' ? bookRule.book : ruleSpell?.kind === 'spell' ? ruleSpell.book : [...books][0]) ?? 'standard';
  if (books.size > 1) unmet.push({ code: 'spellbook', message: `The spells carried need different spellbooks: ${[...books].join(', ')}` });

  // Supplies: the plan's lines, in order; reserved room; then food into what is left.
  const wearsAny = (pats: string[]) => [...Object.values(worn), ...packed.map((p) => p.id)].some((id) => id != null && pats.some((p) => new RegExp(p, 'i').test(nameOf(id))));
  const venomRule = profile.rules.find((r) => r.kind === 'antivenom');
  const venomCovered = venomRule?.kind === 'antivenom' && wearsAny(venomRule.coveredBy);
  if (venomCovered) why.push({ pick: 'No anti-venom', why: 'the helm you wear blocks venom' });
  const held = player.supplies ?? null;
  if (!held) warnings.push('Supplies not known: the best form of each is assumed');
  const used = new Map<number, number>();
  let healing = 0;
  const picked = new Map<string, number>();
  const room = () => INV - inventory.length;
  const addLine = (kind: (typeof plan.supplies)[number]['kind'], count: number) => {
    const n = Math.min(count, room());
    if (n <= 0) return 0;
    const got = pickSupplies(kind, n, held, used);
    for (const g of got) {
      inventory.push({ id: g.id, name: g.name, kind: 'supply' });
      healing += g.heals;
    }
    picked.set(kind, (picked.get(kind) ?? 0) + got.length);
    if (got.length) why.push({ pick: `${got.length} × ${SUPPLY_LABEL[kind]}`, why: `${got.map((g) => g.name).filter((x, i, l) => l.indexOf(x) === i).join(', ')} (${preset} plan: ${count})` });
    else if (SUPPLY_FORMS[kind].length) warnings.push(`No ${SUPPLY_LABEL[kind]} in your bank (${SUPPLY_FORMS[kind][0].name})`);
    return got.length;
  };
  for (const line of plan.supplies.filter((l) => !l.fill && !l.reserve)) {
    if (line.kind === 'antivenom' && venomCovered) continue;
    if (room() < line.count) warnings.push(`Only room for ${room()} of ${line.count} ${SUPPLY_LABEL[line.kind]}`);
    addLine(line.kind, line.count);
  }
  for (const line of plan.supplies.filter((l) => l.reserve)) {
    const n = Math.min(line.count, room());
    for (let i = 0; i < n; i++) inventory.push({ id: null, name: 'Free slot (raid supplies)', kind: 'reserved' });
    if (n) why.push({ pick: `${n} free slots`, why: `${SUPPLY_LABEL[line.kind]} picked up inside` });
  }
  for (const line of plan.supplies.filter((l) => l.fill)) addLine(line.kind, line.count);
  while (inventory.length < INV) inventory.push(null);
  if (inventory.length > INV) unmet.push({ code: 'budget', message: `The inventory needs ${inventory.length} slots` });

  // ── 4. Hard rules ──
  const phaseOf = new Map(chosen.phases.map((p) => [p.key, p]));
  for (const t of targets) {
    const ph = phaseOf.get(t.p.key)!;
    if (ph.kit == null) unmet.push({ code: 'nothing', message: `${t.p.name}: nothing you carry can damage it${t.p.cast ? ` (needs ${t.p.cast} from a staff)` : ` (${t.p.allowed.join(' or ')})`}` });
    const kit = ph.kit ? kits.get(ph.kit) : null;
    if (kit && (t.p.immune ?? []).includes(kit.style)) unmet.push({ code: 'immune', message: `${t.p.name} is immune to ${kit.style}` });
    for (const s of t.p.required ?? []) {
      if (t.p.cast && s === 'magic') continue;
      if (!carriedKits.some((k) => k.style === s && !k.cast)) unmet.push({ code: 'style', message: `${t.p.name} needs ${s}: you own no ${s} weapon that works here` });
    }
    if (t.p.minStyles && new Set(carriedKits.filter((k) => usable(k, t.p)).map((k) => k.style)).size < t.p.minStyles) {
      unmet.push({ code: 'style', message: `${t.p.name} needs ${t.p.minStyles} styles carried` });
    }
  }
  for (const r of profile.rules) {
    if (r.kind === 'antifire') {
      const sup = picked.get('antifire-super') ?? 0;
      const any = sup + (picked.get('antifire') ?? 0);
      const shield = worn.shield != null && DRAGONFIRE_SHIELD.test(nameOf(worn.shield));
      if (r.level === 'super' ? sup === 0 : any === 0 && !shield) unmet.push({ code: 'antifire', message: `Dragonfire: a ${r.level === 'super' ? 'super ' : ''}antifire is needed and none is packed` });
      if (r.shield === 'recommended' && !shield) warnings.push('No dragonfire shield worn: pray Protect from Magic against the dragonfire');
    } else if (r.kind === 'antivenom') {
      if (!venomCovered && !(picked.get('antivenom') ?? 0)) unmet.push({ code: 'antivenom', message: 'Venom: no anti-venom packed and no helm that blocks it' });
    } else if (r.kind === 'spell') {
      const ok = carriedKits.some((k) => k.spell === r.spell);
      if (!ok) unmet.push({ code: 'spell', message: `${r.spell}: no staff that can autocast it is carried` });
      if (spellbook !== r.book) unmet.push({ code: 'spellbook', message: `${r.spell} needs the ${r.book} spellbook` });
    } else if (r.kind === 'spellbook' && [...books].some((b) => b !== r.book)) {
      unmet.push({ code: 'spellbook', message: `This fight wants the ${r.book} spellbook` });
    }
  }
  for (const s of bannedStyles) if (carriedKits.some((k) => k.style === s)) unmet.push({ code: 'constraint', message: `${s} is ruled out but carried` });

  const killsPerTrip = profile.incomingPerKill && healing > 0 ? Math.max(1, Math.floor(healing / profile.incomingPerKill)) : null;
  return {
    profile: profile.key,
    preset,
    wornStyle: wornKit.style,
    worn,
    switches: packed.map((p) => ({ id: p.id, name: nameOf(p.id), slot: p.slot, kit: p.kit })),
    specs: specs.map((s) => ({ id: s.id, name: s.n })),
    inventory: inventory.slice(0, INV),
    runePouch,
    spellbook,
    quiverAmmo,
    phases: chosen.phases,
    expectedTime: chosen.time,
    killsPerTrip,
    why,
    requirementsUnmet: unmet,
    warnings,
  };
}

/** One line per phase: "Zulrah · Tanzanite (blue): ranged 7.2 DPS, 21.0s (30%)". For the demo and tests. */
export const phaseLines = (l: Loadout): string[] => l.phases.map((p) => `${p.name}: ${p.kit ?? 'nothing'} ${fmt(p.dps)} DPS, ${secs(p.seconds)} (${Math.round(p.timeShare * 100)}%)`);
