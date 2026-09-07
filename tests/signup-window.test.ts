// When a board takes entries.
//
// Pinned because the rule is read in six places — the form, the apex home's "Taking entries", the
// team pages, the invite link, the locker and a slash command — and they only agree while they all
// ask this one function. The case that got away was the emptiest one: a board with no dates at all.
//
// Run: npm run test:signupwindow

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signupWindowState, signupEditState } from '../src/lib/signup.ts';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const agoDays = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const event = (over: Partial<Parameters<typeof signupWindowState>[0]> = {}) => ({
  signupOpensAt: null,
  signupDeadline: null,
  startDate: inDays(7),
  ...over,
});

test('a scheduled board with no other limits is open', () => {
  assert.deepEqual(signupWindowState(event()), { open: true, reason: null });
});

test('a board with NO start date is a draft, and a draft takes no entries', () => {
  // The bug this suite exists for: a null start used to mean "nothing has closed it", so an
  // unfinished board was advertised across every clan and would accept the sign-up.
  assert.deepEqual(signupWindowState(event({ startDate: null })), {
    open: false,
    reason: 'not_open_yet',
  });
});

test('a draft stays shut however its other dates are set', () => {
  for (const over of [
    { signupOpensAt: agoDays(1) },
    { signupDeadline: inDays(30) },
    { signupOpensAt: agoDays(1), signupDeadline: inDays(30) },
  ]) {
    assert.equal(signupWindowState(event({ startDate: null, ...over })).open, false);
  }
});

test('a board that has started is closed, and says which', () => {
  assert.deepEqual(signupWindowState(event({ startDate: agoDays(1) })), {
    open: false,
    reason: 'event_started',
  });
});

test('the deadline closes it before the start does', () => {
  assert.deepEqual(signupWindowState(event({ signupDeadline: agoDays(1) })), {
    open: false,
    reason: 'closed',
  });
});

test('a window that has not opened yet reads as not open, not as closed', () => {
  assert.deepEqual(signupWindowState(event({ signupOpensAt: inDays(2) })), {
    open: false,
    reason: 'not_open_yet',
  });
});

test('editing follows the same rule, and a payment deadline extends it', () => {
  // A draft is not editable either — there is nothing to have signed up to.
  assert.equal(signupEditState({ ...event({ startDate: null }), paymentDeadline: inDays(3) }).open, false);
  // But a started board with a payment deadline still lets an existing entry be edited.
  assert.equal(
    signupEditState({ ...event({ startDate: agoDays(1) }), paymentDeadline: inDays(3) }).open,
    true,
  );
});
