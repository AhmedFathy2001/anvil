import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowToTileConfig, splitAmount } from '../src/lib/taskSuggestRows.ts';

test('a leading number is the amount, with k and m', () => {
  assert.deepEqual(splitAmount('100 zulrah'), { amount: 100, rest: 'zulrah' });
  assert.deepEqual(splitAmount('5m fishing'), { amount: 5_000_000, rest: 'fishing' });
  assert.deepEqual(splitAmount('2.5k slayer'), { amount: 2_500, rest: 'slayer' });
  assert.deepEqual(splitAmount('zenyte shard'), { amount: null, rest: 'zenyte shard' });
  // A number inside a name is not an amount.
  assert.equal(splitAmount('3rd age').amount, null);
});

const byName = new Map([
  ['zenyte shard', { id: 19529, name: 'Zenyte shard' }],
  ['beaver', { id: 13322, name: 'Beaver' }],
  ['heron', { id: 13320, name: 'Heron' }],
]);

test('a one-item library task becomes a drop tile tracking that item', () => {
  const cfg = rowToTileConfig({ tileType: 'drop', items: [{ name: 'Zenyte shard', count: 1 }] }, byName);
  assert.equal(cfg?.tileType, 'drop');
  assert.deepEqual(cfg?.trackedItemIds, [19529]);
  assert.equal(cfg?.requiredAmount, 1);
});

test('an any-of-these task becomes a pool needing one', () => {
  const cfg = rowToTileConfig({ tileType: 'drop', items: [{ name: 'Beaver', count: 1 }, { name: 'Heron', count: 1 }] }, byName);
  assert.deepEqual(cfg?.trackedItemIds, [13322, 13320]);
  assert.equal(cfg?.requiredAmount, 1);
});

test('an item the catalogue does not know drops the task rather than leaving it tracking nothing', () => {
  assert.equal(rowToTileConfig({ tileType: 'drop', items: [{ name: 'Not an item', count: 1 }] }, byName), null);
});

test('an old "stat" XP task reads as a standard tile with its skill goal', () => {
  const cfg = rowToTileConfig({ tileType: 'stat' as never, statType: 'skill', trackedStat: 'slayer', statGoal: 500000 }, byName);
  assert.equal(cfg?.tileType, 'standard');
  assert.equal(cfg?.statType, 'skill');
  assert.equal(cfg?.statGoal, 500000);
});
