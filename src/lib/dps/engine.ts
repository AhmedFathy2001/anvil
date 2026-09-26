// The DPS engine: a loadout against a monster → max hit, accuracy, DPS, time to kill.
//
// PURE. It takes the item and monster records as arguments (from src/data/gear*.json), so the same
// code runs in the browser for the reader's own gear and on the server for Discord summaries.
//
// Written from the OSRS Wiki's published combat formulas (Maximum melee/ranged/magic hit, Accuracy,
// Damage per second) — not from any existing calculator's source. Effects that change the numbers
// and are NOT modelled are named in `notes`, so a guide never presents a guess as a fact.

import {
  BOOSTS,
  POWERED_MAX,
  PRAYERS,
  SLOTS,
  spellByName,
  stylesFor,
  type AttackStyle,
  type Slot,
  type Spell,
} from './tables';
import { ruleApplies, type EffectRule } from './effects';

// ── Data shapes (as emitted by scripts/build-gear-dataset.mjs) ───────────────────────────────

export interface GearItem {
  id: number;
  n: string;
  s: string;
  h2?: 1;
  /** [stab, slash, crush, magic, ranged, strength, ranged strength, magic damage %, prayer] */
  b: number[];
  /** Sum of the defence bonuses — not used for DPS; lets a picker rank armour. */
  df?: number;
  sp?: number;
  c?: string;
  img?: string;
  /** Hidden by platform staff: kept for guides that already use it, left out of pickers. */
  hid?: 1;
  /** Added or changed by platform staff (lib/dps/store). */
  ovr?: 1;
}

export interface Monster {
  n: string;
  v?: string;
  hp: number;
  cb?: number;
  /** [defence level, magic level] */
  lv: number[];
  mab?: number;
  /** [stab, slash, crush, magic, light ranged, standard ranged, heavy ranged] */
  d: number[];
  a?: string[];
  sz?: number;
  fa?: number;
  ew?: string;
  ewp?: number;
  hid?: 1;
  ovr?: 1;
}

export interface Stats {
  attack: number;
  strength: number;
  ranged: number;
  magic: number;
}

export interface Loadout {
  /** Item id per slot. */
  gear: Partial<Record<Slot, number>>;
  /** Index into the weapon's attack styles. */
  style: number;
  /** For autocasting / spell-casting weapons. */
  spell?: string | null;
  /** Darts for a blowpipe. */
  dart?: number | null;
  stats: Stats;
  prayer?: string | null;
  boost?: string | null;
  /** On a slayer task (slayer helm / black mask). */
  onTask?: boolean;
}

export interface DpsResult {
  style: AttackStyle;
  kind: 'melee' | 'ranged' | 'magic';
  maxHit: number;
  attackRoll: number;
  defenceRoll: number;
  accuracy: number;
  /** Ticks between attacks. */
  speed: number;
  dps: number;
  /** Seconds to kill from full HP, ignoring downtime. */
  ttk: number;
  notes: string[];
}

export type ItemLookup = (id: number | null | undefined) => GearItem | null;

const TICK = 0.6;
const floor = Math.floor;

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const lc = (s: string | undefined | null) => (s ?? '').toLowerCase();

function worn(loadout: Loadout, items: ItemLookup): GearItem[] {
  return SLOTS.map((slot) => items(loadout.gear[slot])).filter((i): i is GearItem => !!i);
}

function has(gear: GearItem[], re: RegExp): boolean {
  return gear.some((g) => re.test(g.n));
}

function slotName(loadout: Loadout, items: ItemLookup, slot: Slot): string {
  return lc(items(loadout.gear[slot])?.n);
}

/** a > d: 1 − (d+2)/(2(a+1)); otherwise a/(2(d+1)). */
export function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  return attackRoll / (2 * (defenceRoll + 1));
}

function applyBoost(level: number, boostKey: string | null | undefined, kind: 'melee' | 'ranged' | 'magic'): number {
  const b = BOOSTS.find((x) => x.key === boostKey && x.style === kind);
  return b ? b.boost(level) : level;
}

function prayerFor(key: string | null | undefined, kind: 'melee' | 'ranged' | 'magic') {
  return PRAYERS.find((p) => p.key === key && p.style === kind) ?? { acc: 1, str: 1 };
}

function voidSet(gear: GearItem[], kind: 'melee' | 'ranged' | 'magic'): 'none' | 'void' | 'elite' {
  const helm = kind === 'melee' ? /void melee helm/i : kind === 'ranged' ? /void ranger helm/i : /void mage helm/i;
  if (!has(gear, helm) || !has(gear, /void knight gloves/i)) return 'none';
  const eliteTop = has(gear, /elite void top/i);
  const eliteRobe = has(gear, /elite void robe/i);
  const top = eliteTop || has(gear, /void knight top/i);
  const robe = eliteRobe || has(gear, /void knight robe/i);
  if (!top || !robe) return 'none';
  return eliteTop && eliteRobe ? 'elite' : 'void';
}

