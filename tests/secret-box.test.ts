// Encryption at rest for stored secrets (per-clan bot tokens, webhook URLs).
//
// Run: node --experimental-strip-types --test tests/secret-box.test.ts
// (lib/secretBox imports nothing from `@/`, so Node's native TS type-stripping runs it directly with
//  no bundler, DB, or Next runtime.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encryptSecret, decryptSecret, SecretBoxError } from '../src/lib/secretBox.ts';

test('encryptSecret/decryptSecret round-trip; ciphertext is opaque; tamper throws', () => {
  const key = 'server-side-encryption-key';
  const token = 'B-token-super-secret-value';
  const enc = encryptSecret(token, key);
  assert.notEqual(enc, token); // not stored in the clear
  assert.ok(enc.startsWith('enc1:'));
  assert.equal(decryptSecret(enc, key), token); // round-trips
  // Wrong key / tampered ciphertext → GCM auth failure throws (never returns garbage).
  assert.throws(() => decryptSecret(enc, 'different-key'));
  assert.throws(() => decryptSecret(enc.slice(0, -4) + 'AAAA', key));
});

test('the same plaintext encrypts differently every time (random IV)', () => {
  const key = 'server-side-encryption-key';
  const a = encryptSecret('same-value', key);
  const b = encryptSecret('same-value', key);
  assert.notEqual(a, b); // no deterministic ciphertext to correlate across rows
  assert.equal(decryptSecret(a, key), decryptSecret(b, key));
});

// This is the deliberate behaviour change from the federation original, which returned unprefixed
// input as legacy plaintext. There is no legacy data here, and the passthrough would let anyone who
// can write the row downgrade a secret to plaintext and have it honoured.
test('unencrypted input is rejected, not passed through', () => {
  const key = 'server-side-encryption-key';
  assert.throws(() => decryptSecret('plain-token', key), SecretBoxError);
  assert.throws(() => decryptSecret('', key), SecretBoxError);
  // Right prefix, wrong shape → still an error, never a silent partial read.
  assert.throws(() => decryptSecret('enc1:only-one-part', key), SecretBoxError);
  assert.throws(() => decryptSecret('enc1:aa:bb', key), SecretBoxError);
});

test('round-trips values the callers actually store', () => {
  const key = 'k';
  for (const v of [
    'https://discord.com/api/webhooks/123/abc-DEF_456',
    'MTIzNDU2Nzg5.GaBcDe.f4k3-t0k3n_value',
    'unicode: ✅ 中文 emoji 🎣',
    'x'.repeat(4096),
  ]) {
    assert.equal(decryptSecret(encryptSecret(v, key), key), v);
  }
});
