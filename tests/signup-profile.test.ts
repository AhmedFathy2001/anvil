// What a sign-up may store, and in what shape.
//
// `profileData` is a JSON blob written from a form and read back forever — lib/draftProfiles reads
// it exactly as it was given, so a question edited afterwards must not change what somebody said.
// That makes the sanitiser the only thing standing between a form post and permanent storage, and these
// tests are its contract: known shapes only, bounded on every axis, and an emptied answer absent
// rather than blank.
//
// Run: npx tsx --test tests/signup-profile.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeProfile } from '../src/lib/signup.ts';

// ── The board's own questions ─────────────────────────────────────────────────────────────────

test('answers are kept in the shapes a question can produce', () => {
  // rating → number, text/single → string, multi → string[]. Anything else is not an answer to
  // anything, and this blob is written from a form and read back forever.
  const p = sanitizeProfile({
    answers: { '1': 4, '2': ' hello ', '3': ['a', 'b', 'a'], '4': { nope: true }, '5': null },
  });
  assert.deepEqual(p.answers, { '1': 4, '2': 'hello', '3': ['a', 'b'] });
});

test('a key that is not a question id is not an answer', () => {
  assert.equal(sanitizeProfile({ answers: { notanid: 'x' } }).answers, undefined);
  assert.equal(sanitizeProfile({ answers: 'nonsense' }).answers, undefined);
  assert.equal(sanitizeProfile({ answers: [] }).answers, undefined);
});

test('an emptied answer is absent rather than blank', () => {
  // A blank string and a missing key would otherwise be two ways to say the same nothing.
  assert.equal(sanitizeProfile({ answers: { '1': '   ' } }).answers, undefined);
  assert.equal(sanitizeProfile({ answers: { '1': [] } }).answers, undefined);
});

test('answers are bounded on every axis', () => {
  const many: Record<string, unknown> = {};
  for (let i = 1; i <= 80; i++) many[String(i)] = 'x';
  const kept = sanitizeProfile({ answers: many }).answers!;
  assert.equal(Object.keys(kept).length, 50, 'a form cannot write an unbounded blob');

  const long = sanitizeProfile({ answers: { '1': 'x'.repeat(5000) } }).answers!;
  assert.equal((long['1'] as string).length, 1000);

  const choices = sanitizeProfile({
    answers: { '1': Array.from({ length: 50 }, (_, i) => `opt${i}`) },
  }).answers!;
  assert.equal((choices['1'] as string[]).length, 20);
});
