// The loadout engine: a boss profile + a preset + a player → a real loadout (worn gear, switches,
// a 28-slot inventory, rune pouch, spellbook), each pick with a short reason. PURE: the gear index
// comes in, nothing reads the database.
//
// The profile is a reviewed REFERENCE loadout (lib/loadout/types): a main style, switches as named
// jobs, spec weapons in order, a supply plan. The engine steps it down to the player's bank:
//   1. the worn kit: for the main style, the owned weapons that can hurt the phases it fights (ammo
//      paired, darts, an autocast spell), then armour by coordinate ascent over each slot's shortlist,
//      with SETS (Void, Inquisitor's, crystal) tried as whole units; empty slots filled with the best
//      defence that costs nothing. Our own ladder: DPS within the style, first owned wins.
//   2. each job: its ladder (DPS on its phases within its style, the profile's order, or its own
//      rule) walked to the first owned item the player can equip; the worn weapon may already do it;
//      nothing owned drops the job with a card line. Then armour pieces for each switch style, by
//      seconds saved, within the plan's piece caps and switch budget.
//   3. each phase: the profile's job for it, another listed one only when at least 15% faster (with a
//      why line). Attack style (stance) is worked out from the assembled gear, every weapon style tried.
//   4. each allowed main style is built this way; another is worn only when at least 15% faster.
//   5. the inventory: specs, switches, the plan's supplies, the rest empty; the rune pouch from the
//      spells carried; then the hard rules (gates, immunities, the profile's rules), never dropped.
//
// Helpers copied from lib/tripCheck (not exported there): slotOf, shortlist/kindScore and SETS.
// Imported from it: ammoFits, isSpecWeapon, usableHeld, raidScaled, calcSpell, SPELL_RUNES, staffRunes.

import { calculate, type DpsResult, type GearItem, type Monster, type Stats } from '../dps/engine';
import { POWERED_MAX, SLOTS, spellByName, stylesFor, type AttackStyle, type AttackType, type Slot } from '../dps/tables';
import type { GearIndex } from '../dps/summary';
import { SPELL_RUNES, ammoFits, calcSpell, isSpecWeapon, raidScaled, staffRunes, usableHeld } from '../tripCheck';
import { SUPPLY_FORMS, SUPPLY_LABEL, pickSupplies } from './supplies';
import { STYLES, type BossProfile, type InvSlot, type JobProfile, type Loadout, type LoadoutJob, type LoadoutPhase, type PhaseProfile, type PlayerInput, type Preset, type SpecSlot, type Style, type SupplyLine, type Unmet, type Why } from './types';

