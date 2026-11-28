// The DPS engine: a loadout against a monster → max hit, accuracy, DPS, time to kill.
//
// PURE. It takes the item and monster records as arguments (from src/data/gear*.json), so the same
// code runs in the browser for the reader's own gear and on the server for Discord summaries.
//
// Written from the OSRS Wiki's published combat formulas (Maximum melee/ranged/magic hit, Accuracy,
// Damage per second) — not from any existing calculator's source. Effects that change the numbers
// and are NOT modelled are named in `notes`, so a guide never presents a guess as a fact.

import {
  POWERED_MAX,
  SLOTS,
  boostedLevel,
  givesDefenceXp,
  prayerKeys,
  prayerMultipliers,
  spellByName,
  stylesFor,
  type AttackStyle,
  type Slot,
  type Spell,
} from './tables';
import { ruleApplies, type EffectRule } from './effects';
import { ABYSSAL, CORPBANE, styleShare, targetMods, type Exemption, type TargetMods } from './targets';

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
  /** Levels needed to wear or wield it (lib/dps/requirements), from the wiki's level up tables. */
  rq?: Partial<Record<'attack' | 'strength' | 'defence' | 'ranged' | 'magic' | 'prayer' | 'hitpoints' | 'slayer' | 'agility', number>>;
  /** Quests it needs completed. */
  rqq?: string[];
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
  /**
   * A Tombs of Amascut raid level (set by the caller, never in the dataset): every 5 levels add 2% to
   * the boss's defence roll (×(1 + level/250)); hitpoints are scaled by the caller.
   */
  raidLevel?: number;
  /**
   * What the fight does to the player's damage beyond the stats (set by the caller, never in the
   * dataset): a per-style cut, demonbane vulnerability, Awakened rules (lib/dps/targets). Merged over
   * the monster's own defaults there.
   */
  mods?: TargetMods;
  /** Defence levels already drained this fight (lib/dps/specs), so drain caps hold across specs. */
  drained?: number;
  hid?: 1;
  ovr?: 1;
}

/** The Tombs of Amascut's bosses and what fights beside them: Tumeken's shadow is ×4 against them. */
export const TOA_MONSTER = /^(akkha|akkha's shadow|ba-ba|kephri|zebak|tumeken's warden|elidinis' warden|obelisk|core|het's seal|baboon|.*scarab.*)$/i;

export interface Stats {
  attack: number;
  strength: number;
  ranged: number;
  magic: number;
  /** Only Dharok's set cares: base Hitpoints level, and HP right now. */
  hitpoints?: number;
  currentHp?: number;
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
  /** Active prayers (one key per prayer). A single string is accepted from older saves. */
  prayer?: string | string[] | null;
  boost?: string | null;
  /** On a slayer task (slayer helm / black mask). */
  onTask?: boolean;
  /** Never a style that trains Defence (controlled, defensive, longrange, defensive autocast): bestStyle skips them. */
  avoidDefenceXp?: boolean;
  /** Mark of Darkness up for demonbane spells. Unset: assumed up (it is cast before the fight). */
  markOfDarkness?: boolean;
  /** Soulreaper axe soul stacks (0–5). Unset: 5, the count a fight settles at. */
  soulStacks?: number;
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
  /** Gear and set effects that changed the numbers, in the order applied. */
  effects: string[];
  /** What the numbers assume about the player: stance, prayers, boost and the boosted levels used. */
  assumed: { stance: string; prayers: string[]; boost: string | null; levels: Partial<Record<'attack' | 'strength' | 'ranged' | 'magic', number>> };
}

export type ItemLookup = (id: number | null | undefined) => GearItem | null;

const TICK = 0.6;
const floor = Math.floor;

/** Demonbane melee weapons and their bonus vs demons (accuracy and damage, in percent). */
const DEMONBANE_MELEE: { match: RegExp; pct: number; label: string }[] = [
  { match: /^arclight/i, pct: 70, label: 'Arclight' },
  { match: /^emberlight/i, pct: 70, label: 'Emberlight' },
  { match: /^darklight/i, pct: 60, label: 'Darklight' },
  { match: /^silverlight/i, pct: 60, label: 'Silverlight' },
  { match: /^burning claws/i, pct: 5, label: 'Burning claws' },
];

