// lib/luckWorth: which rare drops count toward luck. Pure — prices come in as a map.
//
// Run: npx tsx --test tests/luck-worth.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_LUCK_VALUE_FLOOR, luckValueFloor, worthCounting } from '../src/lib/luckWorth';

const petIds = new Set([13071]);
const prices = new Map<number, number>([
  [22486, 1_200_000_000], // Scythe
  [13072, 31_399], // Jar of souls
  [1, 183_138], // Dragon chainbody
  [2, 1_000_000], // exactly the floor
]);
const ctx = { prices, floor: DEFAULT_LUCK_VALUE_FLOOR, petIds };
const counts = (itemId: number, itemName: string, c = ctx) => worthCounting({ itemId, itemName }, c);

test('valuable drops count, alch money does not, the floor itself counts', () => {
  assert.equal(counts(22486, 'Scythe of vitur (uncharged)'), true);
  assert.equal(counts(1, 'Dragon chainbody'), false);
  assert.equal(counts(2, 'At the floor'), true);
});

test('pets and jars always count, whatever they sell for', () => {
  assert.equal(counts(13071, 'Pet snakeling'), true);
  assert.equal(counts(13072, 'Jar of souls'), true);
});

test('unpriced uniques count; named junk never does', () => {
  assert.equal(counts(28285, 'Ultor vestige'), true);
  for (const junk of ['Jewel of the sun', 'Eye of the corruptor', 'Breach of the scarab', 'Jewel of amascut', 'Thread of elidinis', 'Kq head']) {
    assert.equal(counts(99, junk), false, junk);
  }
});

test('with no price feed only the junk list applies', () => {
  const offline = { ...ctx, prices: new Map<number, number>() };
  assert.equal(counts(1, 'Dragon chainbody', offline), true);
  assert.equal(counts(99, 'Jewel of the sun', offline), false);
});

test('the floor setting: blank or garbage is the default, 0 means rarity alone', () => {
  assert.equal(luckValueFloor(null), DEFAULT_LUCK_VALUE_FLOOR);
  assert.equal(luckValueFloor(''), DEFAULT_LUCK_VALUE_FLOOR);
  assert.equal(luckValueFloor('lots'), DEFAULT_LUCK_VALUE_FLOOR);
  assert.equal(luckValueFloor('-5'), DEFAULT_LUCK_VALUE_FLOOR);
  assert.equal(luckValueFloor('0'), 0);
  assert.equal(luckValueFloor('5000000'), 5_000_000);
  assert.equal(counts(1, 'Dragon chainbody', { ...ctx, floor: 0 }), true);
});
