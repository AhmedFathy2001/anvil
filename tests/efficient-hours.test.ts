// Efficient hours played / bossed over our wiki-built rate tables (lib/efficiency).
// Run: npx tsx --test tests/efficient-hours.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bossKillsPerHour,
  computeEfficiency,
  computeEhpEhb,
  hoursForXp,
  rateTableFor,
  skillHours,
  xpForLevel,
  xpPerHourAt,
} from '../src/lib/efficiency.ts';
import rates from '../src/data/hourRates.json';

const snap = (skills: Record<string, number>, bosses: Record<string, number> = {}) => ({
  skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { rank: 1, level: 1, xp }])),
  bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { rank: 1, score }])),
});

test('game XP formula', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 83);
  assert.equal(xpForLevel(99), 13_034_431);
});

test('hours bossed = kc ÷ kills per hour', () => {
  const kph = bossKillsPerHour('zulrah')!;
  assert.ok(kph > 0);
  const { ehb } = computeEhpEhb(snap({}, { zulrah: 200 }));
  assert.ok(Math.abs(ehb - 200 / kph) < 1e-9);
  // Unranked and unknown bosses add nothing.
  assert.equal(computeEhpEhb(snap({}, { zulrah: -1, notABoss: 50 })).ehb, 0);
});

test('skill hours are piecewise over bands and monotonic', () => {
  assert.equal(skillHours('main', 'woodcutting', 0), 0);
  const a = skillHours('main', 'woodcutting', 1_000_000);
  const b = skillHours('main', 'woodcutting', 13_034_431);
  assert.ok(a > 0 && b > a);
  // Splitting a gain in two gives the same total.
  const whole = hoursForXp('woodcutting', 0, 2_000_000);
  const split = hoursForXp('woodcutting', 0, 1_200_000) + hoursForXp('woodcutting', 1_200_000, 800_000);
  assert.ok(Math.abs(whole - split) < 1e-9);
});

test('hitpoints from combat training is free', () => {
  const combat = 3_000_000;
  const hp = 1_154 + combat / 3;
  const r = computeEfficiency(snap({ attack: combat, hitpoints: hp }));
  assert.equal(r.ehpBySkill.hitpoints, 0);
  const extra = computeEfficiency(snap({ attack: combat, hitpoints: hp + 500_000 }));
  assert.ok(extra.ehpBySkill.hitpoints > 0);
});

test('ironman tables are never faster than main for estimated scaling', () => {
  for (const [skill, bands] of Object.entries(rates.skills.ironman)) {
    if ((bands as { estimated: boolean }[]).every((b) => b.estimated)) {
      assert.ok((xpPerHourAt(skill, 80, 'ironman') ?? 0) <= (xpPerHourAt(skill, 80, 'main') ?? 0), skill);
    }
  }
  assert.equal(rateTableFor('ultimate'), 'ironman');
  assert.equal(rateTableFor('regular'), 'main');
  assert.equal(rateTableFor(null), 'main');
});

test('every rate names a wiki page or is flagged estimated', () => {
  for (const table of ['main', 'ironman'] as const) {
    for (const bands of Object.values(rates.skills[table])) {
      for (const b of bands as { source: string | null; estimated: boolean }[]) assert.ok(b.estimated || !!b.source);
    }
    for (const r of Object.values(rates.bosses[table]) as { source: string | null; estimated: boolean }[]) {
      assert.ok(r.estimated || !!r.source);
    }
  }
});

test('time to max is zero once maxed', () => {
  const all = Object.fromEntries(Object.keys(rates.skills.main).map((s) => [s, 13_034_431]));
  const r = computeEfficiency(snap(all));
  assert.equal(r.ttm, 0);
  assert.ok(r.tt200m > 0);
});

