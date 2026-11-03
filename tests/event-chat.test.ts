import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUSY_PER_WINDOW,
  PERSON_GAP_MS,
  SLOW_GAP_MS,
  SLOW_HOLD_MS,
  checkBody,
  isSlow,
  muteActive,
  newPace,
  recordSend,
  waitFor,
} from '../src/lib/eventChatRules.ts';

test('a message is cleaned and length-checked', () => {
  assert.deepEqual(checkBody('  gz   on the​ pet \n ', { staff: false }), { ok: true, body: 'gz on the pet' });
  assert.equal(checkBody('   ', { staff: false }).ok, false);
  assert.equal(checkBody('x'.repeat(201), { staff: false }).ok, false);
  assert.equal(checkBody('x'.repeat(200), { staff: false }).ok, true);
});

test('links are for staff; gold adverts for nobody', () => {
  assert.equal(checkBody('check out cheapgold.com', { staff: false }).ok, false);
  assert.equal(checkBody('rules: https://anvilosrs.com/c/afk', { staff: true }).ok, true);
  assert.equal(checkBody('selling gold 0.2$ per m', { staff: true }).ok, false);
  assert.equal(checkBody('buy osrs gold fast', { staff: false }).ok, false);
  assert.equal(checkBody('selling my spare whip to a teammate lol', { staff: false }).ok, true, 'ordinary words pass');
  assert.equal(checkBody('gz on the 4.1m fang', { staff: false }).ok, true, 'a price is not a link');
});

test('a person waits between messages; longer in slow mode; staff never', () => {
  assert.equal(waitFor(undefined, 1000, false, false), 0);
  assert.equal(waitFor(1000, 1000 + 500, false, false), PERSON_GAP_MS - 500);
  assert.equal(waitFor(1000, 1000 + PERSON_GAP_MS, false, false), 0);
  assert.equal(waitFor(1000, 1000 + PERSON_GAP_MS, true, false), SLOW_GAP_MS - PERSON_GAP_MS);
  assert.equal(waitFor(1000, 1001, true, true), 0);
});

test('a rush turns slow mode on by itself, and it lifts after the hold', () => {
  const pace = newPace();
  for (let i = 0; i < BUSY_PER_WINDOW; i++) recordSend(pace, 1000 + i);
  assert.equal(isSlow(pace, 2000), false, 'at the limit, still normal');
  recordSend(pace, 2000);
  assert.equal(isSlow(pace, 2001), true);
  assert.equal(isSlow(pace, 2000 + SLOW_HOLD_MS + 1), false);
  assert.equal(isSlow(newPace(), 0, true), true, 'the host can hold it on');
});

test('a quiet board forgets old sends', () => {
  const pace = newPace();
  recordSend(pace, 0);
  recordSend(pace, 60_000);
  assert.equal(pace.sends.length, 1);
});

test('mutes: none-until is the rest of the event', () => {
  const parse = (s: string) => Date.parse(s.replace(' ', 'T') + 'Z');
  assert.equal(muteActive(null, 0, parse), true);
  assert.equal(muteActive('2026-11-04 10:00:00', parse('2026-11-04 09:00:00'), parse), true);
  assert.equal(muteActive('2026-11-04 10:00:00', parse('2026-11-04 11:00:00'), parse), false);
});
