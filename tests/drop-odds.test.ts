// Expected kills, multi-roll and any-of/all-of drop maths (lib/dropOdds).
// Run: npx tsx --test tests/drop-odds.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anyOfChance,
  chanceBy,
  expectedKills,
  expectedKillsForAll,
  expectedKillsForAny,
  expectedKillsForItem,
  hoursFor,
  itemChance,
  killLuck,
  killsForQuantile,
  perKillChance,
} from '../src/lib/dropOdds.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('single item: expected kills = 1/p', () => {
  assert.equal(expectedKillsForItem({ denominator: 128 }), 128);
  assert.equal(expectedKillsForItem({ denominator: 5000 }), 5000);
  assert.equal(expectedKills(0), Infinity);
  assert.equal(expectedKillsForItem({ denominator: 0 }), Infinity);
});

test('multiple rolls use 1-(1-p)^r, not r·p', () => {
  const q = itemChance({ denominator: 100, rolls: 2 });
  close(q, 1 - 0.99 * 0.99);
  close(expectedKillsForItem({ denominator: 100, rolls: 2 }), 1 / (1 - 0.99 ** 2));
  // r·p would pass 1 here; the real chance never does.
  assert.ok(perKillChance(0.5, 3) < 1);
  close(perKillChance(0.5, 3), 0.875);
});

test('any-of: same table adds, separate tables combine independently', () => {
  // Two 1/100 items on one roll: 2/100 per kill → 50 kills.
  close(expectedKillsForAny([{ denominator: 100, table: 'main' }, { denominator: 100, table: 'main' }]), 50);
  // Two independent 1/100 rolls: 1 - 0.99² per kill.
  close(anyOfChance([{ denominator: 100 }, { denominator: 100 }]), 1 - 0.99 ** 2);
  // Mixed: a shared table plus an independent one.
  const q = anyOfChance([{ denominator: 100, table: 't' }, { denominator: 50, table: 't' }, { denominator: 200 }]);
  close(q, 1 - (1 - 3 / 100) * (1 - 1 / 200));
  // Shared table with 2 rolls: rolls apply to the combined chance.
  close(anyOfChance([{ denominator: 10, table: 't', rolls: 2 }, { denominator: 10, table: 't', rolls: 2 }]), 1 - 0.8 ** 2);
});

test('all-of: inclusion–exclusion matches the known two-item result', () => {
  // Two independent 1/2 items: E[max of two geometric(1/2)] = 2 + 2 - 4/3 = 8/3.
  close(expectedKillsForAll([{ denominator: 2 }, { denominator: 2 }]), 8 / 3);
  close(expectedKillsForAll([{ denominator: 7 }]), 7);
  assert.equal(expectedKillsForAll([]), 0);
  assert.equal(expectedKillsForAll([{ denominator: 0 }]), Infinity);
  // Never less than the rarest item alone.
  assert.ok(expectedKillsForAll([{ denominator: 100 }, { denominator: 10 }]) >= 100);
});

test('hours = kills ÷ kph; unknown rate is null', () => {
  assert.equal(hoursFor(200, 20), 10);
  assert.equal(hoursFor(200, null), null);
  assert.equal(hoursFor(200, 0), null);
});

test('chanceBy and quantiles are inverses', () => {
  const q = 1 / 512;
  const k = killsForQuantile(q, 0.5);
  close(chanceBy(q, k), 0.5, 1e-9);
  assert.equal(chanceBy(q, 0), 0);
});

test('killLuck verdicts', () => {
  const q = 1 / 100;
  assert.equal(killLuck(q, 5, true)?.verdict, 'spooned');
  assert.equal(killLuck(q, 5, false)?.verdict, 'on-rate'); // early, not spooned
  assert.equal(killLuck(q, 100, true)?.verdict, 'on-rate');
  assert.equal(killLuck(q, 200, false)?.verdict, 'dry');
  assert.equal(killLuck(q, 400, false)?.verdict, 'very-dry');
  const r = killLuck(q, 50, true)!;
  assert.equal(r.expected, 100);
  assert.equal(r.ratio, 0.5);
  assert.equal(killLuck(0, 10, true), null);
});
