import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUSY_PER_WINDOW,
  PERSON_GAP_MS,
  SLOW_GAP_MS,
  SLOW_HOLD_MS,
  checkBody,
  chatPaceHint,
  cleanName,
  isSlow,
  muteActive,
  newPace,
  personGapMs,
  recordSend,
  waitFor,
} from '../src/lib/eventChatRules.ts';

test('a message is cleaned and length-checked', () => {
  assert.deepEqual(checkBody('  gz   on the​ pet \n ', { staff: false }), { ok: true, body: 'gz on the pet' });
  assert.equal(checkBody('   ', { staff: false }).ok, false);
  assert.equal(checkBody('ab'.repeat(101), { staff: false }).ok, false);
  assert.equal(checkBody('ab'.repeat(100), { staff: false }).ok, true);
});

test('markup, zalgo, styled letters and long runs are cleaned', () => {
  const clean = (t: string) => {
    const r = checkBody(t, { staff: false });
    return r.ok ? r.body : `!${r.reason}`;
  };
  assert.equal(clean('<col=ff0000>red</col> <img=1>hi'), 'red hi', 'game tags dropped');
  assert.equal(clean('<html><b>bold</b>'), 'bold');
  assert.equal(clean('2 < 3 and 5 > 4'), '2 < 3 and 5 > 4', 'a lone < or > is ordinary text');
  assert.equal(clean('z\u0301\u0302\u0303\u0304\u0305algo'), 'z\u0301\u0302algo'.normalize('NFKC'), 'two marks kept, the stack dropped');
  assert.equal(clean('ｆｒｅｅ ｇｐ'), 'free gp', 'full-width letters fold');
  assert.equal(clean('noooooooooooooo'), 'nooooooo'.slice(0, 7), 'a run is kept to six');
  assert.match(clean('ＣＨＥＡＰ ＧＯＬＤ'), /^!/, 'styled letters can’t dodge the gold filter');
  assert.match(clean('<col=ff0000></col>'), /^!/, 'nothing left after cleaning is refused');
  assert.equal(clean('<co<b>l=ff0000>red'), 'red', 'a tag hidden inside a tag is gone too');
  assert.equal(clean('<col=' + 'f'.repeat(80) + '>x'), 'x', 'however long the tag');
  assert.equal(
    clean('z\u0301\u0302\u200b\u0303\u0304\u200b\u0305\u0306'),
    'z\u0301\u0302'.normalize('NFC'),
    'an invisible character can’t split a stack past the cap',
  );
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

test('a sender’s name is cleaned like a line, and kept short', () => {
  assert.equal(cleanName('<col=ff0000>Kev</col>'), 'Kev');
  assert.equal(cleanName('Ｋｅｖ\u200b'), 'Kev');
  assert.equal(cleanName('ab'.repeat(30)).length, 32);
  assert.equal(cleanName('<b></b>'), 'Player', 'nothing left is a placeholder, not blank');
  assert.equal(cleanName(null), 'Player');
});

test('each person waits by their Supporter tier: 5s, 3s, 1s, Patron none; slow mode holds everyone', () => {
  assert.equal(personGapMs(null), 5_000);
  assert.equal(personGapMs('supporter'), 3_000);
  assert.equal(personGapMs('champion'), 1_000);
  assert.equal(personGapMs('patron'), 0);
  const t = 100_000;
  assert.equal(waitFor(t, t + 2_000, false, false, personGapMs(null)), 3_000);
  assert.equal(waitFor(t, t + 2_000, false, false, personGapMs('supporter')), 1_000);
  assert.equal(waitFor(t, t + 2_000, false, false, personGapMs('champion')), 0);
  assert.equal(waitFor(t, t, false, false, personGapMs('patron')), 0);
  // A busy board's slow mode applies to Patrons too; staff never wait.
  assert.equal(waitFor(t, t + 1_000, true, false, personGapMs('patron')), SLOW_GAP_MS - 1_000);
  assert.equal(waitFor(t, t, true, true, personGapMs(null)), 0);
});

test('the message box says what the wait is', () => {
  assert.equal(chatPaceHint({ tier: null, slow: false, staff: false }), 'slow mode 5s · Supporters chat faster');
  assert.equal(chatPaceHint({ tier: 'champion', slow: false, staff: false }), 'slow mode 1s');
  assert.equal(chatPaceHint({ tier: 'patron', slow: false, staff: false }), 'no slow mode (Patron)');
  assert.equal(chatPaceHint({ tier: 'patron', slow: true, staff: false }), 'slow mode 10s (busy chat)');
  assert.equal(chatPaceHint({ tier: null, slow: true, staff: true }), 'no slow mode for staff');
});
