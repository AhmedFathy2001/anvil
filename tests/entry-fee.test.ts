// Member fee, guest fee, and saying them out loud.
//
// Run: npm run test:entryfee

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { feeLabel, paidEntriesLabel, standardFee } from '../src/lib/entryFeeMath.ts';

const board = { signupFee: 5_000_000, guestSignupFee: 10_000_000 };

test('guests owe the guest fee, members the member fee', () => {
  assert.equal(standardFee(board, false), 5_000_000);
  assert.equal(standardFee(board, true), 10_000_000);
});

test('no guest fee set: guests pay what members pay', () => {
  assert.equal(standardFee({ signupFee: 5_000_000, guestSignupFee: null }, true), 5_000_000);
  assert.equal(standardFee({ signupFee: 5_000_000 }, true), 5_000_000);
});

test('a free-for-members board can still charge guests', () => {
  assert.equal(standardFee({ signupFee: null, guestSignupFee: 2_000_000 }, true), 2_000_000);
  assert.equal(feeLabel({ signupFee: null, guestSignupFee: 2_000_000 }), 'Members free · guests 2,000,000 gp');
});

test('the label names both fees only when they differ', () => {
  assert.equal(feeLabel(board), 'Members 5,000,000 gp · guests 10,000,000 gp');
  assert.equal(feeLabel({ signupFee: 5_000_000, guestSignupFee: 5_000_000 }), '5,000,000 gp');
  assert.equal(feeLabel({ signupFee: null, guestSignupFee: null }), null);
});

test('"× fee" only when every paid entry paid exactly that', () => {
  assert.equal(paidEntriesLabel(3, 15_000_000, 5_000_000), '3 paid entries × 5,000,000 gp');
  // Two members and one guest: 5 + 5 + 10.
  assert.equal(paidEntriesLabel(3, 20_000_000, 5_000_000), '3 paid entries · 20,000,000 gp');
  assert.equal(paidEntriesLabel(1, 2_500_000, 5_000_000), '1 paid entry · 2,500,000 gp');
});
