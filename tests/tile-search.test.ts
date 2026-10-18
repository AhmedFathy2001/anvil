import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileMatchesSearch } from '../src/lib/tileSearch';
import { tileSearchText } from '../src/lib/tileSearchText';

const tile = (over: Record<string, unknown>) => ({ label: 'Tile', position: 0, ...over });

test('finds a tile by its boss, source, items, kind and position — not only its name', () => {
  const hilt = tile({ label: 'Big hilt energy', tileType: 'drop', sourceNpcs: '["General Graardor"]' });
  assert.ok(tileMatchesSearch(hilt, 'graardor'));
  assert.ok(tileMatchesSearch(hilt, 'drop graardor'));
  assert.ok(!tileMatchesSearch(hilt, 'timed graardor'));

  const bird = tile({ label: 'Feathered friend', trackedStat: 'kreearra', statType: 'boss' });
  assert.ok(tileMatchesSearch(bird, "kree'arra"));
  assert.ok(tileMatchesSearch(bird, 'boss kc'));

  const snake = tile({ label: 'Snake speedrun', tileType: 'timed', timedActivity: 'Zulrah' });
  assert.ok(tileMatchesSearch(snake, 'timed zulrah'));

  const set = tile({ label: 'Dress up', tileType: 'drop',
    itemRequirements: '[{"itemId":11832,"name":"Bandos chestplate","requiredAmount":1}]' });
  assert.ok(tileMatchesSearch(set, 'bandos chestplate'));
  assert.ok(tileMatchesSearch(set, 'item set'));

  assert.ok(tileMatchesSearch(tile({ label: 'X', position: 11 }), '#12'));
});

test('item ids resolve to their names and the boss they drop from', () => {
  const text = tileSearchText({ trackedItemIds: '[4151]' });
  assert.match(text, /Abyssal whip/);
  assert.match(text, /Abyssal Sire/);
  assert.ok(tileMatchesSearch(tile({ label: 'Whip it', searchText: text }), 'sire whip'));
});
