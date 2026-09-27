// The DPS engine against numbers worked by hand from the published formulas, plus the dataset
// wiring (real items from src/data/gearItems.json). No database.
//
// Run: npx tsx --test tests/dps-engine.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculate, hitChance, twistedBow, bestStyle, type GearItem, type Monster, type Loadout } from '../src/lib/dps/engine.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const ITEMS = (itemsJson as { items: GearItem[] }).items;
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const lookup = (id: number | null | undefined) => (id == null ? null : (byId.get(id) ?? null));
const item = (name: string) => {
  const it = ITEMS.find((i) => i.n.toLowerCase() === name.toLowerCase());
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};
const MONSTERS = (monstersJson as { monsters: Monster[] }).monsters;
const monster = (n: string, v?: string) => {
  const m = MONSTERS.find((x) => x.n === n && (v == null || x.v === v));
  assert.ok(m, `dataset has ${n} ${v ?? ''}`);
  return m!;
};

const MAXED = { attack: 99, strength: 99, ranged: 99, magic: 99 };
// A plain target: level 1 defence, no bonuses.
const DUMMY: Monster = { n: 'Dummy', hp: 100, lv: [1, 1], d: [0, 0, 0, 0, 0, 0, 0], sz: 1 };

test('hit chance: both branches of the accuracy formula', () => {
  assert.equal(hitChance(100, 100), 100 / (2 * 101));
  assert.equal(hitChance(300, 100), 1 - 102 / (2 * 301));
});

test('melee max hit: 99 str, super combat, piety, aggressive, no gear = 16', () => {
  // 99 → 118 (super combat), ×1.23 → 145, +3 aggressive +8 = 156; (156·64 + 320)/640 = 16.1
  const r = calculate({ gear: {}, style: 1, stats: MAXED, prayer: 'piety', boost: 'super_combat' }, DUMMY, lookup)!;
  assert.equal(r.kind, 'melee');
  assert.equal(r.maxHit, 16);
  assert.equal(r.speed, 4);
});

test('abyssal whip: +82 str bonus, lash (controlled)', () => {
  // 99 unboosted, no prayer: 99 + 1 controlled + 8 = 108; (108·146 + 320)/640 = 25.1
  const r = calculate({ gear: { weapon: item('Abyssal whip') }, style: 1, stats: MAXED }, DUMMY, lookup)!;
  assert.equal(r.maxHit, 25);
  assert.equal(r.style.name, 'Lash');
});

test('twisted bow scales with the target’s magic', () => {
  assert.deepEqual(twistedBow(150), { acc: 1.14, dmg: 1.64 });
  assert.deepEqual(twistedBow(1), { acc: Math.max(0, 140 + Math.floor(-7 / 100) - Math.floor((0 - 100) ** 2 / 100)) / 100, dmg: Math.max(0, 250 + Math.floor(-11 / 100) - Math.floor((0 - 140) ** 2 / 100)) / 100 });
  // Capped at 250 magic outside raids.
  assert.deepEqual(twistedBow(400), twistedBow(250));
});

test('salve (ei) and a slayer helm never stack; salve wins on undead', () => {
  const vork = monster('Vorkath', 'Post-quest');
  const base: Loadout = { gear: { weapon: item('Abyssal whip'), head: item('Slayer helmet (i)') }, style: 1, stats: MAXED, onTask: true };
  const helm = calculate(base, vork, lookup)!;
  const both = calculate({ ...base, gear: { ...base.gear, neck: item('Salve amulet(ei)') } }, vork, lookup)!;
  const plain = calculate({ ...base, onTask: false }, vork, lookup)!;
  assert.ok(helm.maxHit > plain.maxHit, 'slayer helm on task boosts melee');
  assert.equal(both.maxHit, Math.floor(plain.maxHit * 1.2), 'salve (e) 20% replaces the helm');
});

test('dragon hunter crossbow is stronger than a rune crossbow on Vorkath', () => {
  const vork = monster('Vorkath', 'Post-quest');
  const bolts = item('Ruby dragon bolts (e)');
  const load = (w: string): Loadout => ({ gear: { weapon: item(w), ammo: bolts }, style: 1, stats: MAXED, prayer: 'rigour', boost: 'ranging' });
  const rcb = calculate(load('Rune crossbow'), vork, lookup)!;
  const dhcb = calculate(load('Dragon hunter crossbow'), vork, lookup)!;
  assert.equal(rcb.kind, 'ranged');
  assert.equal(rcb.speed, 5, 'rapid is one tick faster');
  assert.ok(dhcb.dps > rcb.dps * 1.3);
});

test('scythe hits a large target three times', () => {
  const big: Monster = { ...DUMMY, sz: 3 };
  const scy = item('Scythe of Vitur');
  const one = calculate({ gear: { weapon: scy }, style: 0, stats: MAXED }, DUMMY, lookup)!;
  const three = calculate({ gear: { weapon: scy }, style: 0, stats: MAXED }, big, lookup)!;
  assert.ok(three.dps > one.dps * 1.6);
});

test('powered staves: trident max hit scales with magic', () => {
  const r = calculate({ gear: { weapon: item('Trident of the Seas') }, style: 0, stats: MAXED }, DUMMY, lookup)!;
  assert.equal(r.kind, 'magic');
  assert.equal(r.maxHit, Math.floor(99 / 3) - 5);
  const boosted = calculate({ gear: { weapon: item('Trident of the Seas') }, style: 0, stats: MAXED, boost: 'saturated_heart' }, DUMMY, lookup)!;
  assert.equal(boosted.maxHit, Math.floor((99 + 4 + 9) / 3) - 5);
});

