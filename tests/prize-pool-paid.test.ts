// The prize pot counts money in, not money owed.
//
// Run: npm run test:paidpot

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePrizePool } from '../src/lib/prizePoolMath.ts';

test('paid fees replace fee × entries when given', () => {
  // 10 approved at 5m, but only 6 paid: the pot is 30m of fees, not 50m.
  assert.equal(computePrizePool({ addedPrizePool: 20_000_000, signupFee: 5_000_000, approvedCount: 10, paidFeesGp: 30_000_000 }), 50_000_000);
});

test('no one paid yet means no fees in the pot, whatever the headcount', () => {
  assert.equal(computePrizePool({ addedPrizePool: 0, signupFee: 5_000_000, approvedCount: 10, paidFeesGp: 0, cofferFunded: 7 }), 7);
});

test('callers that pass no paid figure keep the old arithmetic', () => {
  assert.equal(computePrizePool({ addedPrizePool: 1, signupFee: 2, approvedCount: 3 }), 7);
});
