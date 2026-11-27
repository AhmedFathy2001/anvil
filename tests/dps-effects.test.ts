// The DPS engine's target effects (per-style cuts, demonbane, Awakened rules), the newer weapon
// effects, the defence-drain specs and "Avoid Defence XP". Real items and monsters from the bundled
// gear data; facts from the OSRS Wiki's pages. No database.
//
// Run: npx tsx --test tests/dps-effects.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bestStyle, calculate, twistedBow, type GearItem, type Loadout, type Monster } from '../src/lib/dps/engine.ts';
import { applyDrain, afterSpecs, drainRoom, rankDrainSpecs, specDrain, voidwakerSpec } from '../src/lib/dps/specs.ts';
import { givesDefenceXp, stylesFor } from '../src/lib/dps/tables.ts';
import { styleShare, targetMods } from '../src/lib/dps/targets.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const ITEMS = (itemsJson as { items: GearItem[] }).items;
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const lookup = (id: number | null | undefined) => (id == null ? null : (byId.get(id) ?? null));
const id = (name: string) => {
  const it = ITEMS.find((i) => i.n.toLowerCase() === name.toLowerCase());
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};
const MONSTERS = (monstersJson as { monsters: Monster[] }).monsters;
const mon = (n: string, v?: string) => {
  const m = MONSTERS.find((x) => x.n === n && (v == null || x.v === v));
  assert.ok(m, `dataset has ${n} ${v ?? ''}`);
  return m!;
};
/** The same stats under another name: no monster defaults apply. */
const plain = (m: Monster, over: Partial<Monster> = {}): Monster => ({ ...m, n: 'Practice dummy', v: undefined, ...over });

const MAXED = { attack: 99, strength: 99, ranged: 99, magic: 99 };
const melee = (weapon: string, extra: Record<string, string> = {}): Loadout => ({
  gear: { weapon: id(weapon), ...Object.fromEntries(Object.entries(extra).map(([s, n]) => [s, id(n)])) },
  style: 0,
  stats: MAXED,
  prayer: 'piety',
  boost: 'super_combat',
});
const best = (l: Loadout, m: Monster) => bestStyle(l, m, lookup)!.result;

// ── 1. Per-style damage shares ──────────────────────────────────────────────────────────────

test('Tekton: immune to ranged, a fifth of magic damage, melee in full', () => {
  const tek = mon('Tekton', 'Normal');
  const bow: Loadout = { gear: { weapon: id('Twisted bow'), ammo: id('Dragon arrow') }, style: 1, stats: MAXED, prayer: 'rigour' };
  assert.equal(calculate(bow, tek, lookup)!.dps, 0);
  assert.ok(calculate(bow, plain(tek), lookup)!.dps > 0);
  const mage: Loadout = { gear: { weapon: id('Sanguinesti staff') }, style: 0, stats: MAXED, prayer: 'augury' };
  const cut = calculate(mage, tek, lookup)!;
  assert.ok(Math.abs(cut.dps / calculate(mage, plain(tek), lookup)!.dps - 0.2) < 1e-9);
  assert.ok(cut.effects.some((e) => /takes 20% damage from magic/.test(e)));
  const scythe = melee('Scythe of vitur');
  assert.equal(best(scythe, tek).dps, best(scythe, plain(tek)).dps);
});

test('Great Olm: the head and each claw cut every style but their own to 34%', () => {
  const head = mon('Great Olm', 'Head (Normal)');
  const left = mon('Great Olm', 'Left claw (Normal)');
  const right = mon('Great Olm', 'Right claw (Normal)');
  assert.deepEqual(targetMods(head).styleDamage, { melee: 0.34, magic: 0.34 });
  assert.equal(styleShare(targetMods(left), 'melee', 'crush', []), 1);
  assert.equal(styleShare(targetMods(left), 'ranged', 'ranged', []), 0.34);
  assert.equal(styleShare(targetMods(right), 'magic', 'magic', []), 1);
  assert.equal(styleShare(targetMods(right), 'melee', 'slash', []), 0.34);
});

