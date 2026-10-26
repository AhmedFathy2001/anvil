import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseProofClaims,
  gameLines,
  captureFlag,
  stampModel,
  CAPTURED_BEFORE_START_FLAG,
  CLOCK_AHEAD_FLAG,
} from '../src/lib/proofStamp';

const base = {
  title: 'BINGO DROP',
  detail: 'Infernal cape ×1 (4/5)',
  tz: 'Africa/Cairo',
  capturedAt: Date.UTC(2026, 9, 25, 20, 15, 2),
  tick: 1000,
  split: 0.5,
};

test('an older plugin (no proof object) gets no claims', () => {
  assert.equal(parseProofClaims(undefined), null);
  assert.equal(parseProofClaims('x'), null);
  assert.equal(parseProofClaims([]), null);
});

test('claims are clamped: bad zone dropped, split bounded, junk chat skipped', () => {
  const c = parseProofClaims({ ...base, tz: 'Mars/Olympus', split: 3, chat: [null, { tick: 'a', text: 'x' }, { tick: 1, type: 'SPAM', text: '' }] })!;
  assert.equal(c.tz, null);
  assert.equal(c.split, null);
  assert.deepEqual(c.chat, []);
  assert.equal(parseProofClaims({})!.title, 'BINGO PROOF');
});

test('only game-only types with Jagex wording near the credit make the stamp', () => {
  const c = parseProofClaims({
    ...base,
    chat: [
      { tick: 998, type: 'GAMEMESSAGE', text: '<col=ef1020>Valuable drop: Infernal cape (1 coins)</col>' },
      { tick: 998, type: 'GAMEMESSAGE', text: 'Your TzKal-Zuk kill count is: <col=ff0000>4</col>.' },
      // Typed by a player: never trusted, however it reads.
      { tick: 999, type: 'PUBLICCHAT', text: 'Valuable drop: Twisted bow (1 coins)' },
      { tick: 999, type: 'CLAN_CHAT', text: 'Your Zulrah kill count is: 999' },
      // Our own (and any plugin's) chat output.
      { tick: 999, type: 'GAMEMESSAGE', text: '<col=ffd700>[Anvil]</col> Uploading proof: Infernal cape...' },
      // Real game line, nothing to do with a proof.
      { tick: 999, type: 'GAMEMESSAGE', text: 'You eat the shark.' },
      // Too long before the credit.
      { tick: 900, type: 'GAMEMESSAGE', text: 'Valuable drop: Onyx (1 coins)' },
    ],
  })!;
  assert.deepEqual(gameLines(c), [
    { offset: -2, text: 'Valuable drop: Infernal cape (1 coins)' },
    { offset: -2, text: 'Your TzKal-Zuk kill count is: 4.' },
  ]);
});

test('capture flags: future clock and pre-event capture, never an old retry', () => {
  const c = parseProofClaims(base)!;
  const received = base.capturedAt + 5_000;
  assert.equal(captureFlag(c, received, base.capturedAt - 86_400_000), null);
  // Retried a day later after an outage: normal.
  assert.equal(captureFlag(c, received + 86_400_000, base.capturedAt - 86_400_000), null);
  assert.equal(captureFlag(c, base.capturedAt - 10 * 60_000, null), CLOCK_AHEAD_FLAG);
  assert.equal(captureFlag(c, received, base.capturedAt + 60 * 60_000), CAPTURED_BEFORE_START_FLAG);
});

test('stamp text: UTC + local with the captured timezone, server received time and id', () => {
  const c = parseProofClaims(base)!;
  const m = stampModel({
    claims: c, rsn: 'O Prayer', team: 'The AFK Spot', event: 'AFK vs LFL',
    receivedAt: base.capturedAt + 3_000, submissionId: 48213, sha256: 'abcdef0123456789ff',
  });
  assert.deepEqual(m.meta, [
    'RSN: O Prayer',
    'Team: The AFK Spot',
    'Event: AFK vs LFL',
    'Captured: 2026-10-25 20:15:02 UTC',
    'Local: 2026-10-25 23:15:02 (Africa/Cairo, UTC+3) · captured timezone',
    'Received: 2026-10-25 20:15:05 UTC (+3s)',
  ]);
  assert.equal(m.footer, 'Proof #48213 · sha256 abcdef012345 · stamped by Anvil');
});
