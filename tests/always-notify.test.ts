// The clan's always-post list: defaults until edited, then exactly what the admin saved.
//
// Run: npx tsx --test tests/always-notify.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALWAYS_NOTIFY_NONE, DEFAULT_ALWAYS_NOTIFY, effectiveAlwaysNotify, parseItemLines, storedAlwaysNotify } from '../src/lib/alwaysNotify.ts';

test('never edited: the defaults, plus any old extras, once each', () => {
  assert.deepEqual(effectiveAlwaysNotify(null, null), [...DEFAULT_ALWAYS_NOTIFY]);
  const got = effectiveAlwaysNotify(null, "Voidwaker\ninfernal cape\n");
  assert.equal(got.length, DEFAULT_ALWAYS_NOTIFY.length + 1);
  assert.equal(got.at(-1), 'Voidwaker');
});

test('edited: exactly the saved list, so a default can be removed', () => {
  assert.deepEqual(effectiveAlwaysNotify('Voidwaker\nFire cape', 'Old extra'), ['Voidwaker', 'Fire cape']);
});

test('emptied: stored as the marker, read back as nothing', () => {
  assert.equal(storedAlwaysNotify('  \n '), ALWAYS_NOTIFY_NONE);
  assert.deepEqual(effectiveAlwaysNotify(ALWAYS_NOTIFY_NONE, 'Old extra'), []);
  assert.deepEqual(parseItemLines(`a\n${ALWAYS_NOTIFY_NONE}\nA\n b `), ['a', 'b']);
});
