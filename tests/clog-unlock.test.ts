// Live collection-log unlocks (lib/clogUnlock): the in-game line names an item, the catalogue finds
// its slot, and the kill line is only trusted for the page the item is on.
//
// Run: npx tsx --test tests/clog-unlock.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clogIdsForName, killLineBelongsToPage, resolveUnlock } from '../src/lib/clogUnlock.ts';

test('the unlock line resolves to the boss page, not All Pets, with the kill that produced it', () => {
  const out = resolveUnlock({ name: 'Moxi', kcName: 'Amoxliatl', kc: 16 }, new Set());
  assert.deepEqual(out, { itemId: 30154, page: 'Amoxliatl', kc: 16 });
});

test("another boss's kill line is not this item's KC", () => {
  assert.equal(resolveUnlock({ name: 'Moxi', kcName: 'Vorkath', kc: 300 }, new Set())?.kc, null);
});

test('names match regardless of case and punctuation; unknown names resolve to nothing', () => {
  assert.deepEqual(clogIdsForName("dagon'hai hat"), clogIdsForName("Dagon'hai hat"));
  assert.ok(clogIdsForName("Dagon'hai hat").length > 0);
  assert.equal(resolveUnlock({ name: 'Not an item' }, new Set()), null);
});

test('a page that is not a boss carries no KC even with a kill line', () => {
  const out = resolveUnlock({ name: "Dagon'hai hat", kcName: 'Amoxliatl', kc: 16 }, new Set());
  assert.equal(out?.page, 'Slayer');
  assert.equal(out?.kc, null);
});

test('kill lines match their page by name or by hiscores boss', () => {
  assert.ok(killLineBelongsToPage('Amoxliatl', 'Amoxliatl'));
  assert.ok(killLineBelongsToPage('chambers of xeric', 'Chambers of Xeric'));
  assert.ok(!killLineBelongsToPage('Vorkath', 'Zulrah'));
});