test('Slayer already paid for four combat XP per Slayer XP: that share of combat XP is not counted again', async () => {
  const { combatShareBeyondSlayer, COMBAT_XP_PER_SLAYER_XP } = await import('../src/lib/efficiency.ts');
  assert.equal(COMBAT_XP_PER_SLAYER_XP, 4);
  const xp = (o: Record<string, number>) => new Map(Object.entries(o));
  // No Slayer: every combat hour counts. No combat XP: nothing to scale.
  assert.equal(combatShareBeyondSlayer(xp({ attack: 1_000_000 })), 1);
  assert.equal(combatShareBeyondSlayer(xp({ slayer: 1_000_000 })), 1);
  // 1m Slayer explains 4m of 8m combat XP: half is left.
  assert.equal(combatShareBeyondSlayer(xp({ attack: 4_000_000, strength: 4_000_000, slayer: 1_000_000 })), 0.5);
  // More Slayer than the combat XP could come from: none left, never negative.
  assert.equal(combatShareBeyondSlayer(xp({ attack: 1_000_000, slayer: 5_000_000 })), 0);

  const noSlayer = computeEfficiency(snap({ attack: 4_000_000, strength: 4_000_000 }));
  const withSlayer = computeEfficiency(snap({ attack: 4_000_000, strength: 4_000_000, slayer: 1_000_000 }));
  assert.ok(Math.abs(withSlayer.ehpBySkill.attack - noSlayer.ehpBySkill.attack / 2) < 1e-9);
  assert.ok(withSlayer.ehpBySkill.slayer > 0);
  // A non-combat skill is untouched by it.
  const wc = computeEfficiency(snap({ woodcutting: 2_000_000, attack: 4_000_000, slayer: 1_000_000 }));
  assert.ok(Math.abs(wc.ehpBySkill.woodcutting - skillHours('main', 'woodcutting', 2_000_000)) < 1e-9);
  // `combat` is the combat part of the total, for the daily gain's overlap with bossing.
  assert.ok(Math.abs(withSlayer.combat - (withSlayer.ehpBySkill.attack + withSlayer.ehpBySkill.strength)) < 1e-9);
  assert.ok(Math.abs(computeEhpEhb(snap({ attack: 4_000_000, strength: 4_000_000, slayer: 1_000_000 })).combat - withSlayer.combat) < 1e-9);
});

test('skilling bosses are hours played through their XP, not hours bossed', () => {
  const r = computeEfficiency(snap({}, { wintertodt: 500, tempoross: 300, zalcano: 200, zulrah: 100 }));
  assert.deepEqual(Object.keys(r.ehbByBoss), ['zulrah']);
  assert.ok(Math.abs(computeEhpEhb(snap({}, { wintertodt: 500, zulrah: 100 })).ehb - 100 / bossKillsPerHour('zulrah')!) < 1e-9);
  // Their rates stay in the table: collection-log hours and tile balance still read them.
  assert.ok(bossKillsPerHour('wintertodt')! > 0);
});

test('a main is never rated slower than an ironman at Slayer', () => {
  for (const level of [1, 50, 80, 99]) {
    assert.ok(xpPerHourAt('slayer', level, 'main')! >= xpPerHourAt('slayer', level, 'ironman')!);
  }
});

test('a running efficiency competition’s baseline moves to the new model only when the old model wrote it', async () => {
  const { rebasedBaseline, legacyEhpEhb } = await import('../src/lib/efficiency.ts');
  const s = snap({ attack: 6_000_000, strength: 6_000_000, slayer: 2_000_000, woodcutting: 1_000_000 }, { wintertodt: 400, zulrah: 300 });
  const oldEhp = Math.round(legacyEhpEhb(s).ehp * 1000);
  const newEhp = Math.round(computeEhpEhb(s).ehp * 1000);
  assert.ok(newEhp < oldEhp, 'the new model is the smaller number here');
  assert.equal(rebasedBaseline(oldEhp, s, 'ehp'), newEhp);
  // Already moved, corrected by an admin, missing: left alone.
  assert.equal(rebasedBaseline(newEhp, s, 'ehp'), null);
  assert.equal(rebasedBaseline(oldEhp - 5000, s, 'ehp'), null);
  assert.equal(rebasedBaseline(null, s, 'ehp'), null);
  assert.equal(rebasedBaseline(oldEhp, null, 'ehp'), null);
  // Hours bossed: Wintertodt leaves the baseline.
  const oldEhb = Math.round(legacyEhpEhb(s).ehb * 1000);
  assert.equal(rebasedBaseline(oldEhb, s, 'ehb'), Math.round(computeEhpEhb(s).ehb * 1000));
});