test('Ice Demon: a third of damage, except demonbane (115% vulnerable) and fire spells', () => {
  const ice = mon('Ice demon', 'Normal');
  const whip = best(melee('Abyssal whip'), ice);
  assert.ok(Math.abs(whip.dps / best(melee('Abyssal whip'), plain(ice)).dps - 0.33) < 1e-9);
  const ember = best(melee('Emberlight'), ice);
  assert.ok(ember.effects.some((e) => /Emberlight: \+80\.5% accuracy and damage/.test(e)), ember.effects.join('; '));
  assert.ok(!ember.effects.some((e) => /takes/.test(e)), 'demonbane escapes the cut');
  const fire: Loadout = { gear: { weapon: id('Harmonised nightmare staff') }, style: 3, spell: 'Fire Surge', stats: MAXED, prayer: 'augury' };
  const surge = calculate(fire, ice, lookup)!;
  assert.ok(!surge.effects.some((e) => /takes/.test(e)), 'fire spells escape the cut');
  const water = calculate({ ...fire, spell: 'Water Surge' }, ice, lookup)!;
  assert.ok(water.effects.some((e) => /takes 33% damage/.test(e)));
});

test("Vasa's glowing crystals: immune to ranged, a third of magic", () => {
  const c = targetMods(mon('Glowing crystal', 'Normal'));
  assert.equal(styleShare(c, 'ranged', 'ranged', []), 0);
  assert.ok(Math.abs(styleShare(c, 'magic', 'magic', []) - 1 / 3) < 1e-12);
  assert.equal(styleShare(c, 'melee', 'stab', []), 1);
});

test('Corporeal Beast: half damage unless corpbane on stab; magic in full', () => {
  const corp = mon('Corporeal Beast');
  const fang = melee("Osmumten's fang");
  const stab = calculate(fang, corp, lookup)!; // Fang's first style is stab
  assert.equal(stab.style.type, 'stab');
  assert.ok(!stab.effects.some((e) => /takes/.test(e)), 'the fang is corpbane on stab');
  const slash = calculate({ ...fang, style: 2 }, corp, lookup)!;
  assert.equal(slash.style.type, 'slash');
  assert.ok(slash.effects.some((e) => /takes 50% damage from melee/.test(e)));
  const scythe = best(melee('Scythe of vitur'), corp);
  assert.ok(scythe.effects.some((e) => /takes 50%/.test(e)));
  const mage = calculate({ gear: { weapon: id('Sanguinesti staff') }, style: 0, stats: MAXED }, corp, lookup)!;
  assert.ok(!mage.effects.some((e) => /takes/.test(e)));
});

test('a profile phase can set its own share (the Tormented Demon shield, say), exempting demonbane', () => {
  const td = mon('Tormented Demon', '1');
  const mods = { styleDamage: { melee: 0.8, ranged: 0.8, magic: 0.8 }, exempt: ['demonbane' as const, 'abyssal' as const] };
  const whip = best(melee('Abyssal whip'), { ...td, mods });
  assert.ok(!whip.effects.some((e) => /takes/.test(e)), 'abyssal weapons escape');
  const scythe = best(melee('Scythe of vitur'), { ...td, mods });
  assert.ok(scythe.effects.some((e) => /takes 80%/.test(e)));
});

// ── 2. Demonbane, dragonbane and the newer weapons ──────────────────────────────────────────

test('demonbane vulnerability: Emberlight +49% at Duke, +84% at Yama, +70% elsewhere', () => {
  const duke = best(melee('Emberlight'), mon('Duke Sucellus', 'Awake'));
  assert.ok(duke.effects.some((e) => /Emberlight: \+49% accuracy and damage vs demons/.test(e)), duke.effects.join('; '));
  const yama = best(melee('Emberlight'), mon('Yama', 'Normal'));
  assert.ok(yama.effects.some((e) => /\+84%/.test(e)));
  const kril = best(melee('Emberlight'), mon("K'ril Tsutsaroth"));
  assert.ok(kril.effects.some((e) => /\+70%/.test(e)));
  const flare = best(melee('Arclight'), mon('Void Flare', 'Fire'));
  assert.ok(flare.effects.some((e) => /Arclight: \+140%/.test(e)), "Yama's flares: 200%");
});

test('Darklight and Silverlight +60%, Burning claws +5%, nothing on a non-demon', () => {
  const kril = mon("K'ril Tsutsaroth");
  assert.ok(best(melee('Darklight'), kril).effects.some((e) => /Darklight: \+60%/.test(e)));
  assert.ok(best(melee('Silverlight'), kril).effects.some((e) => /Silverlight: \+60%/.test(e)));
  assert.ok(best(melee('Burning claws'), kril).effects.some((e) => /Burning claws: \+5%/.test(e)));
  assert.ok(!best(melee('Emberlight'), mon('Tekton', 'Normal')).effects.some((e) => /Emberlight/.test(e)));
  // The multiplier lands on accuracy and damage alike.
  const ember = calculate(melee('Emberlight'), kril, lookup)!;
  const base = calculate(melee('Emberlight'), plain(kril, { a: [] }), lookup)!;
  assert.equal(ember.maxHit, Math.floor(base.maxHit * 1.7));
  assert.equal(ember.attackRoll, Math.floor(base.attackRoll * 1.7));
});

