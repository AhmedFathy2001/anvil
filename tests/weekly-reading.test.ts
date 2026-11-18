import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReading } from '../src/lib/moments.ts';

const reading = { fishing: 13_034_431, zulrah: 311 };

test('a skill week keeps the XP, a boss week the kill count', () => {
  assert.deepEqual(weeklyReading({ id: 1, type: 'skill', metric: 'fishing' }, reading), { xp: 13_034_431, kc: null });
  assert.deepEqual(weeklyReading({ id: 2, type: 'boss', metric: 'zulrah' }, reading), { xp: null, kc: 311 });
});

test('several skills or bosses, efficiency, or no reading: nothing is claimed', () => {
  assert.equal(weeklyReading({ id: 3, type: 'boss', metric: 'zulrah,vorkath' }, reading), null);
  assert.equal(weeklyReading({ id: 4, type: 'efficiency', metric: 'ehp' }, reading), null);
  assert.equal(weeklyReading({ id: 5, type: 'skill', metric: 'mining' }, reading), null);
  assert.equal(weeklyReading(undefined, reading), null);
});
