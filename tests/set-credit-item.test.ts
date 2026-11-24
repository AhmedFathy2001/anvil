// Suggesting which set piece an unlinked credit was, from its stored chat lines (lib/setCreditItem).
// Run: npx tsx --test tests/set-credit-item.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { suggestSetItem } from '../src/lib/setCreditItem.ts';

const reqs = [
  { itemId: 4724, name: "Guthan's helm" },
  { itemId: 4716, name: "Dharok's helm" },
  { itemId: 4730, name: "Guthan's chainskirt" },
];
const facts = (...lines: string[]) => JSON.stringify({ lines: lines.map((text) => ({ offset: -1, text })) });

test('the collection log line names the piece', () => {
  assert.equal(suggestSetItem(facts('New item added to your collection log: Guthan\'s helm', 'Your Barrows chest count is: 162.'), reqs), 4724);
  assert.equal(suggestSetItem(facts('Valuable drop: Dharok\'s helm (1,234,000 coins)'), reqs), 4716);
});

test('a piece another credit already links is skipped when the chest named two', () => {
  const two = facts('New item added to your collection log: Guthan\'s helm', 'New item added to your collection log: Guthan\'s chainskirt');
  assert.equal(suggestSetItem(two, reqs, new Set([4724])), 4730);
});

test('nothing to go on gives null', () => {
  assert.equal(suggestSetItem(facts('Your Barrows chest count is: 327.'), reqs), null);
  assert.equal(suggestSetItem(null, reqs), null);
  assert.equal(suggestSetItem('not json', reqs), null);
});
