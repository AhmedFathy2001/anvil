import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_KEPT, parseKept, toggleKept } from '../src/lib/keptWebhooks';

test('a stored list reads back clean; junk reads as none kept', () => {
  assert.deepEqual(parseKept('["123","123","456","nope",7]'), ['123', '456']);
  assert.deepEqual(parseKept('not json'), []);
  assert.deepEqual(parseKept(null), []);
  assert.equal(parseKept(JSON.stringify(Array.from({ length: 500 }, (_, i) => String(i)))).length, MAX_KEPT);
});

test('keep and put back; ids gone from the server drop off', () => {
  const inServer = new Set(['1', '2']);
  assert.deepEqual(toggleKept(['9'], '1', true, inServer), ['1']);
  assert.deepEqual(toggleKept(['1', '2'], '1', false, inServer), ['2']);
});
