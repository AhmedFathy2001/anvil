// Card route path segments: bounded, decoded safely, ids kept inside Postgres' int range.
// Run: npx tsx --test tests/og-card-params.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cardId, cardParam } from '../src/lib/ogKit.tsx';

test('cardParam decodes, trims and bounds', () => {
  assert.equal(cardParam('Zezima', 12), 'Zezima');
  assert.equal(cardParam('Iron%20Man', 12), 'Iron Man');
  assert.equal(cardParam('a'.repeat(13), 12), null, 'longer than an RSN');
  assert.equal(cardParam('%E0%A4%A', 12), null, 'malformed escape is not a 500');
  assert.equal(cardParam('', 12), null);
  assert.equal(cardParam(undefined, 12), null);
});

test('cardId accepts positive int4 ids only', () => {
  assert.equal(cardId('42'), 42);
  for (const bad of ['0', '-1', '1e9', '1.5', 'NaN', '99999999999', '2147483648', '', undefined]) {
    assert.equal(cardId(bad), null, String(bad));
  }
  assert.equal(cardId('2147483647'), 2147483647);
});
