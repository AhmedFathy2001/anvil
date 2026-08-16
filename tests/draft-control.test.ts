import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateOrderSoNextIs, spreadPct, strengthOf } from '../src/lib/draftMath.ts';
import { getTeamForPick } from '../src/lib/draft.ts';

// The rotation is the load-bearing bit: "resume from this team" edits the ORDER rather than the
// pick count, so every case below checks the same property — after rotating, the serpentine helper
// the pick route uses agrees that the chosen team is on the clock.

const ORDER = [10, 20, 30, 40];

test('resuming from a team puts them on the clock, forward rounds', () => {
  for (let pick = 0; pick < 4; pick++) {
    for (const team of ORDER) {
      const rotated = rotateOrderSoNextIs(ORDER, pick, team);
      assert.equal(getTeamForPick(rotated, pick), team, `pick ${pick} → team ${team}`);
    }
  }
});

test('resuming from a team works in reversed rounds too', () => {
  // Round 1 (picks 4-7) reads the order backwards; a rotation that ignored that would be off by
  // however far the pick sits into the round.
  for (let pick = 4; pick < 8; pick++) {
    for (const team of ORDER) {
      const rotated = rotateOrderSoNextIs(ORDER, pick, team);
      assert.equal(getTeamForPick(rotated, pick), team, `pick ${pick} → team ${team}`);
    }
  }
});

test('rotation keeps every team exactly once, in the same cycle', () => {
  const rotated = rotateOrderSoNextIs(ORDER, 5, 30);
  assert.deepEqual([...rotated].sort((a, b) => a - b), [...ORDER].sort((a, b) => a - b));
  // A rotation preserves relative sequence: each team's successor is unchanged (mod the wrap).
  for (let i = 0; i < ORDER.length; i++) {
    const a = rotated[i];
    const b = rotated[(i + 1) % ORDER.length];
    const ia = ORDER.indexOf(a);
    assert.equal(ORDER[(ia + 1) % ORDER.length], b);
  }
});

test('rotation is a no-op when the team is already up, and safe on nonsense', () => {
  const up = getTeamForPick(ORDER, 6);
  assert.deepEqual(rotateOrderSoNextIs(ORDER, 6, up), ORDER);
  assert.deepEqual(rotateOrderSoNextIs(ORDER, 2, 999), ORDER, 'unknown team leaves the order alone');
  assert.deepEqual(rotateOrderSoNextIs([], 0, 10), [], 'empty order is not a crash');
});

test('strength sharpens ratings rather than summing them flat', () => {
  // One strong player must beat two mediocre ones whose linear sum matches — that is the whole
  // point of the exponent, and the reason two implementations of it would disagree visibly.
  const one = strengthOf([0.9]);
  const two = strengthOf([0.45, 0.45]);
  assert.ok(one > two, `${one} should beat ${two}`);
  assert.equal(strengthOf([]), 0);
});

test('spread is the gap between best and worst, not the variance', () => {
  assert.equal(spreadPct([10, 10, 10]), 0);
  assert.equal(spreadPct([10, 5]), 50);
  assert.equal(spreadPct([4, 3, 2, 1]), 75);
  assert.equal(spreadPct([0, 0]), 0, 'nobody drafted yet is even, not divide-by-zero');
  assert.equal(spreadPct([7]), 0, 'a single team has nothing to be uneven against');
});