/** Charged tomes worn in the shield slot: their element's standard spells hit 10% harder. */
const TOMES: { match: RegExp; element: string; acc: number; label: string }[] = [
  { match: /^tome of fire/, element: 'fire', acc: 1, label: 'Tome of fire' },
  { match: /^tome of water/, element: 'water', acc: 1.2, label: 'Tome of water' },
  { match: /^tome of earth/, element: 'earth', acc: 1, label: 'Tome of earth' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const lc = (s: string | undefined | null) => (s ?? '').toLowerCase();

function worn(loadout: Loadout, items: ItemLookup): GearItem[] {
  return SLOTS.map((slot) => items(loadout.gear[slot])).filter((i): i is GearItem => !!i);
}

function has(gear: GearItem[], re: RegExp): boolean {
  return gear.some((g) => re.test(g.n));
}

function wornSet(gear: GearItem[], pieces: RegExp[]): boolean {
  return pieces.every((re) => has(gear, re));
}

function slotName(loadout: Loadout, items: ItemLookup, slot: Slot): string {
  return lc(items(loadout.gear[slot])?.n);
}

/** a > d: 1 − (d+2)/(2(a+1)); otherwise a/(2(d+1)). */
export function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  return attackRoll / (2 * (defenceRoll + 1));
}

/**
 * Average damage of one ACCURATE hit with max hit `m`: the roll is uniform 0..m, and an accurate
 * roll of 0 deals 1 instead, so the mean is m/2 + 1/(m+1) (the wiki's "Damage per second" pages).
 */
export function avgAccurateHit(m: number): number {
  return m > 0 ? m / 2 + 1 / (m + 1) : 0;
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
export function twistedBow(magic: number, cap = 250): { acc: number; dmg: number } {
  const m = Math.min(magic, cap);
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
  const effects: string[] = [];
  const levels: DpsResult['assumed']['levels'] = {};
  const attrs = new Set((monster.a ?? []).map(lc));
  const undead = attrs.has('undead');
  const dragon = attrs.has('dragon') || attrs.has('draconic');
  const demon = attrs.has('demon');
  const kalphite = attrs.has('kalphite');
  const mods = targetMods(monster);
  // Demonbane vulnerability scales every demonbane bonus (Duke 70%: Arclight's +70% is +49%).
  const dbv = demon ? (mods.demonbane ?? 1) : 0;
  /** A demonbane percentage against this target, whole (Duke: 70 → 49). */
  const bane = (pct: number) => Math.round(pct * dbv * 100) / 100;
  /** What escapes the target's per-style cut (lib/dps/targets): set as the effects apply. */
  const escapes: Exemption[] = [];

  // A ToA raid level raises the defence roll, not the Defence level (drains still hit the base).
  const defScale = (roll: number) => (monster.raidLevel ? floor(roll * (1 + monster.raidLevel / 250)) : roll);

  // Summed equipment bonuses. A blowpipe's darts add their ranged strength.
  const sum = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const g of gear) g.b.forEach((v, i) => (sum[i] += v));
  // The Keris partisan of amascut's listed bonuses hold only inside the Tombs; elsewhere it has 50
  // less stab and 22 less strength.
  const inToa = TOA_MONSTER.test(monster.n);
  if (/^keris partisan of amascut/i.test(weapon?.n ?? '') && !inToa) {
    sum[0] -= 50;
    sum[5] -= 22;
  }
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
  // Dizana's quiver (charged or blessed): +10 ranged attack and +1 ranged strength on top of its
  // listed bonuses, while firing arrows from a bow or bolts from a crossbow.
  if (
    kind === 'ranged' &&
    has(gear, /^(blessed )?dizana's quiver$/i) &&
    !ammoless &&
    ((weapon?.c === 'Bow' && /arrow/i.test(ammo?.n ?? '')) || (weapon?.c === 'Crossbow' && /bolt/i.test(ammo?.n ?? '')))
  ) {
    sum[4] += 10;
    sum[6] += 1;
    effects.push("Dizana's quiver: +10 ranged attack, +1 ranged strength");
  }

  const salve = slotName(loadout, items, 'neck');
  const salveE = undead && /salve amulet ?\(ei\)|salve amulet ?\(e\)/.test(salve);
  const salveI = undead && !salveE && /salve amulet ?\(i\)|^salve amulet$/.test(salve);
  const salveImbued = /\(ei\)|\(i\)/.test(salve);
  const head = slotName(loadout, items, 'head');
  // Awakened Desert Treasure II bosses ignore the Slayer helm's on-task boost.
  const slayerHelm = loadout.onTask && /slayer helmet|black mask/.test(head) && !mods.awakened;
  if (loadout.onTask && /slayer helmet|black mask/.test(head) && mods.awakened) notes.push("The Slayer helm's on-task boost doesn't work on Awakened bosses.");
  const slayerImbued = slayerHelm && /\(i\)/.test(head);

  const speedBase = weapon?.sp ?? 4;
  let speed = speedBase;
  let maxHit = 0;
  let attackRoll = 0;
  let defenceRoll = 0;
  let hits = [1]; // damage fractions per attack (scythe: several)
  let fang: { stab: boolean; toa: boolean } | null = null;

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
    const pr = prayerMultipliers(loadout.prayer, 'melee');
    const att = boostedLevel(loadout.stats.attack, loadout.boost, 'attack');
    const str = boostedLevel(loadout.stats.strength, loadout.boost, 'strength');
    levels.attack = att;
    levels.strength = str;
    const stAtt = style.stance === 'accurate' ? 3 : style.stance === 'controlled' ? 1 : 0;
    const stStr = style.stance === 'aggressive' ? 3 : style.stance === 'controlled' ? 1 : 0;
    // Soulreaper axe: each soul stack adds 6% to the Strength level, added to the prayer's multiplier.
    const stacks = /^soulreaper axe/i.test(weapon?.n ?? '') ? Math.max(0, Math.min(5, Math.floor(loadout.soulStacks ?? 5))) : 0;
    let effAtt = floor(att * pr.acc) + stAtt + 8;
    let effStr = floor(str * (pr.str + 0.06 * stacks)) + stStr + 8;
    if (stacks) effects.push(`Soulreaper axe: ${stacks} soul stack${stacks === 1 ? '' : 's'}, +${stacks * 6}% Strength`);
    if (voidSet(gear, 'melee') !== 'none') {
      effAtt = floor(effAtt * 1.1);
      effStr = floor(effStr * 1.1);
      effects.push('Void melee: ×1.1 effective attack and strength');
    }
    const typeIdx = style.type === 'stab' ? 0 : style.type === 'slash' ? 1 : 2;
    maxHit = floor((effStr * (sum[5] + 64) + 320) / 640);
    attackRoll = effAtt * (sum[typeIdx] + 64);

    // Gear multipliers, each floored in turn. Salve and slayer helm never stack; salve wins.
    const mul = (a: number, d: number, label: string) => {
      attackRoll = floor(attackRoll * a);
      maxHit = floor(maxHit * d);
      effects.push(label);
    };
    if (salveE) mul(1.2, 1.2, 'Salve amulet (e): ×1.2 vs undead');
    else if (salveI) mul(7 / 6, 7 / 6, 'Salve amulet: ×7/6 vs undead');
    else if (slayerHelm) mul(7 / 6, 7 / 6, 'Slayer helm on task: ×7/6');
    const wn = weapon?.n ?? '';
    if (dragon && /dragon hunter lance/i.test(wn)) mul(1.2, 1.2, 'Dragon hunter lance: ×1.2 vs dragons');
    // Demonbane swords and claws, scaled by the target's demonbane vulnerability.
    const db = DEMONBANE_MELEE.find((d) => d.match.test(wn));
    if (demon && db) {
      const pct = bane(db.pct);
      mul((100 + pct) / 100, (100 + pct) / 100, `${db.label}: +${pct}% accuracy and damage vs demons`);
      escapes.push('demonbane');
    }
    if (kalphite && /keris/i.test(wn)) mul(1, 4 / 3, 'Keris: ×4/3 damage vs kalphites');
    if (/^tzhaar-|^toktz-xil-ak|^toktz-mej/i.test(wn) && has(gear, /obsidian helmet/i) && has(gear, /obsidian platebody/i) && has(gear, /obsidian platelegs/i)) mul(1.1, 1.1, 'Obsidian armour: ×1.1');
    if (/^tzhaar-|^toktz-/i.test(wn) && /berserker necklace/i.test(salve)) mul(1, 1.2, 'Berserker necklace: ×1.2 damage');
    if (style.type === 'crush') {
      const pieces = [/inquisitor's great helm/i, /inquisitor's hauberk/i, /inquisitor's plateskirt/i].filter((re) => has(gear, re)).length;
      const bonus = pieces === 3 ? 0.025 : pieces * 0.005;
      if (bonus) mul(1 + bonus, 1 + bonus, `Inquisitor's (${pieces} pieces): ×${1 + bonus} crush`);
    }

    // Dharok's: the full set hits harder the more Hitpoints you're missing.
    if (wornSet(gear, [/^dharok's helm/i, /^dharok's platebody/i, /^dharok's platelegs/i, /^dharok's greataxe/i])) {
      const hp = loadout.stats.hitpoints ?? 99;
      const cur = Math.min(hp, Math.max(1, loadout.stats.currentHp ?? hp));
      mul(1, 1 + ((hp - cur) / 100) * (hp / 100), "Dharok's set: damage scales with missing Hitpoints");
      if (cur === hp) notes.push("Dharok's set: at full Hitpoints it adds nothing — set your current HP.");
    }
    applyRules();
    const defType = style.type === 'stab' ? 0 : style.type === 'slash' ? 1 : 2;
    defenceRoll = defScale((monster.lv[0] + 9) * (monster.d[defType] + 64));
    if (CORPBANE.test(wn) && style.type === 'stab') escapes.push('corpbane');
    if (ABYSSAL.test(wn)) escapes.push('abyssal');

    if (/scythe of vitur/i.test(wn)) {
      const size = monster.sz ?? 1;
      hits = size >= 3 ? [1, 0.5, 0.25] : size === 2 ? [1, 0.5] : [1];
      if (hits.length > 1) effects.push(`Scythe of vitur: ${hits.length} hits on a size-${size} target`);
    }
    if (/^osmumten's fang/i.test(wn)) {
      fang = { stab: style.type === 'stab', toa: inToa };
      effects.push(`Osmumten's fang: ${fang.stab ? (inToa ? 'accuracy rolled twice (Tombs of Amascut), ' : 'a second accuracy roll, ') : ''}hits 15–85% of the max`);
    }
  } else if (kind === 'ranged') {
    const pr = prayerMultipliers(loadout.prayer, 'ranged');
    const rng = boostedLevel(loadout.stats.ranged, loadout.boost, 'ranged');
    levels.ranged = rng;
    const st = style.stance === 'accurate' ? 3 : 0;
    let effAtt = floor(rng * pr.acc) + st + 8;
    let effStr = floor(rng * pr.str) + st + 8;
    const v = voidSet(gear, 'ranged');
    if (v !== 'none') {
      effAtt = floor(effAtt * 1.1);
      effStr = floor(effStr * (v === 'elite' ? 1.125 : 1.1));
      effects.push(`${v === 'elite' ? 'Elite void' : 'Void'} ranged: ×1.1 effective attack, ×${v === 'elite' ? 1.125 : 1.1} effective strength`);
    }
    maxHit = floor(0.5 + (effStr * (sum[6] + 64)) / 640);
    attackRoll = effAtt * (sum[4] + 64);
    if (style.stance === 'rapid') speed -= 1;

    const mul = (a: number, d: number, label: string) => {
      attackRoll = floor(attackRoll * a);
      maxHit = floor(maxHit * d);
      effects.push(label);
    };
    const wn = weapon?.n ?? '';
    // Scorching bow: +30% accuracy and damage vs demons; the damage adds to the Slayer helm's 15%.
    const scorch = demon && /^scorching bow/i.test(wn) ? bane(30) : 0;
    if (salveE && salveImbued) mul(1.2, 1.2, 'Salve amulet (ei): ×1.2 vs undead');
    else if (salveI && salveImbued) mul(7 / 6, 7 / 6, 'Salve amulet (i): ×7/6 vs undead');
    else if (slayerImbued && scorch) mul(1.15, (115 + scorch) / 100, `Slayer helm (i) on task: ×1.15 accuracy; its 15% damage and the bow's ${scorch}% added`);
    else if (slayerImbued) mul(1.15, 1.15, 'Slayer helm (i) on task: ×1.15');
    if (scorch) {
      const added = slayerImbued && !salveE && !salveI;
      mul((100 + scorch) / 100, added ? 1 : (100 + scorch) / 100, `Scorching bow: +${scorch}% accuracy and damage vs demons`);
      escapes.push('demonbane');
    }
    if (dragon && /dragon hunter crossbow/i.test(wn)) mul(1.3, 1.25, 'Dragon hunter crossbow: ×1.3 accuracy, ×1.25 damage vs dragons');
    if (/twisted bow/i.test(wn)) {
      const magic = Math.max(monster.lv[1], monster.mab ?? 0);
      const t = twistedBow(magic, mods.tbowCap ?? 250);
      // Whole percentages, as the game applies them (avoids 1.14 × n landing a hair under an integer).
      const accPct = Math.round(t.acc * 100);
      const dmgPct = Math.round(t.dmg * 100);
      attackRoll = floor((attackRoll * accPct) / 100);
      maxHit = floor((maxHit * dmgPct) / 100);
      effects.push(`Twisted bow (target magic ${Math.min(magic, mods.tbowCap ?? 250)}${(mods.tbowCap ?? 250) > 250 ? ', raised cap in the Chambers of Xeric' : ''}): ×${t.acc} accuracy, ×${t.dmg} damage`);
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
      if (acc) mul(1 + acc, 1 + dmg, `Crystal armour (${on.length} pieces): +${+(acc * 100).toFixed(1)}% accuracy, +${+(dmg * 100).toFixed(1)}% damage`);
    }

    applyRules();
    // Ammo-type defences: thrown/darts hit light, arrows standard, bolts heavy.
    const defIdx = weapon?.c === 'Crossbow' ? 6 : weapon?.c === 'Bow' ? 5 : 4;
    defenceRoll = defScale((monster.lv[0] + 9) * (monster.d[defIdx] + 64));

    // Enchanted bolt specials, as an expected value over the fight.
    const bolt = lc(ammo?.n);
    if (weapon?.c === 'Crossbow' && /\(e\)/.test(bolt)) {
      const p = hitChance(attackRoll, defenceRoll);
      const normal = p * avgAccurateHit(maxHit);
      if (/ruby/.test(bolt)) {
        // 6% to hit for 20% of the target's CURRENT hitpoints (cap 100): averaged at half health.
        const proc = Math.min(100, floor(monster.hp * 0.5 * 0.2));
        const perHit = 0.06 * proc + 0.94 * normal;
        notes.push('Ruby bolts (e): averaged over the fight (target at half health on average).');
        return finish(perHit);
      }
      if (/diamond/.test(bolt)) {
        // 10% to hit for up to 115% of max, ignoring defence.
        const perHit = 0.1 * avgAccurateHit(floor(maxHit * 1.15)) + 0.9 * normal;
        return finish(perHit);
      }
    }
  } else {
    // Magic: a powered staff's own spell, or the autocast spell.
    const pr = prayerMultipliers(loadout.prayer, 'magic');
    const mag = boostedLevel(loadout.stats.magic, loadout.boost, 'magic');
    levels.magic = mag;
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
      // The Twinflame staff casts every 6 ticks.
      if (/^twinflame staff/i.test(wn)) speed = 6;
    }
    const st = style.stance === 'accurate' ? 2 : style.stance === 'longrange' ? 1 : 0;
    const effMag = floor(mag * pr.acc) + st + 9;

    // Tumeken's shadow triples the magic attack and damage bonuses of the gear (×4 inside the Tombs
    // of Amascut); magic damage stays capped at 100%.
    const shadow = /^tumeken's shadow/i.test(wn);
    const shadowX = shadow ? (TOA_MONSTER.test(monster.n) ? 4 : 3) : 1;
    const magicAtt = sum[3] * shadowX;
    let dmgPct = Math.min(sum[7] * shadowX, 100);
    const v = voidSet(gear, 'magic');
    if (v === 'elite') dmgPct += 2.5;
    if (salveE && salveImbued) dmgPct += 20;
    else if (salveI && salveImbued) dmgPct += 15;

    if (shadow) effects.push(`Tumeken's shadow: ×${shadowX} magic attack and damage bonuses${shadowX === 4 ? ' (Tombs of Amascut)' : ''}`);
    attackRoll = effMag * (magicAtt + 64);
    if (v !== 'none') {
      attackRoll = floor(attackRoll * 1.45);
      effects.push(`${v === 'elite' ? 'Elite void (+2.5% damage)' : 'Void'} magic: ×1.45 accuracy`);
    }
    if (salveE && salveImbued) {
      attackRoll = floor(attackRoll * 1.2);
      effects.push('Salve amulet (ei): ×1.2 accuracy, +20% damage vs undead');
    } else if (salveI && salveImbued) {
      attackRoll = floor(attackRoll * 1.15);
      effects.push('Salve amulet (i): ×1.15 accuracy, +15% damage vs undead');
    } else if (slayerImbued) {
      attackRoll = floor(attackRoll * 1.15);
      effects.push('Slayer helm (i) on task: ×1.15');
    }

    maxHit = floor(base * (1 + dmgPct / 100));
    if (slayerImbued && !salveE && !salveI) maxHit = floor(maxHit * 1.15);
    const amul = (a: number, label: string) => {
      attackRoll = floor(attackRoll * a);
      effects.push(label);
    };
    const dmul = (d: number) => (maxHit = floor(maxHit * d));
    // Dragon hunter wand: +75% accuracy, +40% damage vs draconic targets.
    if (dragon && /^dragon hunter wand/i.test(wn)) {
      amul(1.75, 'Dragon hunter wand: ×1.75 accuracy, ×1.4 damage vs dragons');
      dmul(1.4);
    }
    const standard = spell?.book === 'standard';
    const elemental = !!spell?.element && standard;
    // Twinflame staff: +10% accuracy and damage on standard spells.
    const twinflame = /^twinflame staff/i.test(wn) && standard;
    if (twinflame) {
      amul(1.1, 'Twinflame staff: ×1.1 accuracy and damage on standard spells');
      dmul(1.1);
    }
    // Charged tomes: +10% damage on their element's standard spells (water: +20% accuracy too).
    const shieldName = slotName(loadout, items, 'shield');
    const tome = elemental ? TOMES.find((t) => t.match.test(shieldName) && t.element === spell!.element) : undefined;
    if (tome) {
      if (tome.acc > 1) attackRoll = floor(attackRoll * tome.acc);
      dmul(1.1);
      effects.push(`${tome.label}: ${tome.acc > 1 ? `×${tome.acc} accuracy, ` : ''}×1.1 damage on ${tome.element} spells`);
    }
    applyRules();
    if (elemental && monster.ew && spell!.element === monster.ew && monster.ewp) {
      // Elemental weakness: +1% accuracy and +1% of the base damage per point.
      attackRoll = floor((attackRoll * (100 + monster.ewp)) / 100);
      maxHit += floor((base * monster.ewp) / 100);
      effects.push(`Weak to ${spell!.element}: +${monster.ewp}% accuracy, +${monster.ewp}% of the spell's base damage`);
    }
    if (/demonbane/i.test(spell?.name ?? '') && !demon) {
      notes.push('Demonbane spells only work on demons.');
      maxHit = 0;
    } else if (/demonbane/i.test(spell?.name ?? '')) {
      // Demonbane spells: +20% accuracy; Mark of Darkness doubles it and adds 25% damage; a purging
      // staff doubles both again. All scaled by the target's demonbane vulnerability.
      const mark = loadout.markOfDarkness ?? true;
      const purging = /^purging staff/i.test(wn);
      const acc = bane(purging ? (mark ? 80 : 40) : mark ? 40 : 20);
      const dmg = mark ? bane(purging ? 50 : 25) : 0;
      attackRoll = floor((attackRoll * (100 + acc)) / 100);
      if (dmg) maxHit = floor((maxHit * (100 + dmg)) / 100);
      effects.push(`${spell!.name}${purging ? ' from a purging staff' : ''}${mark ? ' with Mark of Darkness' : ''}: +${acc}% accuracy${dmg ? `, +${dmg}% damage` : ''}`);
      if (mark && loadout.markOfDarkness == null) notes.push('Assumes Mark of Darkness is up.');
      escapes.push('demonbane');
    }
    if (spell?.element === 'fire' && standard) escapes.push('fire');
    // Twinflame staff: bolt, blast and wave spells fire twice, the second for 40% of the first.
    if (twinflame && elemental && /bolt|blast|wave/i.test(spell!.name)) {
      hits = [1, 0.4];
      effects.push('Twinflame staff: a second spell for 40% of the first');
    }
    if (/crumble undead/i.test(spell?.name ?? '') && !undead) {
      notes.push('Crumble Undead only works on undead.');
      maxHit = 0;
    }
    defenceRoll = defScale((monster.lv[1] + 9) * (monster.d[3] + 64));
  }

  if (monster.fa) notes.push(`Flat armour (${monster.fa}) is not modelled.`);
  if (fang) {
    // Osmumten's fang: a hit lands for 15–85% of the max (no zeros), the mean half the max. With a
    // stab style it rolls accuracy twice: inside the Tombs both rolls are fresh (1 − (1 − p)²);
    // elsewhere only the player's roll is re-rolled against the one defence roll (the wiki's formula).
    const A = attackRoll;
    const D = defenceRoll;
    const p0 = hitChance(A, D);
    const p = !fang.stab ? p0 : fang.toa ? 1 - (1 - p0) ** 2 : A > D ? 1 - ((D + 2) * (2 * D + 3)) / (6 * (A + 1) ** 2) : (A * (4 * A + 5)) / (6 * (A + 1) * (D + 1));
    const lo = floor(maxHit * 0.15);
    return finish(p * ((lo + (maxHit - lo)) / 2), p);
  }
  const p = hitChance(attackRoll, defenceRoll);
  return finish(hits.reduce((acc, frac) => acc + p * avgAccurateHit(floor(maxHit * frac)), 0));

  function finish(avgPerAttack: number, accuracy?: number): DpsResult {
    const acc = accuracy ?? hitChance(attackRoll, defenceRoll);
    const s = Math.max(1, speed);
    // The target's per-style cut (Tekton: no ranged damage, a fifth of magic), unless this attack escapes it.
    const share = styleShare(mods, kind, style.type, escapes);
    if (share === 0) notes.push(`${monster.n} is immune to ${style.type === 'ranged' || style.type === 'magic' ? style.type : 'this style'}.`);
    else if (share !== 1) effects.push(`${monster.n} takes ${+(share * 100).toFixed(1)}% damage from ${kind}`);
    const dps = (avgPerAttack * share) / (s * TICK);
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
      effects,
      assumed: { stance: style.name, prayers: prayerKeys(loadout.prayer), boost: loadout.boost ?? null, levels },
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
  styles.forEach((s, index) => {
    if (loadout.avoidDefenceXp && givesDefenceXp(s)) return;
    const r = calculate({ ...loadout, style: index }, monster, items, rules);
    if (r && (!best || r.dps > best.result.dps)) best = { index, result: r };
  });
  return best;
}
