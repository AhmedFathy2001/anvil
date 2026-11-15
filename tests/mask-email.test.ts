import { test } from 'node:test';
import assert from 'node:assert/strict';

import { maskEmail } from '../src/lib/maskEmail.ts';

test('keeps the domain and the first letter only', () => {
  assert.equal(maskEmail('ahmed@example.com'), 'a***@example.com');
  assert.equal(maskEmail('  Bob.Smith+osrs@mail.co.uk '), 'B***@mail.co.uk');
});

test('empty and malformed values never leak', () => {
  assert.equal(maskEmail(null), null);
  assert.equal(maskEmail(''), null);
  assert.equal(maskEmail('not-an-email'), '***');
  assert.equal(maskEmail('@x.com'), '***');
});
