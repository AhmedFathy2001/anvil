import { test } from 'node:test';
import assert from 'node:assert/strict';

import { duplicateClogSlot, itemKey } from '../src/lib/notifyDedupe.ts';

test('a collection-log slot posts once per person, names compared loosely', () => {
  const t = 1_000_000;
  assert.equal(itemKey('<col=ff0000>Masori body</col> '), 'masori body');
  assert.equal(duplicateClogSlot(7, 'Masori body', t), false);
  assert.equal(duplicateClogSlot(7, 'Masori Body', t + 5_000), true);
  assert.equal(duplicateClogSlot(8, 'Masori body', t + 5_000), false); // someone else
  assert.equal(duplicateClogSlot(7, 'Masori body', t + 3 * 60_000), false); // a later unlock
});
