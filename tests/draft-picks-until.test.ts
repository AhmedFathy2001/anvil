// Run: npx tsx --test tests/draft-picks-until.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { picksUntilTeam } from '@/lib/draft';

const order = [1, 2, 3, 4];

test('picksUntilTeam counts picks before the team is next, along the snake', () => {
  assert.equal(picksUntilTeam(order, 0, 1, 20), 0);
  assert.equal(picksUntilTeam(order, 0, 3, 20), 2);
  // Round 1 runs 4,3,2,1, so from pick 4 team 1 is last of the four.
  assert.equal(picksUntilTeam(order, 4, 1, 20), 3);
  // Team 4 picks last of round 0 and first of round 1: from pick 3 it is on the clock, from pick 4 too.
  assert.equal(picksUntilTeam(order, 4, 4, 20), 0);
  assert.equal(picksUntilTeam(order, 1, 4, 20), 2);
});

test('picksUntilTeam is null when the pool runs out first or the team is not in the draft', () => {
  assert.equal(picksUntilTeam(order, 0, 4, 3), null);
  assert.equal(picksUntilTeam(order, 0, 9, 20), null);
  assert.equal(picksUntilTeam([], 0, 1, 20), null);
});
