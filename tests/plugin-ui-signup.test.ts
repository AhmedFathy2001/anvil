// The side panel's sign-up pieces (lib/pluginUi/signupPanelUi): what each state draws.
//
// Run: npx tsx --test tests/plugin-ui-signup.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bingoSignupCard, weeklyEntryRow, type BingoSignupState } from '../src/lib/pluginUi/signupPanelUi.ts';

const base: BingoSignupState = { open: true, reason: null, status: null, canWithdraw: false, canSign: true, noSeat: false, names: null, count: 0 };
const json = (n: unknown) => JSON.stringify(n);

test('open and not in: a Sign up button that loads the form', () => {
  const s = json(bingoSignupCard(base, 7, 'event:7', 'Winter bingo', 'iron'));
  assert.match(s, /"label":"Sign up"/);
  assert.match(s, /"v":"event-signup"/);
  assert.match(s, /"event":"7"/);
});

test('signed up: edit and withdraw while it is still theirs to take back', () => {
  const s = json(bingoSignupCard({ ...base, status: 'pending', canWithdraw: true }, 7, 'event:7', 'W', 'iron'));
  assert.match(s, /Edit answers/);
  assert.match(s, /"act":"event-withdraw"/);
  const locked = json(bingoSignupCard({ ...base, open: false, status: 'approved', canWithdraw: false }, 7, 'event:7', 'W', 'iron'));
  assert.doesNotMatch(locked, /event-withdraw|Edit answers/);
});

test('the public list shows names only when the host turned it on', () => {
  assert.doesNotMatch(json(bingoSignupCard(base, 7, 'event:7', 'W', 'iron')), /Signed up ·/);
  const s = json(bingoSignupCard({ ...base, names: ['Zezima', 'Lynx Titan'], count: 2 }, 7, 'event:7', 'W', 'iron'));
  assert.match(s, /Signed up \(2\)/);
  assert.match(s, /Zezima, Lynx Titan/);
});

test('a weekly: opt out before it starts, opt back in after', () => {
  const out = json(weeklyEntryRow({ entered: true, optedOut: false }, 3, true));
  assert.match(out, /"act":"weekly-opt"/);
  assert.match(out, /"out":"1"/);
  assert.match(json(weeklyEntryRow({ entered: true, optedOut: true }, 3, false)), /Opt back in/);
});
