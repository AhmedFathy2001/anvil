import { test } from 'node:test';
import assert from 'node:assert/strict';

import { duplicateClogSlot, duplicateNotableDrop, itemKey } from '../src/lib/notifyDedupe.ts';

test('a collection-log slot posts once per person, names compared loosely', () => {
  const t = 1_000_000;
  assert.equal(itemKey('<col=ff0000>Masori body</col> '), 'masori body');
  assert.equal(duplicateClogSlot(7, 'Masori body', t), false);
  assert.equal(duplicateClogSlot(7, 'Masori Body', t + 5_000), true);
  assert.equal(duplicateClogSlot(8, 'Masori body', t + 5_000), false); // someone else
  assert.equal(duplicateClogSlot(7, 'Masori body', t + 3 * 60_000), false); // a later unlock
});

test('a notable item posts once per person and clan, loot and unlock alike', () => {
  const t = 2_000_000;
  assert.equal(duplicateNotableDrop(1, 7, 'Masori crafting kit', t), false); // the chest's loot
  assert.equal(duplicateNotableDrop(1, 7, 'Masori crafting kit', t + 20_000), true); // the log's unlock, later than the plugin's window
  assert.equal(duplicateNotableDrop(2, 7, 'Masori crafting kit', t + 20_000), false); // their other clan
  assert.equal(duplicateNotableDrop(1, 8, 'Masori crafting kit', t + 20_000), false); // someone else
  assert.equal(duplicateNotableDrop(1, 7, 'Masori crafting kit', t + 3 * 60_000), false); // a second kit, later
});
