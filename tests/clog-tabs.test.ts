// The collection log's pages sit on the game's own tabs (lib/clogRarity groupOf, from
// src/data/clogTabs.json) — not on shelves guessed from page names, which put Barrows Chests under
// Minigames and invented a Skilling tab the game doesn't have.
//
// Run: npx tsx --test tests/clog-tabs.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import clog from '../src/data/clog.json' with { type: 'json' };
import { GROUP_ORDER, groupOf } from '../src/lib/clogRarity.ts';

const none = new Set<string>();

test('pages are on the tab the game puts them on', () => {
  for (const page of ['Barrows Chests', 'The Fight Caves', 'The Inferno', 'Fortis Colosseum', 'Tempoross', 'Wintertodt', 'Zalcano']) {
    assert.equal(groupOf(page, none), 'Bosses', page);
  }
  assert.equal(groupOf('Tombs of Amascut', none), 'Raids');
  assert.equal(groupOf('Elite Treasure Trails (Rare)', none), 'Clues');
  assert.equal(groupOf('Guardians of the Rift', none), 'Minigames');
  assert.equal(groupOf('Motherlode Mine', none), 'Other');
  assert.equal(groupOf('TzHaar', none), 'Other');
});

test('the tabs are the game\'s five, in its order, and every page lands on one', () => {
  assert.deepEqual(GROUP_ORDER, ['Bosses', 'Raids', 'Clues', 'Minigames', 'Other']);
  for (const page of Object.keys(clog.activities)) assert.ok(GROUP_ORDER.includes(groupOf(page, none)), page);
});
