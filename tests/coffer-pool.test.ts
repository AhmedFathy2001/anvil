// A prize pool taken out of the clan coffer for one board.
//
// The arithmetic half only: what a pool does to the balance, and what it adds to an event's pot.
// Both are pure, and both are the numbers a treasurer reads before deciding they can afford it.
//
// Run: npm run test:cofferpool

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countsTowardBalance, foldBalance } from '../src/lib/cofferMath.ts';
import { computePrizePool } from '../src/lib/prizePoolMath.ts';

test('a reserved pool is committed money — it leaves the available balance at once', () => {
  const balance = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'reserved', total: -400_000_000 },
  ]);
  assert.equal(balance.confirmed, 1_000_000_000);
  assert.equal(balance.reserved, 400_000_000);
  // The point of committing it: a second board cannot promise the same 400m.
  assert.equal(balance.available, 600_000_000);
});

test('a cancelled pool gives the gp straight back', () => {
  const balance = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'cancelled', total: -400_000_000 },
  ]);
  assert.equal(balance.available, 1_000_000_000);
  assert.equal(countsTowardBalance({ kind: 'pool', status: 'cancelled' }), false);
});

test('paying a pool out does not free the gp a second time', () => {
  const paid = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'paid', total: -400_000_000 },
  ]);
  assert.equal(paid.available, 600_000_000);
});

test('a pool sits beside the fees and the bonus in the board\'s pot', () => {
  const total = computePrizePool({
    addedPrizePool: 100_000_000,
    cofferFunded: 500_000_000,
    signupFee: 10_000_000,
    approvedCount: 8,
  });
  assert.equal(total, 680_000_000);
});

test('an event with no coffer pool computes exactly as it did before', () => {
  const opts = { addedPrizePool: 50_000_000, signupFee: 5_000_000, approvedCount: 4 };
  assert.equal(computePrizePool(opts), computePrizePool({ ...opts, cofferFunded: 0 }));
  assert.equal(computePrizePool({ ...opts, cofferFunded: null }), 70_000_000);
});

// ── Holding, or merely promising ────────────────────────────────────────────────────────────────
//
// A pool is a promise about gp that has not moved yet. Held, it leaves the available balance at
// once so nothing else can promise it; planned, it is on the ledger and advertised on the event
// while the coffer stays spendable. The whole point is that those are different facts.

test('a planned pool promises without holding — the coffer stays spendable', () => {
  const balance = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'planned', total: -400_000_000 },
  ]);
  assert.equal(balance.reserved, 0);
  assert.equal(balance.available, 1_000_000_000);
  assert.equal(countsTowardBalance({ kind: 'pool', status: 'planned' }), false);
});

test('holding the same pool takes it out of what can be promised again', () => {
  const planned = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'planned', total: -400_000_000 },
  ]);
  const held = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000_000 },
    { kind: 'pool', status: 'reserved', total: -400_000_000 },
  ]);
  assert.equal(planned.available - held.available, 400_000_000);
});
