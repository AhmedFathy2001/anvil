import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderForRound, getTeamForPick } from '../src/lib/draft';

test('orderForRound flips on odd rounds, matching who picks', () => {
  const order = [1, 2, 3];
  assert.deepEqual(orderForRound(order, 0), [1, 2, 3]);
  assert.deepEqual(orderForRound(order, 1), [3, 2, 1]);
  assert.deepEqual(orderForRound(order, 2), [1, 2, 3]);
  // First pick of round 2 (pick number 3) is the first team shown for that round.
  assert.equal(getTeamForPick(order, 3), orderForRound(order, 1)[0]);
});
