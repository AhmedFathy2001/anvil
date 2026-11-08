// Pure tests for credit-first-proof-after (lib/proofAfter): keys, the window, the stored stamp facts.
// No database. Run: npx tsx --test tests/proof-after.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  claimsWithSplit,
  decodePendingProof,
  encodePendingProof,
  attachedKeyMark,
  newProofKey,
  publicSubmission,
  stampOnlyClaims,
  parseProofKey,
  PROOF_WINDOW_MS,
  proofDueAt,
  proofOverdue,
} from '@/lib/proofAfter';
import { parseProofClaims } from '@/lib/proofStamp';

test('newProofKey: url-safe, unguessable length, never repeats, and reads back', () => {
  const keys = new Set(Array.from({ length: 200 }, () => newProofKey()));
  assert.equal(keys.size, 200);
  for (const k of keys) {
    assert.match(k, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(parseProofKey(k), k);
  }
});

test('parseProofKey: anything but a plain token of sane length is no key', () => {
  for (const bad of [null, undefined, 42, '', 'short', 'x'.repeat(65), "abc'; drop table--xxxxxx", 'a b c d e f g h i j', ['k'.repeat(24)]]) {
    assert.equal(parseProofKey(bad), null, String(bad));
  }
});

test('proofDueAt / proofOverdue: a minute after filing, inclusive; a row with no due time never waited', () => {
  const filed = Date.parse('2026-11-08T12:00:00.000Z');
  const due = proofDueAt(filed);
  assert.equal(due, '2026-11-08T12:01:00.000Z');
  assert.equal(PROOF_WINDOW_MS, 60_000);
  assert.equal(proofOverdue(due, filed + 59_999), false);
  assert.equal(proofOverdue(due, filed + 60_000), true);
  assert.equal(proofOverdue(null, filed + 10 * 60_000), false);
  assert.equal(proofOverdue('garbage', filed + 10 * 60_000), false);
});

test('pending proof JSON: round-trips, and anything malformed decodes to safe defaults', () => {
  const claims = parseProofClaims({ title: 'BINGO DROP', detail: 'Twisted bow', tz: 'UTC', capturedAt: 5, tick: 9, chat: [{ tick: 9, type: 'GAMEMESSAGE', text: 'Valuable drop: Twisted bow (1,000,000,000 coins)' }] });
  const p = { claims, receivedAt: 123, completed: true, superseded: false, cap: false, rsn: 'Zezima', clan: 'alpha' };
  assert.deepEqual(decodePendingProof(encodePendingProof(p)), p);

  const junk = decodePendingProof('{not json');
  assert.equal(junk.claims, null);
  assert.equal(junk.completed, false);
  assert.equal(junk.clan, null);
  assert.equal(typeof junk.receivedAt, 'number');
  assert.equal(decodePendingProof(JSON.stringify({ clan: '../evil', rsn: 'x'.repeat(40) })).clan, null);
  assert.equal(decodePendingProof(JSON.stringify({ rsn: 'x'.repeat(40) })).rsn?.length, 12);
});

test('claimsWithSplit: only the frame split comes from the upload; the banner stays as filed', () => {
  const claims = parseProofClaims({ title: 'BINGO DROP', detail: 'Twisted bow' })!;
  assert.equal(claimsWithSplit(claims, { split: 0.5, title: 'FORGED', detail: 'x' })!.split, 0.5);
  assert.equal(claimsWithSplit(claims, { split: 0.5, title: 'FORGED' })!.title, 'BINGO DROP');
  assert.equal(claimsWithSplit(claims, { split: 2 })!.split, null, 'an absurd split is ignored');
  assert.equal(claimsWithSplit(claims, null), claims);
  assert.equal(claimsWithSplit(null, { split: 0.5 }), null, 'no claims, no stamp');
});

test('stampOnlyClaims: only game lines the stamp prints survive; typed chat is dropped', () => {
  const claims = parseProofClaims({ tick: 100, chat: [
    { tick: 100, type: 'GAMEMESSAGE', text: 'Valuable drop: Abyssal whip (1,500,000 coins)' },
    { tick: 100, type: 'PUBLICCHAT', text: 'Valuable drop: fake' },
    { tick: 100, type: 'PRIVATECHATIN', text: 'my address is' },
  ] })!;
  assert.deepEqual(stampOnlyClaims(claims).chat.map((c) => c.type), ['GAMEMESSAGE']);
  assert.deepEqual(decodePendingProof(encodePendingProof({ claims, receivedAt: 1, completed: false, superseded: false, cap: false, rsn: null, clan: null })).claims!.chat.length, 1);
});

test('attachedKeyMark / publicSubmission: the tombstone is not the key; rows lose the bookkeeping', () => {
  const k = newProofKey();
  assert.notEqual(attachedKeyMark(k), k);
  assert.equal(attachedKeyMark(k), attachedKeyMark(k));
  assert.equal(parseProofKey(attachedKeyMark(k)), null, 'a tombstone is never accepted as a key');
  assert.deepEqual(publicSubmission({ id: 1, proofKey: k, proofPending: '{}', imageUrl: null }), { id: 1, imageUrl: null });
});