test('autocast needs a spell; elemental weakness raises the max hit', () => {
  const staff = item("Ahrim's staff");
  const none = calculate({ gear: { weapon: staff }, style: 3, stats: MAXED }, DUMMY, lookup);
  assert.equal(none, null);
  const weak: Monster = { ...DUMMY, ew: 'fire', ewp: 40 };
  const fire = calculate({ gear: { weapon: staff }, style: 3, spell: 'Fire Surge', stats: MAXED }, weak, lookup)!;
  const plain = calculate({ gear: { weapon: staff }, style: 3, spell: 'Fire Surge', stats: MAXED }, DUMMY, lookup)!;
  assert.equal(fire.maxHit - plain.maxHit, Math.floor((24 * 40) / 100));
  assert.equal(fire.speed, 5);
});

test('bestStyle picks the strongest stance', () => {
  const best = bestStyle({ gear: { weapon: item('Abyssal whip') }, style: 0, stats: MAXED }, DUMMY, lookup)!;
  assert.ok(best.result.dps > 0);
  assert.notEqual(best.result.style.stance, 'defensive');
});

// ── Upgrade route ──────────────────────────────────────────────────────────────────────────

import { upgradeRoute } from '../src/lib/dps/route.ts';

test('upgrade route: cheapest DPS first, untradeables listed apart', () => {
  const vork = monster('Vorkath', 'Post-quest');
  const stats = { attack: 80, strength: 80, ranged: 90, magic: 80 };
  const setup = (gear: Record<string, number>) => ({ tier: 'advanced' as const, name: 'x', gear, style: 1, stats });
  const target = setup({
    weapon: item('Dragon hunter crossbow'),
    ammo: item('Ruby dragon bolts (e)'),
    head: item('Armadyl helmet'),
    neck: item('Necklace of anguish'),
    cape: item("Ava's assembler"),
  });
  const current: Loadout = { gear: { weapon: item('Rune crossbow'), ammo: item('Ruby dragon bolts (e)') }, style: 1, stats };
  const prices: Record<number, number> = {
    [item('Dragon hunter crossbow')]: 60_000_000,
    [item('Armadyl helmet')]: 5_000_000,
    [item('Necklace of anguish')]: 12_000_000,
    [item('Ruby dragon bolts (e)')]: 5_000,
  };
  const route = upgradeRoute(current, [target], vork, lookup, prices);
  assert.ok(route.steps.length >= 2);
  // Running totals add up and DPS only goes up.
  let cost = 0;
  let dps = route.start;
  for (const s of route.steps) {
    cost += s.price ?? 0;
    assert.equal(s.totalCost, cost);
    assert.ok(s.dpsAfter > dps);
    dps = s.dpsAfter;
  }
  // The assembler has no price here: it is offered apart, not ranked by cost.
  assert.ok(route.untradeable.some((u) => u.item.n === "Ava's assembler"));
  assert.ok(!route.steps.some((s) => s.item.n === "Ava's assembler"));
});

// ── Prayers, boosts, Dharok's ──────────────────────────────────────────────────────────────

import { togglePrayer, prayerMultipliers, boostedLevel } from '../src/lib/dps/tables.ts';

test('prayers combine like in game: attack + strength together, overlap switches off', () => {
  let on = togglePrayer([], 'clarity');
  on = togglePrayer(on, 'burst');
  assert.deepEqual(on.sort(), ['burst', 'clarity']);
  assert.deepEqual(prayerMultipliers(on, 'melee'), { acc: 1.05, str: 1.05 });
  on = togglePrayer(on, 'piety'); // overlaps both
  assert.deepEqual(on, ['piety']);
  on = togglePrayer(on, 'superhuman'); // overlaps Piety's strength → Piety goes
  assert.deepEqual(on, ['superhuman']);
  // An old single-key save still reads.
  assert.deepEqual(prayerMultipliers('melee15', 'melee'), { acc: 1.15, str: 1.15 });
  // A ranged prayer never helps a melee attack.
  assert.deepEqual(prayerMultipliers(['rigour'], 'melee'), { acc: 1, str: 1 });
});

test('boosts are per stat: Zamorak brew raises attack more than strength', () => {
  assert.equal(boostedLevel(99, 'zamorak_brew', 'attack'), 99 + 2 + Math.floor(99 * 0.2));
  assert.equal(boostedLevel(99, 'zamorak_brew', 'strength'), 99 + 2 + Math.floor(99 * 0.12));
  assert.equal(boostedLevel(99, 'super_strength', 'attack'), 99, 'strength-only potion leaves attack alone');
  assert.equal(boostedLevel(99, 'ranging', 'magic'), 99);
});

test("Dharok's set hits harder at low HP; demonbane needs a demon", () => {
  const set = { weapon: item("Dharok's greataxe"), head: item("Dharok's helm"), body: item("Dharok's platebody"), legs: item("Dharok's platelegs") };
  const full = calculate({ gear: set, style: 1, stats: { ...MAXED, hitpoints: 99, currentHp: 99 } }, DUMMY, lookup)!;
  const low = calculate({ gear: set, style: 1, stats: { ...MAXED, hitpoints: 99, currentHp: 1 } }, DUMMY, lookup)!;
  assert.equal(low.maxHit, Math.floor(full.maxHit * (1 + (98 / 100) * (99 / 100))));
  const staff = item("Ahrim's staff");
  const dem = calculate({ gear: { weapon: staff }, style: 3, spell: 'Dark Demonbane', stats: MAXED }, { ...DUMMY, a: ['demon'] }, lookup)!;
  const not = calculate({ gear: { weapon: staff }, style: 3, spell: 'Dark Demonbane', stats: MAXED }, DUMMY, lookup)!;
  assert.ok(dem.maxHit >= 30);
  assert.equal(not.maxHit, 0);
});
