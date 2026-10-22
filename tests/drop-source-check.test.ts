// A drop tile restricted to a monster that doesn't drop the item can never complete. The check looks
// the named source up in the wiki drop tables, and stays quiet about sources it doesn't know.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDropSources, unobtainableItems } from '../src/lib/dropSourceCheck.ts';

const TANZANITE_FANG = 12922;
const DRAGON_WARHAMMER = 13576;

test('an item the source drops passes', () => {
  assert.deepEqual(unobtainableItems([TANZANITE_FANG], ['Zulrah']), []);
  assert.deepEqual(unobtainableItems([TANZANITE_FANG], ['  zulrah ']), [], 'case and spacing do not matter');
});

test('an item the source does not drop is flagged', () => {
  assert.deepEqual(unobtainableItems([DRAGON_WARHAMMER], ['Zulrah']), [DRAGON_WARHAMMER]);
  assert.deepEqual(checkDropSources([TANZANITE_FANG, DRAGON_WARHAMMER], ['Zulrah']), [{ source: 'Zulrah', missing: [DRAGON_WARHAMMER] }]);
});

test('with several sources, one that drops it is enough', () => {
  assert.deepEqual(unobtainableItems([DRAGON_WARHAMMER], ['Zulrah', 'Lizardman shaman']), []);
});

test('sources the tables do not know are never flagged', () => {
  assert.deepEqual(unobtainableItems([DRAGON_WARHAMMER], ['Chambers of Xeric']), []);
  assert.deepEqual(unobtainableItems([DRAGON_WARHAMMER], ['Zulrah', 'Barrows']), [], 'an unknown source might drop it');
});

test('a wiki variant counts as its monster', () => {
  // Vorkath's table is keyed "Vorkath#Post-quest" as well as "Vorkath".
  assert.deepEqual(unobtainableItems([22124], ['Vorkath']), []);
});

test('nothing to check, nothing flagged', () => {
  assert.deepEqual(unobtainableItems([], ['Zulrah']), []);
  assert.deepEqual(unobtainableItems([DRAGON_WARHAMMER], []), []);
});