export interface EngineInput {
  profile: BossProfile;
  preset: Preset;
  player: PlayerInput;
  idx: GearIndex;
  /**
   * Whether the player can wear an item with their levels: null when they can, else the reason
   * ("needs 75 Attack"). Unset: everything is wearable.
   */
  canEquip?: (it: GearItem) => string | null;
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
  /** Only these attack types count (a stab switch). */
  types?: AttackType[];
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
  /** Controlled, defensive and longrange stances (and defensive autocast) left out. */
  avoidDefence: boolean;
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

/** A gear set as part of a memo key. */
function gearKey(gear: Gear): string {
  let k = '';
  for (const s of SLOTS) k += `${gear[s] ?? ''},`;
  return k;
}

/** `gk`: the gear's key when the caller already has it (one gear set over many phases). */
type KitLike = Pick<Kit, 'style' | 'spell' | 'dart' | 'types'>;

function dpsOn(gear: Gear, kit: KitLike, t: Target, ctx: Ctx, gk = gearKey(gear)): { dps: number; r: DpsResult } | null {
  const key = `${t.p.key}|${kit.style}|${kit.spell ?? ''}|${kit.dart ?? ''}|${kit.types?.join('/') ?? ''}|${gk}`;
  if (ctx.memo.has(key)) return ctx.memo.get(key)!;
  const out = dpsOnUncached(gear, kit, t, ctx);
  ctx.memo.set(key, out);
  return out;
}

/** Stances that give Defence experience. */
const DEFENCE_XP = (s: AttackStyle) => s.stance === 'controlled' || s.stance === 'defensive' || s.stance === 'longrange' || /^defensive autocast$/i.test(s.name);

function dpsOnUncached(gear: Gear, kit: KitLike, t: Target, ctx: Ctx): { dps: number; r: DpsResult } | null {
  const weapon = ctx.idx.item(gear.weapon);
  if (!weapon) return null;
  let best: { dps: number; r: DpsResult } | null = null;
  // The phase's own cut on this style (the Olm's head takes a third from melee and magic).
  const taken = t.p.taken?.[kit.style] ?? 1;
  if (taken <= 0) return null;
  stylesFor(weapon.c).forEach((s, i) => {
    if (kindOfType(s.type) !== kit.style) return;
    if (kit.types && !kit.types.includes(s.type)) return;
    if (ctx.avoidDefence && DEFENCE_XP(s)) return;
    const r = calculate(
      { gear, style: i, spell: kit.spell, dart: kit.dart, stats: ctx.stats, prayer: ctx.prayers, boost: ctx.boosts[kit.style] ?? null, onTask: false },
      t.m,
      ctx.idx.item,
      ctx.idx.rules,
    );
    if (!r || !(r.maxHit > 0)) return;
    // Osmumten's fang's second accuracy roll is the DPS engine's own (lib/dps/engine).
    let dps = r.dps;
    if (t.p.alwaysMaxHit) dps = r.maxHit / (r.speed * TICK);
    else if (t.p.alwaysHits && r.accuracy > 0) dps = r.dps / r.accuracy;
    else if (t.p.maxHitCap && r.maxHit > t.p.maxHitCap && r.maxHit > 0) dps *= cappedMean(r.maxHit, t.p.maxHitCap) / (r.maxHit / 2);
    dps *= taken;
    if (!best || dps > best.dps) best = { dps, r };
  });
  return best;
}

const usable = (kit: Pick<Kit, 'style' | 'cast'>, p: PhaseProfile) =>
  kit.cast ? p.cast === kit.cast : !p.cast && p.allowed.includes(kit.style) && !(p.immune ?? []).includes(kit.style);

/**
 * Seconds a gear set needs over the phases it is meant for (Infinity if it can't hurt one). With a
 * `limit`, Infinity as soon as the sum passes it: a trial that can't beat the best so far stops early.
 */
function phaseCost(gear: Gear, kit: KitLike, targets: Target[], ctx: Ctx, limit = Infinity): number {
  let total = 0;
  const gk = gearKey(gear);
  for (const t of targets) {
    const d = dpsOn(gear, kit, t, ctx, gk);
    if (!d || d.dps <= 0) return Infinity;
    total += t.damage / d.dps;
    if (total > limit) return Infinity;
  }
  return total;
}

// ── The engine ──────────────────────────────────────────────────────────────────────────────

/** Another job (or main style) takes over only when it is at least this much faster. */
export const SWITCH_MARGIN = 1.15;

/** Magic levels for the spells a job may ask for by name. */
const SPELL_LEVEL: Record<string, number> = { 'dark demonbane': 82, 'superior demonbane': 62, 'inferior demonbane': 44, 'crumble undead': 39, 'ice barrage': 94, 'fire surge': 95, 'earth surge': 90 };

/** Hitsplats one swing lands on a target of this size (Doom's punish counts each). */
const hitsplats = (w: GearItem, size: number) => (/^scythe of vitur/i.test(w.n) ? Math.min(3, Math.max(1, size - 1)) : /^dual macuahuitl/i.test(w.n) || /^(dragon|burning) claws/i.test(w.n) ? 2 : 1);

/** A name pattern as words: "^(burning|dragon) claws" → "Burning claws". */
const pretty = (pat: string) => {
  const t = pat
    .replace(/^\^/, '')
    .replace(/\(([^()|]*)\|[^()]*\)/g, '$1')
    .replace(/\\([()])/g, '$1')
    .replace(/[\\$?*+[\]]/g, '')
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : pat;
};

interface Job extends Omit<JobProfile, 'style'> {
  style: Style;
}

interface Filled {
  job: Job;
  /** The weapon kit doing it (null: a piece job, or nothing owned). */
  kit: Kit | null;
  /** A piece job's item. */
  piece?: { slot: Slot; id: number };
  /** The worn kit does it: nothing packed. */
  byWorn: boolean;
  stepDown?: string;
  blocked?: string;
}

interface Packed {
  id: number;
  slot: Slot;
  /** The style kit it belongs to ('cast:<spell>' for a caster). */
  kit: string;
  job: string;
  why: string;
}

interface Build {
  main: Style;
  wornKit: Kit;
  worn: Gear;
  filled: Filled[];
  packed: Packed[];
  specs: { it: GearItem; why: string; stepDown?: string }[];
  notes: string[];
  /** Supplies that take the slots of what is missing. */
  extra: { kind: SupplyLine['kind']; count: number }[];
  phases: LoadoutPhase[];
  time: number;
  over: number;
}

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
    avoidDefence: !!player.avoidDefenceXp,
    memo: new Map(),
  };

  // The fight's targets, scaled to the mode (a ToA raid level).
  const raidLevel = profile.modes?.some((m) => m.key === 'raidLevel') ? (player.mode?.raidLevel ?? profile.modes.find((m) => m.key === 'raidLevel')!.default) : null;
  const variant = profile.variants?.find((v) => v.key === player.mode?.variant) ?? profile.variants?.[0] ?? null;
  const targets: Target[] = [];
  const phaseStyles = player.constraints?.phaseStyles ?? {};
  for (const raw of profile.phases) {
    // A CA's "this phase with melee only": those styles are the phase's, the others ruled out there.
    const only = phaseStyles[raw.key];
    const p: PhaseProfile = only?.length
      ? { ...raw, allowed: [...only], required: (raw.required ?? []).filter((s) => only.includes(s)), immune: STYLES.filter((s) => !only.includes(s)), prefer: undefined, taken: undefined }
      : raw;
    const base = idx.monster(variant?.monsters[p.key] ?? p.monster);
    if (!base) {
      unmet.push({ code: 'nothing', message: `${p.name}: the gear data has no ${p.monster}` });
      continue;
    }
    let m: Monster = { ...base, ...(p.asName ? { n: p.asName } : {}), ...(p.size ? { sz: p.size } : {}) };
    if (p.tags?.length) m = { ...m, a: [...new Set([...(m.a ?? []), ...p.tags])] };
    if (raidLevel) m = raidScaled(m, raidLevel);
    targets.push({ p, m, damage: m.hp * p.share });
  }
  const targetOf = new Map(targets.map((t) => [t.p.key, t]));

  // The pool: what the player holds that main-game PvM can use, and can wear.
  const bannedNames = (player.constraints?.bannedNames ?? []).map((p) => new RegExp(p, 'i'));
  const weaponsOnly = player.constraints?.weaponsOnly?.length ? player.constraints.weaponsOnly.map((p) => new RegExp(p, 'i')) : null;
  const held = [...new Set(player.owned)]
    .filter((id) => !banned.has(id))
    .map((id) => idx.item(id))
    .filter((x): x is GearItem => !!x && !x.hid && usableHeld(x.n))
    .filter((x) => !bannedNames.some((re) => re.test(x.n)) && (!weaponsOnly || slotOf(x) !== 'weapon' || weaponsOnly.some((re) => re.test(x.n))));
  const blockedWhy = new Map<number, string>();
  for (const it of held) {
    const r = input.canEquip?.(it) ?? null;
    if (r) blockedWhy.set(it.id, r);
  }
  const pool = held.filter((x) => !blockedWhy.has(x.id));
  const weapons = pool.filter((x) => slotOf(x) === 'weapon');
  const ammoPool = pool.filter((x) => x.s === 'ammo');
  const darts = pool.filter((x) => /dart$/i.test(x.n) && x.c === 'Thrown').sort((a, b) => b.b[6] - a.b[6]);
  const lists = { melee: shortlist(pool, 'melee'), ranged: shortlist(pool, 'ranged'), magic: shortlist(pool, 'magic') };
  /** The player holds the reference item (any form), wearable or not: a lesser pick is no step-down then. */
  const ownsRef = (ref: string) => held.some((it) => defaultFamily(it.n).startsWith(ref.toLowerCase()));

  const ofStyle = (w: GearItem, style: Style) => stylesFor(w.c).some((s) => kindOfType(s.type) === style) && !(style === 'melee' && (canAutocast(w) || isPowered(w)));
  const typesOk = (w: GearItem, types?: AttackType[]) => !types || stylesFor(w.c).some((s) => types.includes(s.type));
  const pats = (list?: string[]) => (list ?? []).map((p) => new RegExp(p, 'i'));
  const jobSpell = (job: Pick<Job, 'spells'> | undefined, w: GearItem, ts: Target[]): string | null => {
    if (isPowered(w)) return null;
    if (job?.spells?.length) {
      // Demonbane spells only work on demons: the job's spells are for its own phases.
      for (const sp of job.spells) if (lv.magic >= (SPELL_LEVEL[sp.toLowerCase()] ?? 1)) return sp;
      return null;
    }
    const heaviest = [...ts].sort((a, b) => b.damage - a.damage)[0];
    return calcSpell(0, lv.magic, heaviest?.m.ew);
  };

  /** A kit for one weapon: its ammo (best for these targets), darts, spell. Null when it can't fire. */
  function kitOf(w: GearItem, style: Style, ts: Target[], job?: Job): Kit | null {
    const dart = /blowpipe/i.test(w.n) ? (darts[0]?.id ?? null) : null;
    if (/blowpipe/i.test(w.n) && dart == null) return null;
    let spell: string | null = null;
    if (style === 'magic' && !isPowered(w)) {
      if (!canAutocast(w) && w.c !== 'Salamander') return null;
      spell = job?.cast ?? jobSpell(job, w, ts);
      if (!spell) return null;
    }
    const base = { key: job?.cast ? `cast:${job.cast}` : style, style, weapon: w, spell, dart, ...(job?.cast ? { cast: job.cast } : {}), ...(job?.types ? { types: job.types } : {}) };
    let gear: Gear = { weapon: w.id };
    if (style === 'ranged' && needsAmmo(w)) {
      const fits = ammoPool.filter((a) => ammoFits(w, a)).sort((a, b) => b.b[6] - a.b[6]).slice(0, 6);
      let bestA: { id: number; cost: number } | null = null;
      for (const a of fits) {
        const c = ts.length ? phaseCost({ weapon: w.id, ammo: a.id }, base, ts, ctx) : -a.b[6];
        if (!bestA || c < bestA.cost) bestA = { id: a.id, cost: c };
      }
      if (!bestA) return null;
      gear = { ...gear, ammo: bestA.id };
    }
    return { ...base, gear };
  }

  /** The best kit of one style over these targets: weapon candidates, then armour by ascent. */
  function kitFor(style: Style, ts: Target[], filter: (w: GearItem) => boolean = () => true, job?: Job): Kit | null {
    if (!ts.length) return null;
    const cands0 = weapons.filter((w) => ofStyle(w, style) && filter(w) && typesOk(w, job?.types));
    // Spec weapons are carried for their spec, not to fight with, unless nothing else does it.
    const plain = cands0.filter((w) => !isSpecWeapon(w.n));
    const cands: { kit: Kit; cost: number }[] = [];
    for (const w of plain.length ? plain : cands0) {
      const k = kitOf(w, style, ts, job);
      if (!k) continue;
      const cost = phaseCost(k.gear, k, ts, ctx);
      if (Number.isFinite(cost)) cands.push({ kit: k, cost });
    }
    let best: { kit: Kit; cost: number } | null = null;
    for (const c of cands.sort((a, b) => a.cost - b.cost).slice(0, 3)) {
      const k = ascend(c.kit, ts);
      const cost = phaseCost(k.gear, k, ts, ctx);
      if (!best || cost < best.cost) best = { kit: k, cost };
    }
    return best?.kit ?? null;
  }

  function ascend(kit: Kit, all: Target[]): Kit {
    // The heaviest phases first, so a losing trial passes the limit soonest.
    const ts = [...all].sort((a, b) => b.damage - a.damage);
    const gear: Gear = { ...kit.gear };
    const w = kit.weapon;
    let cost = phaseCost(gear, kit, ts, ctx);
    const list = lists[kit.style];
    const slots = SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo' && !(s === 'shield' && w.h2));
    const tryGear = (trial: Gear) => {
      const c = phaseCost(trial, kit, ts, ctx, cost - EPS);
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
        if (phaseCost(trial, kit, ts, ctx, cost + EPS) <= cost + EPS) {
          gear[slot] = c.id;
          break;
        }
      }
    }
    return { ...kit, gear, ...(set ? { set } : {}) };
  }

  // ── The reference's jobs, for one main style ──
  const mainStyles = (): Style[] => {
    const list = profile.main ?? (profile.worn ? [profile.worn] : STYLES.filter((s) => targets.some((t) => usable({ style: s }, t.p))));
    // A CA's ruled-out style can't be worn; another allowed one can.
    const ok = list.filter((s) => !bannedStyles.has(s));
    return ok.length ? ok : STYLES.filter((s) => !bannedStyles.has(s) && targets.some((t) => usable({ style: s }, t.p)));
  };
  const usesOf = (p: PhaseProfile): string[] => p.use ?? ['main'];
  const styles = mainStyles();

  function jobsFor(main: Style): Job[] {
    const raw = profile.jobs ?? [];
    const out: Job[] = [];
    if (!raw.some((j) => j.key === 'main')) out.push({ key: 'main', label: 'Main', style: main });
    for (const j of raw) {
      if (j.presets && !j.presets.includes(preset)) continue;
      const style = j.style === 'main' ? main : j.style;
      if (bannedStyles.has(style) && !j.cast) continue;
      out.push({ ...j, style });
    }
    // A CA's "this phase with melee only" needs a job of that style for it, if the reference has none.
    for (const [key, styles] of Object.entries(phaseStyles)) {
      const p = profile.phases.find((x) => x.key === key);
      if (!p) continue;
      for (const st of styles) if (!out.some((j) => j.style === st && (j.key === 'main' || (j.phases ?? []).includes(key) || usesOf(p).includes(j.key)))) out.push({ key: `only-${key}-${st}`, label: `${st[0].toUpperCase()}${st.slice(1)} for ${p.name}`, style: st, phases: [key] });
    }
    return out;
  }
  /** The jobs a phase may use: the profile's list, a CA's styles only. */
  function phaseJobs(t: Target, jobs: Job[]): Job[] {
    const only = phaseStyles[t.p.key];
    let keys = usesOf(t.p);
    if (only?.length) keys = [...keys, ...jobs.filter((j) => j.key.startsWith(`only-${t.p.key}-`)).map((j) => j.key)];
    const list = keys.map((k) => jobs.find((j) => j.key === k)).filter((j): j is Job => !!j);
    return only?.length ? list.filter((j) => only.includes(j.style)) : list;
  }
  /** The phases a job is ranked on: its own list, else every phase that lists it. */
  const jobTargets = (job: Job, jobs: Job[]): Target[] => {
    const keys = job.phases ?? targets.filter((t) => phaseJobs(t, jobs).some((j) => j.key === job.key)).map((t) => t.p.key);
    return keys.map((k) => targetOf.get(k)).filter((t): t is Target => !!t && usable({ style: job.style, cast: job.cast }, t.p));
  };

  /** A better owned weapon for the job that the levels don't allow: "Scythe of vitur needs 75 Attack, using …". */
  function blockedFor(job: Job, kit: Kit, ts: Target[], filter: (w: GearItem) => boolean, wornGear: Gear): string | undefined {
    if (!blockedWhy.size) return undefined;
    // Weapon against weapon, in the same armour.
    const armed = (k: Kit): Gear => {
      const g: Gear = { ...wornGear, weapon: k.weapon.id };
      if (k.gear.ammo != null) g.ammo = k.gear.ammo;
      else delete g.ammo;
      if (k.weapon.h2) delete g.shield;
      return g;
    };
    const mine = ts.length ? phaseCost(armed(kit), kit, ts, ctx) : -kindScore(kit.weapon.b, job.style);
    for (const it of held) {
      const reason = blockedWhy.get(it.id);
      if (!reason || slotOf(it) !== 'weapon' || !ofStyle(it, job.style) || !filter(it)) continue;
      const k = kitOf(it, job.style, ts, job);
      if (!k) continue;
      const theirs = ts.length ? phaseCost(armed(k), k, ts, ctx) : -kindScore(it.b, job.style);
      if (theirs < mine - EPS) return `${it.n} ${reason}, using ${kit.weapon.n}`;
    }
    return undefined;
  }

  /** Each job's pick: its ladder walked to the first owned, wearable item. */
  function fillJob(job: Job, jobs: Job[], wornKit: Kit): Filled {
    const ts = jobTargets(job, jobs);
    const allow = pats(job.weapons);
    const filter = (w: GearItem) => !allow.length || allow.some((re) => re.test(w.n));
    const ladderOrder = (list: GearItem[]) => {
      for (const re of allow) {
        const hit = list.find((w) => re.test(w.n));
        if (hit) return hit;
      }
      return null;
    };
    let kit: Kit | null = null;
    if (job.piece) {
      const items = pats(job.piece.items);
      for (const re of items) {
        const it = pool.find((x) => slotOf(x) === job.piece!.slot && re.test(x.n));
        if (it) return { job, kit: null, piece: { slot: job.piece.slot, id: it.id }, byWorn: wornKit.gear[job.piece.slot] === it.id };
      }
      return { job, kit: null, byWorn: false };
    }
    if (job.cast) {
      // A staff that autocasts the spell: weapon only.
      const casters = weapons.filter(canAutocast).filter(filter);
      let best: { k: Kit; d: number } | null = null;
      for (const w of casters) {
        const k = kitOf(w, 'magic', ts, job);
        if (!k) continue;
        const d = ts.length ? (dpsOn(k.gear, k, ts[0], ctx)?.dps ?? 0) : 1;
        if (d > 0 && (!best || d > best.d)) best = { k, d };
      }
      kit = best?.k ?? null;
    } else if (job.rank === 'order') {
      const list = weapons.filter((w) => ofStyle(w, job.style) && typesOk(w, job.types));
      const w = ladderOrder(list);
      kit = w ? kitOf(w, job.style, ts, job) : null;
    } else if (job.rank === 'punish') {
      const size = ts[0]?.m.sz ?? 1;
      const list = weapons.filter((w) => ofStyle(w, 'melee') && filter(w)).sort((a, b) => b.b[5] * hitsplats(b, size) - a.b[5] * hitsplats(a, size) || (a.sp ?? 4) - (b.sp ?? 4));
      kit = list[0] ? kitOf(list[0], 'melee', ts, job) : null;
    } else if (ts.length) {
      kit = kitFor(job.style, ts, filter, job);
    } else {
      // No phase to rank on: the strongest by the bonuses the style reads.
      const list = weapons.filter((w) => ofStyle(w, job.style) && filter(w) && typesOk(w, job.types)).sort((a, b) => kindScore(b.b, job.style) - kindScore(a.b, job.style));
      for (const w of list) if ((kit = kitOf(w, job.style, ts, job))) break;
    }
    if (!kit) return { job, kit: null, byWorn: false };
    const byWorn = !job.cast && kit.style === wornKit.style && fam(kit.weapon.id) === fam(wornKit.weapon.id);
    // The reference pick, when the player's is a lesser one.
    const stepDown = job.ref && !defaultFamily(kit.weapon.n).startsWith(job.ref.toLowerCase()) && !ownsRef(job.ref) ? job.ref : undefined;
    const blocked = blockedFor(job, kit, ts, filter, wornKit.gear);
    return { job, kit, byWorn, ...(stepDown ? { stepDown } : {}), ...(blocked ? { blocked } : {}) };
  }

  const budget = Math.min(plan.switchBudget, player.constraints?.maxSwitches ?? Infinity);
  const specCount = player.constraints?.noSpec ? 0 : plan.specs;
  const specSlots: SpecSlot[] = profile.specs ?? (profile.spec ? Array.from({ length: specCount }, () => ({ weapons: profile.spec!.prefer, why: profile.spec!.why })) : []);

  /**
   * A main style's build, twice: switches no part of the fight ended up using (the Arclight when the
   * Scorching bow does the shield better) are left in the bank and the slots go back to the rest.
   */
  function build(main: Style): Build | null {
    const first = buildOnce(main, new Set());
    if (!first) return null;
    const used = new Set(first.phases.map((p) => p.job));
    const idle = new Set(first.filled.filter((f) => f.kit && !f.byWorn && f.job.phases?.length && f.job.rank !== 'punish' && !used.has(f.job.key) && !first.filled.some((g) => g !== f && used.has(g.job.key) && g.kit?.weapon.id === f.kit!.weapon.id)).map((f) => f.job.key));
    return idle.size ? (buildOnce(main, idle) ?? first) : first;
  }

  function buildOnce(main: Style, idle: Set<string>): Build | null {
    const jobs = jobsFor(main).filter((j) => !idle.has(j.key));
    const mainJob0 = jobs.find((j) => j.key === 'main')!;
    // The reference item is the reference style's: another main style has its own ladder.
    const mainJob = main === styles[0] ? mainJob0 : { ...mainJob0, ref: undefined };
    const mainTs = jobTargets(mainJob, jobs);
    const mainAllow = pats(mainJob.weapons);
    const wornKit = kitFor(main, mainTs.length ? mainTs : targets.filter((t) => usable({ style: main }, t.p)), (w) => !mainAllow.length || mainAllow.some((re) => re.test(w.n)), mainJob);
    if (!wornKit) return null;
    const worn: Gear = { ...wornKit.gear };
    const notes: string[] = [];
    const extra: Build['extra'] = [];

    // Spec weapons, in the order players use them.
    const specs: { it: GearItem; why: string; stepDown?: string }[] = [];
    for (const slot of specSlots.slice(0, specCount)) {
      const res = pats(slot.weapons);
      let it: GearItem | undefined;
      for (const re of res) {
        it = weapons.find((w) => re.test(w.n) && fam(w.id) !== fam(wornKit.weapon.id) && !specs.some((s) => fam(s.it.id) === fam(w.id)));
        if (it) break;
      }
      if (it) specs.push({ it, why: slot.why, ...(slot.ref && !defaultFamily(it.n).startsWith(slot.ref.toLowerCase()) && !ownsRef(slot.ref) ? { stepDown: slot.ref } : {}) });
      else {
        notes.push(slot.missing ?? `No ${pretty(slot.weapons[0])} for the spec`);
        if (slot.instead) extra.push(slot.instead);
      }
    }
    if (plan.lightbearer && specs.length) {
      const lb = pool.find((x) => LIGHTBEARER.test(x.n));
      if (lb) worn.ring = lb.id;
    }

    // The jobs' picks.
    const filled = jobs.filter((j) => j.key !== 'main').map((j) => fillJob(j, jobs, { ...wornKit, gear: worn }));
    const packed: Packed[] = [];
    const isNew = (id: number) => !packed.some((p) => p.id === id) && !Object.values(worn).includes(id) && !specs.some((s) => s.it.id === id);
    const famTaken = (id: number) => [...Object.values(worn), ...packed.map((p) => p.id), ...specs.map((s) => s.it.id)].some((x) => x != null && x !== id && fam(x) === fam(id));
    for (const f of filled) {
      if (!f.kit && !f.piece) {
        if (!f.job.optional || f.job.missing) notes.push(f.job.missing ?? `${f.job.label}: nothing in your bank does it`);
        if (f.job.required) unmetJobs.add(f.job.key);
        continue;
      }
      if (f.byWorn) continue;
      if (f.piece) {
        if (isNew(f.piece.id) && !famTaken(f.piece.id)) packed.push({ id: f.piece.id, slot: f.piece.slot, kit: 'piece', job: f.job.key, why: `${f.job.label}` });
        continue;
      }
      const k = f.kit!;
      const ids = [k.weapon.id, ...(k.style === 'ranged' && k.gear.ammo != null && k.gear.ammo !== worn.ammo ? [k.gear.ammo] : [])];
      for (const id of ids) if (isNew(id) && !famTaken(id)) packed.push({ id, slot: slotOf(idx.item(id))!, kit: k.key, job: f.job.key, why: f.job.label });
    }
    const weaponSlots = packed.length + specs.length;
    const over = Math.max(0, weaponSlots - budget);
    let piecesLeft = budget - weaponSlots;

    /** The gear a job fights in: the worn kit, its weapon, every packed piece of its style, piece swaps for the phase. */
    const effective = (f: Filled, t: Target | null): Gear | null => {
      if (!f.kit) return null;
      const g: Gear = { ...worn };
      if (!f.byWorn) {
        for (const p of packed) if (p.kit === f.kit.key && slotOf(idx.item(p.id)) !== 'weapon' && slotOf(idx.item(p.id)) !== 'ammo') g[p.slot] = p.id;
        g.weapon = f.kit.weapon.id;
        if (f.kit.gear.ammo != null) g.ammo = f.kit.gear.ammo;
      }
      if (t) for (const pf of filled) if (pf.piece && (pf.job.phases ?? []).includes(t.p.key)) g[pf.piece.slot] = pf.piece.id;
      if (idx.item(g.weapon)?.h2) delete g.shield;
      if (f.kit.style === 'ranged' && needsAmmo(f.kit.weapon) && (g.ammo == null || !ammoFits(f.kit.weapon, idx.item(g.ammo)!))) return null;
      return g;
    };
    const mainBlocked = blockedFor(mainJob, wornKit, mainTs, (w) => !mainAllow.length || mainAllow.some((re) => re.test(w.n)), wornKit.gear);
    const mainFilled: Filled = {
      job: mainJob,
      kit: wornKit,
      byWorn: true,
      ...(mainJob.ref && !defaultFamily(wornKit.weapon.n).startsWith(mainJob.ref.toLowerCase()) && !ownsRef(mainJob.ref) ? { stepDown: mainJob.ref } : {}),
      ...(mainBlocked ? { blocked: mainBlocked } : {}),
    };

    // Armour for each switch: the pieces that save the most seconds on the job's phases, within caps.
    // A switch that can't hurt its phases in the worn armour (a Shadow in Torva) goes first.
    const helpless = (f: Filled) => !Number.isFinite(phaseCost(effective(f, null) ?? {}, f.kit!, jobTargets(f.job, jobs), ctx));
    const order = filled.filter((f) => f.kit && !f.byWorn && !f.job.cast);
    order.sort((a, b) => Number(helpless(b)) - Number(helpless(a)));
    for (const f of order) {
      if (!f.kit || f.byWorn || f.job.cast || piecesLeft <= 0) continue;
      const cap = f.job.pieces?.[preset] ?? plan.kitPieces?.[f.kit.style] ?? 0;
      const ts = jobTargets(f.job, jobs);
      if (!cap || !ts.length) continue;
      const full = f.job.rank === 'dps' || !f.job.rank ? f.kit : ascend(f.kit, ts);
      let n = packed.filter((p) => p.kit === f.kit!.key && p.slot !== 'weapon' && p.slot !== 'ammo').length;
      for (;;) {
        if (n >= cap || piecesLeft <= 0) break;
        const base = effective(f, null)!;
        const cur = phaseCost(base, f.kit, ts, ctx);
        let best: { id: number; slot: Slot; gain: number } | null = null;
        for (const slot of SLOTS) {
          if (slot === 'weapon' || slot === 'ammo') continue;
          const id = full.gear[slot];
          if (id == null || base[slot] === id || !isNew(id) || famTaken(id)) continue;
          // Another switch of this style already carries that slot.
          if (packed.some((p) => p.kit === f.kit!.key && p.slot === slot)) continue;
          const c = phaseCost({ ...base, [slot]: id }, f.kit, ts, ctx);
          // Still helpless: the piece that adds the most of what the style reads.
          const gain = Number.isFinite(cur) ? cur - c : Number.isFinite(c) ? 1e6 - c : kindScore(idx.item(id)!.b, f.kit.style) - kindScore(idx.item(base[slot])?.b ?? [0, 0, 0, 0, 0, 0, 0, 0, 0], f.kit.style);
          if (gain > 0.05 && (!best || gain > best.gain)) best = { id, slot, gain };
        }
        if (!best) break;
        packed.push({ id: best.id, slot: best.slot, kit: f.kit.key, job: f.job.key, why: Number.isFinite(cur) ? `${f.job.label}: saves ${best.gain.toFixed(1)}s a kill` : `${f.job.label}: the worn armour leaves it unable to hit` });
        n++;
        piecesLeft--;
      }
    }

    // Each phase: the reference job, another listed one only when clearly faster.
    const all: Filled[] = [mainFilled, ...filled];
    const byKey = new Map(all.map((f) => [f.job.key, f]));
    let time = 0;
    const phases: LoadoutPhase[] = [];
    for (const t of targets) {
      const opts: { f: Filled; s: number; dps: number; r: DpsResult }[] = [];
      const listed = phaseJobs(t, jobs).map((j) => byKey.get(j.key)).filter((f): f is Filled => !!f && !!f.kit);
      const fallback = all.filter((f) => f.kit && !listed.includes(f));
      const score = (f: Filled) => {
        if (!f.kit || !usable(f.kit, t.p)) return null;
        const g = effective(f, t);
        if (!g) return null;
        const d = dpsOn(g, f.kit, t, ctx);
        if (!d || d.dps <= 0) return null;
        const items = f.byWorn ? 0 : packed.filter((p) => p.kit === f.kit!.key).length + 1;
        const swap = f.byWorn ? 0 : TICK * Math.ceil(items / 3) * (t.p.entries ?? 1);
        return { f, s: t.damage / d.dps + swap, dps: d.dps, r: d.r };
      };
      for (const f of listed) {
        const o = score(f);
        if (o) opts.push(o);
      }
      let pick = opts[0] ?? null;
      let reason: string | undefined;
      // The reviewed pick stands when the player holds the reference item: another style takes over
      // only from a stepped-down reference (or one the profile names no reference item for).
      const locked = !!pick && !!pick.f.job.ref && !pick.f.stepDown;
      if (pick && !locked) {
        const best = [...opts].sort((a, b) => a.s - b.s)[0];
        if (best !== pick && best.s * SWITCH_MARGIN <= pick.s) {
          const lacks = pick.f.stepDown ? `no ${pick.f.stepDown}, so ` : '';
          reason = `${lacks}your ${best.f.kit!.style} setup is faster here${lacks ? '' : ` (${Math.round((pick.s / best.s - 1) * 100)}%)`}`;
          pick = best;
        }
      } else if (!pick && !t.p.gate && !phaseJobs(t, jobs).some((j) => j.required)) {
        // Nothing the profile lists for it can be filled: the fastest carried kit that can (a gate,
        // like the Guardians' pickaxe, has no stand-in).
        const alt = fallback.map(score).filter((o): o is NonNullable<typeof o> => !!o).sort((a, b) => a.s - b.s)[0];
        if (alt) {
          pick = alt;
          const firstListed = phaseJobs(t, jobs)[0];
          reason = firstListed ? `no ${firstListed.label.toLowerCase()} pick, so your ${alt.f.kit!.style} setup` : undefined;
        }
      }
      const s = (pick?.s ?? Infinity) + (t.p.downtime ?? 0);
      time += s;
      const w = pick ? idx.item(effective(pick.f, t)?.weapon) : null;
      phases.push({
        key: t.p.key,
        name: t.p.name,
        kit: pick?.f.kit?.key ?? null,
        job: pick?.f.job.key ?? null,
        stance: pick && w ? { weapon: w.n, type: pick.r.style.type, name: pick.r.style.name } : null,
        ...(reason ? { why: reason } : {}),
        dps: pick?.dps ?? 0,
        seconds: s,
        timeShare: 0,
      });
    }
    for (const ph of phases) ph.timeShare = Number.isFinite(time) && time > 0 ? ph.seconds / time : 0;
    return { main, wornKit, worn, filled: [mainFilled, ...filled], packed, specs, notes, extra, phases, time, over };
  }
  const unmetJobs = new Set<string>();

  // Every allowed main style, the reference first; another only when clearly faster.
  const builds = styles.map((m) => ({ m, b: build(m) }));
  const refB = builds.find((x) => x.b && Number.isFinite(x.b.time))?.b ?? builds.find((x) => x.b)?.b ?? null;
  let chosen = refB;
  let mainWhy: string | null = null;
  if (refB) {
    const alt = builds.map((x) => x.b).filter((b): b is Build => !!b && b !== refB && Number.isFinite(b.time)).sort((a, b) => a.time - b.time)[0];
    const refLocked = !!refB.filled[0].job.ref && !refB.filled[0].stepDown && Number.isFinite(refB.time);
    if (alt && !refLocked && alt.time * SWITCH_MARGIN <= refB.time) chosen = alt;
    if (chosen !== refB) {
      const lack = refB.filled[0].stepDown;
      mainWhy = `${lack ? `No ${lack}: your` : 'Your'} ${chosen!.main} setup is faster here than ${refB.main} (${Math.round((refB.time / chosen!.time - 1) * 100)}%)`;
    } else if (styles[0] !== refB.main) {
      mainWhy = `Nothing you own fights it with ${styles[0]}: ${refB.main} instead`;
    }
  }
  if (chosen && chosen.over) warnings.push(`The switches go ${chosen.over} slot${chosen.over > 1 ? 's' : ''} over the ${preset} budget of ${budget}`);

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
      spells: [],
      spellbook: 'standard',
      quiverAmmo: null,
      phases: targets.map((t) => ({ key: t.p.key, name: t.p.name, kit: null, job: null, stance: null, dps: 0, seconds: Infinity, timeShare: 0 })),
      expectedTime: Infinity,
      killsPerTrip: null,
      why,
      jobs: [],
      notes: [],
      requirementsUnmet: unmet,
      warnings,
    };
  }
  // Only the chosen build's missing gates count.
  unmetJobs.clear();
  for (const f of chosen.filled) if (!f.kit && !f.piece && f.job.required) unmetJobs.add(f.job.key);
  const { wornKit, worn, packed } = chosen;
  const specs = chosen.specs.map((s) => s.it);
  const notes = [...(mainWhy ? [mainWhy] : []), ...chosen.notes];

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
  const wornTargets = targets.filter((t) => chosen!.phases.find((p) => p.key === t.p.key)?.job === 'main');
  const wornCost = phaseCost(worn, wornKit, wornTargets, ctx);
  const main = wornTargets.length ? [...wornTargets].sort((x, y) => y.damage - x.damage)[0] : null;
  const mainDps = main ? (dpsOn(worn, wornKit, main, ctx)?.dps ?? 0) : 0;
  why.push({ pick: wornKit.weapon.n, why: `worn ${wornKit.style}: the best you own for ${wornTargets.map((t) => t.p.name).join(', ') || 'this fight'}${main ? ` (${fmt(mainDps)} DPS on ${main.p.name})` : ''}` });
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
  for (const s of chosen.specs) why.push({ pick: s.it.n, why: s.why });
  for (const p of packed) why.push({ pick: nameOf(p.id), why: p.why });

  // ── 3. Inventory ──
  const inventory: (InvSlot | null)[] = [];
  for (const s of specs) inventory.push({ id: s.id, name: s.n, kind: 'spec' });
  for (const p of packed) inventory.push({ id: p.id, name: nameOf(p.id), kind: 'switch' });

  // Spells carried → rune pouch and spellbook.
  const carriedKits = chosen.filled.filter((f) => f.kit && (f.byWorn || packed.some((p) => p.id === f.kit!.weapon.id) || f.kit === wornKit)).map((f) => f.kit!);
  const usedJobs = new Set(chosen.phases.map((p) => p.job));
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
  const wearsAny = (pp: string[]) => [...Object.values(worn), ...packed.map((p) => p.id)].some((id) => id != null && pp.some((p) => new RegExp(p, 'i').test(nameOf(id))));
  const venomRule = profile.rules.find((r) => r.kind === 'antivenom');
  const venomCovered = venomRule?.kind === 'antivenom' && wearsAny(venomRule.coveredBy);
  if (venomCovered) why.push({ pick: 'No anti-venom', why: 'the helm you wear blocks venom' });
  const heldSup = player.supplies ?? null;
  if (!heldSup) warnings.push('Supplies not known: the best form of each is assumed');
  const used = new Map<number, number>();
  let healing = 0;
  const picked = new Map<string, number>();
  const room = () => INV - inventory.length;
  const addLine = (kind: (typeof plan.supplies)[number]['kind'], count: number) => {
    const n = Math.min(count, room());
    if (n <= 0) return 0;
    const got = pickSupplies(kind, n, heldSup, used);
    for (const g of got) {
      inventory.push({ id: g.id, name: g.name, kind: 'supply' });
      healing += g.heals;
    }
    picked.set(kind, (picked.get(kind) ?? 0) + got.length);
    if (got.length) why.push({ pick: `${got.length} × ${SUPPLY_LABEL[kind]}`, why: `${got.map((g) => g.name).filter((x, i, l) => l.indexOf(x) === i).join(', ')} (${preset} plan: ${count})` });
    else if (SUPPLY_FORMS[kind].length) warnings.push(`No ${SUPPLY_LABEL[kind]} in your bank (${SUPPLY_FORMS[kind][0].name})`);
    return got.length;
  };
  // A CA's limits on the plan: lines dropped, room for raid supplies dropped, extra lines added.
  const cons = player.constraints ?? {};
  const FOODS = new Set(['food', 'karambwan', 'brew']);
  const PRAYERS = new Set(['prayer', 'restore']);
  // Bringing your own instead of the raid's: the kept room becomes a third restores, the rest food.
  const kept = cons.ownSupplies ? plan.supplies.filter((l) => l.reserve).reduce((n, l) => n + l.count, 0) : 0;
  const lines: SupplyLine[] = [
    ...plan.supplies.filter((l) => !l.fill),
    ...(kept ? [{ kind: 'restore' as const, count: Math.floor(kept / 3) }] : []),
    ...(cons.moreSupplies ?? []).map((m): SupplyLine => ({ kind: m.kind, count: m.count })),
    ...chosen.extra.map((m): SupplyLine => ({ kind: m.kind, count: m.count })),
    ...plan.supplies.filter((l) => l.fill).map((l) => (kept ? { ...l, count: l.count + kept - Math.floor(kept / 3) } : l)),
  ].filter((l) => (l.reserve ? !cons.ownSupplies : !cons.noSupplies && !(cons.noFood && FOODS.has(l.kind)) && !(cons.noPrayerPots && PRAYERS.has(l.kind))));
  for (const line of lines.filter((l) => !l.fill && !l.reserve)) {
    if (line.kind === 'antivenom' && venomCovered) continue;
    if (room() < line.count) warnings.push(`Only room for ${room()} of ${line.count} ${SUPPLY_LABEL[line.kind]}`);
    addLine(line.kind, line.count);
  }
  for (const line of lines.filter((l) => l.reserve)) {
    const n = Math.min(line.count, room());
    for (let i = 0; i < n; i++) inventory.push({ id: null, name: 'Free slot (raid supplies)', kind: 'reserved' });
    if (n) why.push({ pick: `${n} free slots`, why: `${SUPPLY_LABEL[line.kind]} picked up inside` });
  }
  for (const line of lines.filter((l) => l.fill)) addLine(line.kind, line.count);
  while (inventory.length < INV) inventory.push(null);
  if (inventory.length > INV) unmet.push({ code: 'budget', message: `The inventory needs ${inventory.length} slots` });

  // ── 4. Hard rules ──
  const phaseOf = new Map(chosen.phases.map((p) => [p.key, p]));
  for (const key of unmetJobs) {
    const f = chosen.filled.find((x) => x.job.key === key)!;
    unmet.push({ code: 'style', message: f.job.missing ?? `${f.job.label}: nothing in your bank does it` });
  }
  for (const t of targets) {
    const ph = phaseOf.get(t.p.key)!;
    if (ph.kit == null && t.p.gate) unmet.push({ code: 'style', message: t.p.gate });
    else if (ph.kit == null && !phaseJobs(t, jobsFor(chosen.main)).some((j) => unmetJobs.has(j.key))) unmet.push({ code: 'nothing', message: `${t.p.name}: nothing you carry can damage it${t.p.cast ? ` (needs ${t.p.cast} from a staff)` : ` (${t.p.allowed.join(' or ')})`}` });
    const kit = ph.job ? chosen.filled.find((f) => f.job.key === ph.job)?.kit : null;
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
      if (!ok) unmet.push({ code: 'spell', message: lv.magic < r.magic ? `${r.spell} needs ${r.magic} Magic (you have ${lv.magic})` : `${r.spell}: no staff that can autocast it is carried` });
      if (spellbook !== r.book) unmet.push({ code: 'spellbook', message: `${r.spell} needs the ${r.book} spellbook` });
    } else if (r.kind === 'spellbook' && [...books].some((b) => b !== r.book)) {
      unmet.push({ code: 'spellbook', message: `This fight wants the ${r.book} spellbook` });
    }
  }
  for (const s of bannedStyles) if (carriedKits.some((k) => k.style === s && !k.cast && usedJobs.has(chosen.filled.find((f) => f.kit === k)?.job.key ?? ''))) unmet.push({ code: 'constraint', message: `${s} is ruled out but carried` });

  const jobsOut: LoadoutJob[] = chosen.filled.map((f) => ({
    key: f.job.key,
    label: f.job.label,
    style: f.job.style,
    pick: f.kit ? { id: f.kit.weapon.id, name: f.kit.weapon.n } : f.piece ? { id: f.piece.id, name: nameOf(f.piece.id) } : null,
    ...(f.byWorn && f.job.key !== 'main' ? { byWorn: true } : {}),
    pieces: packed.filter((p) => p.job === f.job.key && p.slot !== 'weapon' && p.slot !== 'ammo' && !f.piece).map((p) => ({ id: p.id, name: nameOf(p.id) })),
    ...(f.stepDown ? { stepDown: f.stepDown } : {}),
    ...(f.blocked ? { blocked: f.blocked } : {}),
  }));

  const killsPerTrip = profile.incomingPerKill && healing > 0 ? Math.max(1, Math.floor(healing / profile.incomingPerKill)) : null;
  return {
    profile: profile.key,
    preset,
    wornStyle: wornKit.style,
    worn,
    switches: packed.map((p) => ({ id: p.id, name: nameOf(p.id), slot: p.slot, kit: p.kit === 'piece' ? (chosen!.filled.find((f) => f.job.key === p.job)?.job.style ?? wornKit.style) : p.kit, job: p.job })),
    specs: chosen.specs.map((s) => ({ id: s.it.id, name: s.it.n, ...(s.stepDown ? { stepDown: s.stepDown } : {}) })),
    inventory: inventory.slice(0, INV),
    runePouch,
    spells: [...new Set(spells.map((s) => s.spell))],
    spellbook,
    quiverAmmo,
    phases: chosen.phases,
    expectedTime: chosen.time,
    killsPerTrip,
    why,
    jobs: jobsOut,
    notes,
    requirementsUnmet: unmet,
    warnings,
  };
}

/** One line per phase: "Zulrah · Tanzanite (blue): ranged 7.2 DPS, 21.0s (30%)". For the demo and tests. */
export const phaseLines = (l: Loadout): string[] => l.phases.map((p) => `${p.name}: ${p.kit ?? 'nothing'} ${fmt(p.dps)} DPS, ${secs(p.seconds)} (${Math.round(p.timeShare * 100)}%)`);