test('Scorching bow: +30% vs demons, its damage added to the Slayer helm (i)', () => {
  const kril = mon("K'ril Tsutsaroth");
  const bow: Loadout = { gear: { weapon: id('Scorching bow'), ammo: id('Dragon arrow') }, style: 0, stats: MAXED, prayer: 'rigour' };
  const r = calculate(bow, kril, lookup)!;
  const off = calculate(bow, plain(kril, { a: [] }), lookup)!;
  assert.equal(r.maxHit, Math.floor(off.maxHit * 1.3));
  const helm = { ...bow, gear: { ...bow.gear, head: id('Slayer helmet (i)') }, onTask: true };
  const onTask = calculate(helm, kril, lookup)!;
  const noHelm = calculate({ ...helm, onTask: false }, plain(kril, { a: [] }), lookup)!;
  // Additive: 1 + 0.15 + 0.30 = ×1.45 over no helm, not 1.15 × 1.3.
  assert.equal(onTask.maxHit, Math.floor(noHelm.maxHit * 1.45));
});

test('demonbane spells: +20% accuracy, Mark of Darkness doubles it and adds 25%; a purging staff doubles again', () => {
  const kril = mon("K'ril Tsutsaroth");
  const cast = (weapon: string, mark: boolean): Loadout => ({ gear: { weapon: id(weapon) }, style: 3, spell: 'Dark Demonbane', stats: MAXED, markOfDarkness: mark });
  const staff = calculate(cast("Slayer's staff", false), kril, lookup)!;
  assert.ok(staff.effects.some((e) => /Dark Demonbane: \+20% accuracy$/.test(e)), staff.effects.join('; '));
  const marked = calculate(cast("Slayer's staff", true), kril, lookup)!;
  assert.ok(marked.effects.some((e) => /\+40% accuracy, \+25% damage/.test(e)));
  const purging = calculate(cast('Purging staff', true), kril, lookup)!;
  assert.ok(purging.effects.some((e) => /purging staff with Mark of Darkness: \+80% accuracy, \+50% damage/.test(e)));
  const duke = calculate(cast('Purging staff', true), mon('Duke Sucellus', 'Awake'), lookup)!;
  assert.ok(duke.effects.some((e) => /\+56% accuracy, \+35% damage/.test(e)), 'scaled by Duke’s 70%');
  assert.equal(calculate(cast('Purging staff', true), mon('Tekton', 'Normal'), lookup)!.maxHit, 0, 'demons only');
});

test('Dragon hunter wand: ×1.75 accuracy and ×1.4 damage vs dragons (the Olm counts)', () => {
  const hand = mon('Great Olm', 'Right claw (Normal)');
  const wand: Loadout = { gear: { weapon: id('Dragon hunter wand') }, style: 3, spell: 'Fire Surge', stats: MAXED };
  const r = calculate(wand, hand, lookup)!;
  const off = calculate(wand, plain(hand, { a: [] }), lookup)!;
  assert.ok(r.effects.some((e) => /Dragon hunter wand/.test(e)));
  assert.equal(r.attackRoll, Math.floor(off.attackRoll * 1.75));
});

test('Twisted bow: the magic cap is 350 inside the Chambers of Xeric', () => {
  assert.ok(twistedBow(350, 350).dmg > twistedBow(350).dmg);
  const cm = mon('Great Olm', 'Head (Challenge Mode)'); // Magic 375
  const bow: Loadout = { gear: { weapon: id('Twisted bow'), ammo: id('Dragon arrow') }, style: 1, stats: MAXED };
  const inside = calculate(bow, cm, lookup)!;
  const outside = calculate(bow, plain(cm, { a: ['dragon'] }), lookup)!;
  assert.ok(inside.maxHit > outside.maxHit, `${inside.maxHit} > ${outside.maxHit}`);
  assert.ok(inside.effects.some((e) => /target magic 350, raised cap/.test(e)));
});

test('elemental weakness raises accuracy as well as damage', () => {
  const z = mon('Zulrah', 'Serpentine'); // fire 50%
  const l: Loadout = { gear: { weapon: id('Harmonised nightmare staff') }, style: 3, spell: 'Fire Surge', stats: MAXED };
  const weak = calculate(l, z, lookup)!;
  const not = calculate(l, plain(z, { ew: undefined, ewp: undefined }), lookup)!;
  assert.equal(weak.attackRoll, Math.floor(not.attackRoll * 1.5));
  assert.ok(weak.maxHit > not.maxHit);
});

