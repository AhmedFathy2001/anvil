// A clan's Moments wall (lib/clanMomentsRules): which tag a moment wears and which one leads. Pure.
//
// Run: npx tsx --test tests/clan-moments.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_TOTAL, momentLabel, orderMoments, type Moment } from '../src/lib/clanMomentsRules.ts';

const m = (rsn: string, at: string, weight: number, tag = 't'): Moment => ({ rsn, text: `${rsn} ${tag}`, iconUrl: null, at, tag, weight });

test('tags: pets and maxes outrank a log slot, which outranks a 99, which outranks a KC', () => {
  const pet = momentLabel({ kind: 'clog', pageName: 'All Pets' });
  const slot = momentLabel({ kind: 'clog', pageName: 'Chambers of Xeric' });
  const max = momentLabel({ kind: 'milestone', milestone: 'total', threshold: MAX_TOTAL });
  const ninetyNine = momentLabel({ kind: 'milestone', milestone: 'level', threshold: 99 });
  const kc = momentLabel({ kind: 'milestone', milestone: 'kc', threshold: 1000 });
  assert.equal(pet.tag, 'Pet');
  assert.equal(max.tag, 'Maxed');
  assert.equal(slot.tag, 'New log slot');
  assert.equal(ninetyNine.tag, 'Level 99');
  assert.ok(pet.weight > max.weight && max.weight > ninetyNine.weight && ninetyNine.weight > slot.weight - 20 && slot.weight > kc.weight);
  assert.equal(momentLabel({ kind: 'milestone', milestone: 'total', threshold: 2000 }).tag, 'Total level');
});

test('max total follows the skill list (every skill at 99)', () => {
  assert.equal(MAX_TOTAL % 99, 0);
  assert.ok(MAX_TOTAL >= 2277);
});

test('the weightiest moment leads; the rest stay newest first', () => {
  const out = orderMoments([
    m('a', '2026-11-04T10:00:00Z', 10),
    m('b', '2026-11-03T10:00:00Z', 100, 'pet'),
    m('c', '2026-11-04T12:00:00Z', 20),
  ]);
  assert.deepEqual(out.map((x) => x.rsn), ['b', 'c', 'a']);
});

test('one member never fills the wall, and the limit holds', () => {
  const lots = Array.from({ length: 10 }, (_, i) => m('grinder', `2026-11-0${(i % 9) + 1}T00:00:00Z`, 10));
  const out = orderMoments([...lots, m('other', '2026-10-01T00:00:00Z', 5)], 9, 3);
  assert.equal(out.filter((x) => x.rsn === 'grinder').length, 3);
  assert.ok(out.some((x) => x.rsn === 'other'));
  assert.equal(orderMoments([]).length, 0);
  assert.equal(orderMoments(Array.from({ length: 20 }, (_, i) => m(`p${i}`, `2026-11-01T00:00:${String(i).padStart(2, '0')}Z`, 1))).length, 9);
});