/** Twisted bow scaling off the target's magic (the higher of level and magic attack bonus). */
export function twistedBow(magic: number): { acc: number; dmg: number } {
  const m = Math.min(magic, 250);
  const t = floor((3 * m) / 10);
  const acc = Math.min(140, 140 + floor((3 * m - 10) / 100) - floor(((t - 100) ** 2) / 100));
  const dmg = Math.min(250, 250 + floor((3 * m - 14) / 100) - floor(((t - 140) ** 2) / 100));
  return { acc: Math.max(0, acc) / 100, dmg: Math.max(0, dmg) / 100 };
}

// ── The calculation ──────────────────────────────────────────────────────────────────────────

export function calculate(loadout: Loadout, monster: Monster, items: ItemLookup, rules: EffectRule[] = []): DpsResult | null {
  const gear = worn(loadout, items);
  const weapon = items(loadout.gear.weapon);
  const styles = stylesFor(weapon?.c);
  const style = styles[Math.min(Math.max(loadout.style, 0), styles.length - 1)];
  const kind: DpsResult['kind'] = style.type === 'magic' ? 'magic' : style.type === 'ranged' ? 'ranged' : 'melee';
  const notes: string[] = [];
  const attrs = new Set((monster.a ?? []).map(lc));
  const undead = attrs.has('undead');
  const dragon = attrs.has('dragon') || attrs.has('draconic');
  const demon = attrs.has('demon');
  const kalphite = attrs.has('kalphite');

  // Summed equipment bonuses. A blowpipe's darts add their ranged strength.
  const sum = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const g of gear) g.b.forEach((v, i) => (sum[i] += v));
  const isBlowpipe = /blowpipe/i.test(weapon?.n ?? '');
  if (isBlowpipe) {
    const dart = items(loadout.dart);
    if (dart) sum[6] += dart.b[6];
    else notes.push('No darts picked for the blowpipe.');
  }
  // Ammo-less bows ignore whatever is in the ammo slot; so do thrown weapons (the weapon is the ammo).
  const ammo = items(loadout.gear.ammo);
  const ammoless = /crystal bow|bow of faerdhinen|craw's bow|webweaver|thrown|blowpipe/i.test(weapon?.n ?? '') || weapon?.c === 'Thrown' || weapon?.c === 'Chinchompas';
  if (ammo && ammoless && kind === 'ranged') sum[6] -= ammo.b[6];

  const salve = slotName(loadout, items, 'neck');
  const salveE = undead && /salve amulet ?\(ei\)|salve amulet ?\(e\)/.test(salve);
  const salveI = undead && !salveE && /salve amulet ?\(i\)|^salve amulet$/.test(salve);
  const salveImbued = /\(ei\)|\(i\)/.test(salve);
  const head = slotName(loadout, items, 'head');
  const slayerHelm = loadout.onTask && /slayer helmet|black mask/.test(head);
  const slayerImbued = slayerHelm && /\(i\)/.test(head);

  const speedBase = weapon?.sp ?? 4;
  let speed = speedBase;
  let maxHit = 0;
  let attackRoll = 0;
  let defenceRoll = 0;
  let hits = [1]; // damage fractions per attack (scythe: several)

  // Custom effect rules (lib/dps/effects), applied after each style's built-in effects.
  const applyRules = () => {
    const ctx = {
      weapon: weapon?.n ?? '',
      worn: gear.map((g) => g.n),
      kind,
      attackType: style.type,
      monsterName: monster.n,
      monsterAttributes: [...attrs],
      onTask: loadout.onTask === true,
    };
    for (const rule of rules) {
      if (!ruleApplies(rule, ctx)) continue;
      attackRoll = floor(attackRoll * rule.accuracy);
      maxHit = floor(maxHit * rule.damage);
      notes.push(`${rule.name} (added by Anvil staff).`);
    }
  };

  if (kind === 'melee') {
    const pr = prayerFor(loadout.prayer, 'melee');
    const att = applyBoost(loadout.stats.attack, loadout.boost, 'melee');
    const str = applyBoost(loadout.stats.strength, loadout.boost, 'melee');
    const stAtt = style.stance === 'accurate' ? 3 : style.stance === 'controlled' ? 1 : 0;
    const stStr = style.stance === 'aggressive' ? 3 : style.stance === 'controlled' ? 1 : 0;
    let effAtt = floor(att * pr.acc) + stAtt + 8;
    let effStr = floor(str * pr.str) + stStr + 8;
    if (voidSet(gear, 'melee') !== 'none') {
      effAtt = floor(effAtt * 1.1);
      effStr = floor(effStr * 1.1);
    }
    const typeIdx = style.type === 'stab' ? 0 : style.type === 'slash' ? 1 : 2;
    maxHit = floor((effStr * (sum[5] + 64) + 320) / 640);
    attackRoll = effAtt * (sum[typeIdx] + 64);

    // Gear multipliers, each floored in turn. Salve and slayer helm never stack; salve wins.
    const mul = (a: number, d: number) => {
      attackRoll = floor(attackRoll * a);
      maxHit = floor(maxHit * d);
    };
    if (salveE) mul(1.2, 1.2);
    else if (salveI) mul(7 / 6, 7 / 6);
    else if (slayerHelm) mul(7 / 6, 7 / 6);
    const wn = weapon?.n ?? '';
    if (dragon && /dragon hunter lance/i.test(wn)) mul(1.2, 1.2);
    if (demon && /arclight/i.test(wn)) mul(1.7, 1.7);
    if (kalphite && /keris/i.test(wn)) mul(1, 4 / 3);
    if (/^tzhaar-|^toktz-xil-ak|^toktz-mej/i.test(wn) && has(gear, /obsidian helmet/i) && has(gear, /obsidian platebody/i) && has(gear, /obsidian platelegs/i)) mul(1.1, 1.1);
    if (/^tzhaar-|^toktz-/i.test(wn) && /berserker necklace/i.test(salve)) mul(1, 1.2);
    if (style.type === 'crush') {
      const pieces = [/inquisitor's great helm/i, /inquisitor's hauberk/i, /inquisitor's plateskirt/i].filter((re) => has(gear, re)).length;
      const bonus = pieces === 3 ? 0.025 : pieces * 0.005;
      if (bonus) mul(1 + bonus, 1 + bonus);
    }

    applyRules();
    const defType = style.type === 'stab' ? 0 : style.type === 'slash' ? 1 : 2;
    defenceRoll = (monster.lv[0] + 9) * (monster.d[defType] + 64);

    if (/scythe of vitur/i.test(wn)) {
      const size = monster.sz ?? 1;
      hits = size >= 3 ? [1, 0.5, 0.25] : size === 2 ? [1, 0.5] : [1];
    }
    if (/osmumten's fang/i.test(wn) && style.type === 'stab') notes.push("Osmumten's fang: its double accuracy roll is approximated.");
  } else if (kind === 'ranged') {
    const pr = prayerFor(loadout.prayer, 'ranged');
    const rng = applyBoost(loadout.stats.ranged, loadout.boost, 'ranged');
    const st = style.stance === 'accurate' ? 3 : 0;
    let effAtt = floor(rng * pr.acc) + st + 8;
    let effStr = floor(rng * pr.str) + st + 8;
    const v = voidSet(gear, 'ranged');
    if (v !== 'none') {
      effAtt = floor(effAtt * 1.1);
      effStr = floor(effStr * (v === 'elite' ? 1.125 : 1.1));
    }
    maxHit = floor(0.5 + (effStr * (sum[6] + 64)) / 640);
    attackRoll = effAtt * (sum[4] + 64);
    if (style.stance === 'rapid') speed -= 1;

    const mul = (a: number, d: number) => {
      attackRoll = floor(attackRoll * a);
      maxHit = floor(maxHit * d);
    };
    const wn = weapon?.n ?? '';
    if (salveE && salveImbued) mul(1.2, 1.2);
    else if (salveI && salveImbued) mul(7 / 6, 7 / 6);
    else if (slayerImbued) mul(1.15, 1.15);
    if (dragon && /dragon hunter crossbow/i.test(wn)) mul(1.3, 1.25);
    if (/twisted bow/i.test(wn)) {
      const t = twistedBow(Math.max(monster.lv[1], monster.mab ?? 0));
      mul(t.acc, t.dmg);
    }
    if (/crystal bow|bow of faerdhinen/i.test(wn)) {
      // [piece, accuracy, damage]
      const pieces: [RegExp, number, number][] = [
        [/crystal helm/i, 0.05, 0.025],
        [/crystal body/i, 0.15, 0.075],
        [/crystal legs/i, 0.1, 0.05],
      ];
      const on = pieces.filter(([re]) => has(gear, re));
      const acc = on.reduce((a, [, x]) => a + x, 0);
      const dmg = on.reduce((a, [, , y]) => a + y, 0);
      if (acc) mul(1 + acc, 1 + dmg);
    }

    applyRules();
    // Ammo-type defences: thrown/darts hit light, arrows standard, bolts heavy.
    const defIdx = weapon?.c === 'Crossbow' ? 6 : weapon?.c === 'Bow' ? 5 : 4;
    defenceRoll = (monster.lv[0] + 9) * (monster.d[defIdx] + 64);

    // Enchanted bolt specials, as an expected value over the fight.
    const bolt = lc(ammo?.n);
    if (weapon?.c === 'Crossbow' && /\(e\)/.test(bolt)) {
      const p = hitChance(attackRoll, defenceRoll);
      const normal = p * (maxHit / 2);
      if (/ruby/.test(bolt)) {
        // 6% to hit for 20% of the target's CURRENT hitpoints (cap 100): averaged at half health.
        const proc = Math.min(100, floor(monster.hp * 0.5 * 0.2));
        const perHit = 0.06 * proc + 0.94 * normal;
        notes.push('Ruby bolts (e): averaged over the fight (target at half health on average).');
        return finish(perHit);
      }
      if (/diamond/.test(bolt)) {
        // 10% to hit for up to 115% of max, ignoring defence.
        const perHit = 0.1 * (floor(maxHit * 1.15) / 2) + 0.9 * normal;
        return finish(perHit);
      }
    }
  } else {
    // Magic: a powered staff's own spell, or the autocast spell.
    const pr = prayerFor(loadout.prayer, 'magic');
    const mag = applyBoost(loadout.stats.magic, loadout.boost, 'magic');
    const wn = weapon?.n ?? '';
    const powered = POWERED_MAX.find((p) => p.match.test(wn));
    let spell: Spell | null = null;
    let base = 0;
    if (style.stance !== 'autocast' && powered) {
      base = powered.max(mag);
    } else {
      spell = spellByName(loadout.spell);
      if (!spell) {
        notes.push('Pick a spell to autocast.');
        return null;
      }
      base = typeof spell.max === 'function' ? spell.max(mag) : spell.max;
      speed = 5;
      if (/harmonised nightmare staff/i.test(wn) && spell.book === 'standard') speed = 4;
    }
    const st = style.stance === 'accurate' ? 2 : style.stance === 'longrange' ? 1 : 0;
    const effMag = floor(mag * pr.acc) + st + 9;

    // Tumeken's shadow triples the magic attack and damage bonuses of the rest of the gear.
    const shadow = /^tumeken's shadow/i.test(wn);
    const magicAtt = shadow ? sum[3] * 3 : sum[3];
    let dmgPct = Math.min(shadow ? sum[7] * 3 : sum[7], 100);
    const v = voidSet(gear, 'magic');
    if (v === 'elite') dmgPct += 2.5;
    if (salveE && salveImbued) dmgPct += 20;
    else if (salveI && salveImbued) dmgPct += 15;

    attackRoll = effMag * (magicAtt + 64);
    if (v !== 'none') attackRoll = floor(attackRoll * 1.45);
    if (salveE && salveImbued) attackRoll = floor(attackRoll * 1.2);
    else if (salveI && salveImbued) attackRoll = floor(attackRoll * 1.15);
    else if (slayerImbued) attackRoll = floor(attackRoll * 1.15);

    maxHit = floor(base * (1 + dmgPct / 100));
    if (slayerImbued && !salveE && !salveI) maxHit = floor(maxHit * 1.15);
    applyRules();
    if (spell?.element && monster.ew && spell.element === monster.ew && monster.ewp) {
      maxHit += floor((base * monster.ewp) / 100);
      notes.push(`Weak to ${spell.element}: +${monster.ewp}% of the spell's base damage (accuracy effect not modelled).`);
    }
    if (/crumble undead/i.test(spell?.name ?? '') && !undead) {
      notes.push('Crumble Undead only works on undead.');
      maxHit = 0;
    }
    defenceRoll = (monster.lv[1] + 9) * (monster.d[3] + 64);
  }

  if (monster.fa) notes.push(`Flat armour (${monster.fa}) is not modelled.`);
  const p = hitChance(attackRoll, defenceRoll);
  return finish(hits.reduce((acc, frac) => acc + p * (floor(maxHit * frac) / 2), 0));

  function finish(avgPerAttack: number): DpsResult {
    const acc = hitChance(attackRoll, defenceRoll);
    const s = Math.max(1, speed);
    const dps = avgPerAttack / (s * TICK);
    return {
      style,
      kind,
      maxHit,
      attackRoll,
      defenceRoll,
      accuracy: acc,
      speed: s,
      dps,
      ttk: dps > 0 ? monster.hp / dps : Infinity,
      notes,
    };
  }
}

/** Every style the loadout's weapon offers, and the best of them. */
export function bestStyle(
  loadout: Loadout,
  monster: Monster,
  items: ItemLookup,
  rules: EffectRule[] = [],
): { index: number; result: DpsResult } | null {
  const styles = stylesFor(items(loadout.gear.weapon)?.c);
  let best: { index: number; result: DpsResult } | null = null;
  styles.forEach((_, index) => {
    const r = calculate({ ...loadout, style: index }, monster, items, rules);
    if (r && (!best || r.dps > best.result.dps)) best = { index, result: r };
  });
  return best;
}