test('Awakened bosses: no Slayer helm boost', () => {
  const lev = mon('The Leviathan', 'Awakened');
  assert.equal(targetMods(lev).awakened, true);
  const l: Loadout = { gear: { weapon: id('Twisted bow'), ammo: id('Dragon arrow'), head: id('Slayer helmet (i)') }, style: 1, stats: MAXED, onTask: true };
  const awake = calculate(l, lev, lookup)!;
  const post = calculate(l, mon('The Leviathan', 'Post-quest'), lookup)!;
  assert.ok(!awake.effects.some((e) => /Slayer helm/.test(e)));
  assert.ok(post.effects.some((e) => /Slayer helm/.test(e)));
  assert.ok(awake.notes.some((n) => /Awakened/.test(n)));
});

test('Soulreaper axe: soul stacks add 6% Strength each, five by default', () => {
  const tek = plain(mon('Tekton', 'Normal'));
  const none = calculate({ ...melee('Soulreaper axe'), soulStacks: 0 }, tek, lookup)!;
  const five = calculate(melee('Soulreaper axe'), tek, lookup)!;
  assert.ok(five.maxHit > none.maxHit);
  assert.ok(five.effects.some((e) => /5 soul stacks, \+30% Strength/.test(e)));
});

test('Twinflame staff: 6 ticks, +10%, and a second spell for 40% on bolts, blasts and waves', () => {
  const t = plain(mon('Tekton', 'Normal'));
  const wave: Loadout = { gear: { weapon: id('Twinflame staff') }, style: 3, spell: 'Fire Wave', stats: MAXED };
  const r = calculate(wave, t, lookup)!;
  assert.equal(r.speed, 6);
  assert.ok(r.effects.some((e) => /second spell for 40%/.test(e)));
  const surge = calculate({ ...wave, spell: 'Fire Surge' }, t, lookup)!;
  assert.ok(!surge.effects.some((e) => /second spell/.test(e)), 'surges fire once');
});

test('tomes: +10% on their element (water +20% accuracy too), nothing on other spells', () => {
  const t = plain(mon('Tekton', 'Normal'));
  const l = (shield: string, spell: string): Loadout => ({ gear: { weapon: id('Harmonised nightmare staff'), shield: id(shield) }, style: 3, spell, stats: MAXED });
  const fire = calculate(l('Tome of fire', 'Fire Surge'), t, lookup)!;
  assert.ok(fire.effects.some((e) => /Tome of fire: ×1\.1 damage on fire spells/.test(e)));
  const water = calculate(l('Tome of water', 'Water Surge'), t, lookup)!;
  assert.ok(water.effects.some((e) => /Tome of water: ×1\.2 accuracy, ×1\.1 damage/.test(e)));
  assert.ok(!calculate(l('Tome of fire', 'Water Surge'), t, lookup)!.effects.some((e) => /Tome/.test(e)));
});

test('Eye of Ayak: a powered staff, Magic/3 − 6, every 3 ticks', () => {
  const r = calculate({ gear: { weapon: id('Eye of Ayak') }, style: 0, stats: MAXED }, plain(mon('Tekton', 'Normal')), lookup)!;
  assert.equal(r.kind, 'magic');
  assert.equal(r.speed, 3);
  assert.ok(r.maxHit >= 27);
});

test('Voidwaker spec: a sure hit for 50–150% of the melee max', () => {
  const r = calculate(melee('Voidwaker'), plain(mon('Tekton', 'Normal')), lookup)!;
  const s = voidwakerSpec(r);
  assert.equal(s.hitChance, 1);
  assert.equal(s.min, Math.floor(r.maxHit / 2));
  assert.equal(s.max, Math.floor(r.maxHit * 1.5));
});

// ── 3. Defence drain specs ──────────────────────────────────────────────────────────────────

test('Dragon warhammer at Tekton: the first spec always lands for 30%, a miss still takes 5%', () => {
  const tek = mon('Tekton', 'Normal'); // Defence 205
  const first = specDrain(melee('Dragon warhammer'), tek, lookup, [], { first: true })!;
  assert.equal(first.hitChance, 1);
  assert.equal(first.onHit, Math.floor(205 * 0.3));
  assert.equal(first.expected, 61);
  const later = specDrain(melee('Dragon warhammer'), tek, lookup)!;
  assert.ok(later.hitChance < 1);
  assert.equal(later.onMiss, Math.floor(205 * 0.05));
  const maul = specDrain(melee('Elder maul'), tek, lookup, [], { first: true })!;
  assert.equal(maul.onHit, Math.floor(205 * 0.35));
});

