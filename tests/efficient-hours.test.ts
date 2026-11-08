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
