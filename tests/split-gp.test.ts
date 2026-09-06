// Dividing gp between people, exactly.
//
// Shared by two money paths — a prize place several people finished level on, and a donation
// several people chipped into — so the rounding is pinned in one place rather than twice.
//
// Run: npm run test:splitgp

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitEvenly } from '../src/lib/splitGp.ts';

const sums = (total: number, ways: number) => splitEvenly(total, ways).reduce((a, b) => a + b, 0);

test('an even division is even', () => {
  assert.deepEqual(splitEvenly(90, 3), [30, 30, 30]);
});

test('a remainder goes out a gp at a time from the top, never dropped', () => {
  assert.deepEqual(splitEvenly(100, 3), [34, 33, 33]);
  assert.deepEqual(splitEvenly(101, 3), [34, 34, 33]);
  // The reason it matters: the ledger has to balance against the number that was advertised.
  assert.equal(sums(100, 3), 100);
  assert.equal(sums(999_999_999, 7), 999_999_999);
});

test('nobody is short by more than a single gp', () => {
  const shares = splitEvenly(1_000_000_007, 9);
  assert.equal(Math.max(...shares) - Math.min(...shares), 1);
});

test('one way is the whole thing', () => {
  assert.deepEqual(splitEvenly(50_000_000, 1), [50_000_000]);
});

test('nothing to split, and nobody to split it between', () => {
  assert.deepEqual(splitEvenly(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(splitEvenly(100, 0), []);
  assert.deepEqual(splitEvenly(-100, 3), [0, 0, 0]);
});

test('fractions of a gp do not exist', () => {
  assert.deepEqual(splitEvenly(10.9, 2), [5, 5]);
});