test('Bandos godsword drains the damage dealt, at least 10 at Tekton, rolled against slash', () => {
  const tek = mon('Tekton', 'Normal');
  const bgs = specDrain(melee('Bandos godsword'), tek, lookup)!;
  assert.equal(bgs.onMiss, 10);
  assert.ok(bgs.onHit >= 10 && bgs.onHit <= bgs.maxHit);
  const elsewhere = specDrain(melee('Bandos godsword'), plain(tek), lookup)!;
  assert.equal(elsewhere.onMiss, 0);
});

test('Emberlight drains 15% of base Defence + 1 from a demon, Arclight 10%', () => {
  const kril = mon("K'ril Tsutsaroth"); // Defence 270
  assert.equal(specDrain(melee('Emberlight'), kril, lookup)!.onHit, Math.floor(270 * 0.15) + 1);
  assert.equal(specDrain(melee('Arclight'), kril, lookup)!.onHit, Math.floor(270 * 0.1) + 1);
  assert.equal(specDrain(melee('Arclight'), plain(kril, { a: [] }), lookup)!.onHit, Math.floor(270 * 0.05) + 1);
});

test('drain limits: Akkha 10 levels, Yama no lower than 145, Awakened bosses none', () => {
  const akkha = mon('Akkha');
  assert.equal(drainRoom(akkha), 10);
  assert.equal(specDrain(melee('Dragon warhammer'), akkha, lookup)!.onHit, 10);
  const once = applyDrain(akkha, 6);
  assert.equal(once.lv[0], 74);
  assert.equal(drainRoom(once), 4, 'the cap counts what was drained before');
  assert.equal(applyDrain(once, 50).lv[0], 70);
  const yama = mon('Yama', 'Normal');
  assert.equal(drainRoom(yama), 225 - 145);
  assert.equal(drainRoom(mon('The Leviathan', 'Awakened')), 0);
});

test('specs ranked by Defence per bar, and the later phases fought at the drained Defence', () => {
  const tek = mon('Tekton', 'Normal');
  const base = melee('Scythe of vitur');
  const ranked = rankDrainSpecs(base, [byId.get(id('Bandos godsword'))!, byId.get(id('Dragon warhammer'))!, byId.get(id('Elder maul'))!], tek, lookup, [], { first: true });
  assert.deepEqual(ranked.map((r) => r.spec.key).slice(0, 2), ['elder-maul', 'dwh']);
  const { monster, steps } = afterSpecs(base, [byId.get(id('Elder maul'))!, byId.get(id('Dragon warhammer'))!], tek, lookup);
  assert.equal(steps[0].levels, 71);
  assert.ok(monster.lv[0] < 205 - 71);
  assert.ok(best(base, monster).dps > best(base, tek).dps);
});

// ── 5. Avoid Defence XP ─────────────────────────────────────────────────────────────────────

test('Avoid Defence XP: controlled, defensive, longrange and defensive autocast never picked', () => {
  const banned = Object.values({ Whip: stylesFor('Whip'), Bow: stylesFor('Bow'), Staff: stylesFor('Staff'), Spear: stylesFor('Spear'), Scythe: stylesFor('Scythe') })
    .flat()
    .filter(givesDefenceXp)
    .map((s) => `${s.name}:${s.stance}`);
  assert.deepEqual([...new Set(banned)].sort(), ['Block:defensive', 'Defensive autocast:autocast', 'Deflect:defensive', 'Focus:defensive', 'Lash:controlled', 'Longrange:longrange', 'Lunge:controlled', 'Pound:controlled', 'Swipe:controlled'].sort());
  const t = plain(mon('Tekton', 'Normal'));
  const whip = bestStyle({ ...melee('Abyssal whip'), avoidDefenceXp: true }, t, lookup)!;
  assert.equal(whip.result.style.name, 'Flick');
  // A spear has only controlled styles (and Block): nothing a pure can use.
  assert.equal(bestStyle({ ...melee('Zamorakian spear'), avoidDefenceXp: true }, t, lookup), null);
  const powered = bestStyle({ gear: { weapon: id('Sanguinesti staff') }, style: 0, stats: MAXED, avoidDefenceXp: true }, t, lookup)!;
  assert.equal(powered.result.style.stance, 'accurate');
});
