import { test } from 'node:test';
import assert from 'node:assert/strict';
import { huntFromInput, huntRowPlaced, type HuntConfig } from '@/lib/itemHunt';

const first = (() => {
  const r = huntFromInput({ v: 2, rule: 'first', items: [{ id: 28252, name: 'Baron', sources: [], points: 1 }], ends: { kind: 'date' } });
  assert.ok(r.ok);
  return (r as { config: HuntConfig }).config;
})();

test('a hunt places a drop, and otherwise progress at the targets (paid 2nd and 3rd on a "first" week)', () => {
  assert.equal(huntRowPlaced(first, { count: 1, statGain: 0, due: null }), true);
  assert.equal(huntRowPlaced(first, { count: 0, statGain: 74, due: 0.04 }), true);
  assert.equal(huntRowPlaced(first, { count: 0, statGain: 0, due: 0.01 }), true);
  // Did nothing at the targets: not placed, as before.
  assert.equal(huntRowPlaced(first, { count: 0, statGain: 0, due: 0 }), false);
  assert.equal(huntRowPlaced(first, { count: 0, statGain: null, due: null }), false);
});
