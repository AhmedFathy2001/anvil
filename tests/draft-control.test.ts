import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateOrderSoNextIs, spreadCapVerdict, spreadPct, strengthOf } from '../src/lib/draftMath.ts';
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

// ── Spread cap ────────────────────────────────────────────────────────────────────────────────
// Every case below is a bug that actually happened while building this.

const CAP = 10;
const cap = (rosters: [number, number[]][], pickingTeamId: number, candidate: number, pool: number[]) =>
  spreadCapVerdict({
    rosters: new Map(rosters),
    pickingTeamId,
    candidateRating: candidate,
    poolRatings: pool,
    capPct: CAP,
  });

test('the first pick of a draft is never unbalanced', () => {
  // Against a field of empty rosters, any pick looks infinitely far above the mean.
  assert.equal(cap([[1, []], [2, []], [3, []]], 1, 0.9, [0.9, 0.5]).allowed, true);
});

test('picking first in a round is not imbalance', () => {
  // The regression that comparing roster TOTALS causes: one extra player always reads as a lead.
  // Per-pick average sees two equal teams, which is what they are.
  assert.equal(cap([[1, [0.5]], [2, [0.5]]], 1, 0.5, [0.5, 0.4]).allowed, true);
});

test('the leader is blocked from extending the lead while a legal pick exists', () => {
  const verdict = cap([[1, [0.5]], [2, [0.45]]], 1, 0.9, [0.9, 0.05]);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.allowed === false && verdict.kind, 'over-cap');
});

test('a team already past the cap must take from the bottom, not roam free', () => {
  // With a pure threshold every pick breached, so the rule switched itself off for the runaway
  // team — the one it exists to bind.
  const runaway: [number, number[]][] = [[1, [0.95, 0.9]], [2, [0.05]]];
  const pool = [0.9, 0.5, 0.02];
  const best = cap(runaway, 1, 0.9, pool);
  assert.equal(best.allowed, false);
  assert.equal(best.allowed === false && best.kind, 'must-take-lowest');
  // The weakest remaining is always allowed, so a draft can never stall.
  assert.equal(cap(runaway, 1, 0.02, pool).allowed, true);
});

test('the trailing team is never blocked', () => {
  // There is no "fewest picks" exemption — it made the cap a no-op in a snake draft. The trailing
  // team is unblocked because the arithmetic says so, which is the honest reason.
  assert.equal(cap([[1, [0.95, 0.9]], [2, [0.05]]], 2, 0.9, [0.9, 0.05]).allowed, true);
});

test('a cap needs at least two teams and someone left to pick', () => {
  assert.equal(cap([[1, [0.5]]], 1, 0.9, [0.9]).allowed, true);
  assert.equal(cap([[1, [0.5]], [2, [0.1]]], 1, 0.9, []).allowed, true);
});
