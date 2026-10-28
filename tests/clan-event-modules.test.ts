// Clan event modules, pure (lib/clanEventModules, lib/clanEventTimes): the settings a host saves,
// which key a week files under, when sign-ups and the survey are open, and what the pot is.
//
// Run: npx tsx --test tests/clan-event-modules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SERIES, keyFor, parseModules, potGp, recentKeys, signupWindow, surveyKey, validKey } from '../src/lib/clanEventModules';
import { type ClanEventTiming, occurrenceAt, pastOccurrences } from '../src/lib/clanEventTimes';

const timing = (over: Partial<ClanEventTiming> = {}): ClanEventTiming => ({
  startsAt: '2026-10-20T19:00:00.000Z', // Tuesday 20:00 London (BST ends 25 Oct)
  durationMin: 90,
  repeat: 'weekly',
  repeatUntil: null,
  timezone: 'Europe/London',
  cancelledAt: null,
  ...over,
});
const at = (iso: string) => Date.parse(iso);

test('settings are made whole: junk is off, a fee needs sign-ups, money is clamped', () => {
  assert.deepEqual(parseModules(null), parseModules({}));
  const m = parseModules({ signups: { on: true, cap: '12', approval: true, closes: 'end' }, fee: { on: true, amount: '1500000.4' }, payouts: { on: true, addedGp: -5 }, survey: { on: 'yes' }, scope: 'series' });
  assert.deepEqual(m, {
    scope: 'series',
    signups: { on: true, cap: 12, approval: true, closes: 'end' },
    fee: { on: true, amount: 1_500_000 },
    payouts: { on: true, addedGp: 0 },
    survey: { on: false },
  });
  assert.equal(parseModules({ fee: { on: true, amount: 100 } }).fee.on, false, 'no sign-ups, nothing to charge');
  assert.equal(parseModules({ signups: { on: true }, fee: { on: true, amount: 0 } }).fee.on, false, 'a free fee is no fee');
  assert.equal(parseModules({ signups: { on: true, cap: 0 } }).signups.cap, null, 'zero places is no limit, not a closed door');
});

test('a week files under its own start; a series under one key; a one-off is its start either way', () => {
  const o = { start: '2026-10-27T20:00:00.000Z', end: '2026-10-27T21:30:00.000Z' };
  assert.equal(keyFor(parseModules({}), timing(), o), o.start);
  assert.equal(keyFor(parseModules({ scope: 'series' }), timing(), o), SERIES);
  assert.equal(keyFor(parseModules({ scope: 'series' }), timing({ repeat: 'none' }), o), o.start);
  assert.ok(validKey(parseModules({}), timing(), '2026-10-27T20:00:00.000Z'), 'the week after the clocks went back');
  assert.ok(!validKey(parseModules({}), timing(), '2026-10-27T19:00:00.000Z'), 'not a real start');
  assert.ok(!validKey(parseModules({}), timing(), SERIES));
  assert.ok(validKey(parseModules({ scope: 'series' }), timing(), SERIES));
});

test('sign-ups close at the start by default, or at the end; a series closes after its first week', () => {
  const m = parseModules({ signups: { on: true } });
  const e = timing();
  const before = signupWindow(m, e, at('2026-10-27T12:00:00Z'));
  assert.ok(before.open && before.key === '2026-10-27T20:00:00.000Z');
  assert.equal(signupWindow(m, e, at('2026-10-27T20:30:00Z')).open, false, 'it started');
  assert.ok(signupWindow(parseModules({ signups: { on: true, closes: 'end' } }), e, at('2026-10-27T20:30:00Z')).open, 'still on');
  const series = parseModules({ scope: 'series', signups: { on: true } });
  assert.ok(signupWindow(series, e, at('2026-10-20T10:00:00Z')).open);
  assert.equal(signupWindow(series, e, at('2026-10-21T10:00:00Z')).open, false, 'the league started — its roster is set');
  assert.equal(signupWindow(parseModules({}), e, at('2026-10-21T10:00:00Z')).open, false, 'off is closed');
});

test('past weeks, newest first; a one-off has one once it ends', () => {
  const past = pastOccurrences(timing(), at('2026-11-04T12:00:00Z'), 3);
  assert.deepEqual(past.map((o) => o.start), ['2026-11-03T20:00:00.000Z', '2026-10-27T20:00:00.000Z', '2026-10-20T19:00:00.000Z']);
  assert.deepEqual(pastOccurrences(timing(), at('2026-10-20T20:00:00Z')), [], 'the first is still on');
  assert.equal(pastOccurrences(timing({ repeat: 'none' }), at('2026-10-21T00:00:00Z')).length, 1);
  assert.equal(pastOccurrences(timing({ repeatUntil: '2026-10-28T00:00:00.000Z' }), at('2026-12-01T00:00:00Z')).length, 2, 'stops at its last day');
  assert.equal(occurrenceAt(timing(), '2026-11-03T20:00:00.000Z')?.end, '2026-11-03T21:30:00.000Z');
});

test('staff look at the next week and the recent ones; the survey asks about the one that just ended', () => {
  const m = parseModules({ survey: { on: true }, payouts: { on: true } });
  const keys = recentKeys(m, timing(), at('2026-11-04T12:00:00Z'));
  assert.deepEqual(keys.slice(0, 3).map((k) => [k.label, k.key]), [
    ['next', '2026-11-10T20:00:00.000Z'],
    ['past', '2026-11-03T20:00:00.000Z'],
    ['past', '2026-10-27T20:00:00.000Z'],
  ]);
  assert.equal(surveyKey(m, timing(), at('2026-11-04T12:00:00Z')), '2026-11-03T20:00:00.000Z');
  assert.equal(surveyKey(m, timing(), at('2026-10-20T12:00:00Z')), null, 'nothing has ended yet');
  assert.equal(surveyKey(parseModules({ survey: { on: true }, scope: 'series' }), timing(), at('2026-11-04T12:00:00Z')), SERIES);
  assert.equal(surveyKey(parseModules({}), timing(), at('2026-11-04T12:00:00Z')), null, 'no survey');
});

test('the pot is the added gp plus the fees actually collected', () => {
  assert.equal(potGp(parseModules({ payouts: { on: true, addedGp: 5_000_000 } }), 3_000_000), 8_000_000);
  assert.equal(potGp(parseModules({ payouts: { on: false, addedGp: 5_000_000 } }), 3_000_000), 3_000_000);
});
