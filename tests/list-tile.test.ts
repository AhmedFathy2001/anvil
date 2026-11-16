// LIST tiles (lib/listTile): a Kills / Skill XP tile counting several bosses or skills separately,
// stored as a combo and read back as the kind it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseComboRule, serializeComboRule, validateComboRule } from '../src/lib/combo';
import { listRule, readListTile } from '../src/lib/listTile';
import type { TileConfig } from '../src/lib/types';

const base = { label: 'Bosses', description: null, trackingMode: 'team', points: 1 } as unknown as TileConfig;
const part = (over: Record<string, unknown>) => ({ label: 'p', tileType: 'standard', trackingMode: 'team', ...over });

test('the rule keeps its list marker through validation and storage', () => {
  assert.deepEqual(listRule('kills', 0, 3), { mode: 'all', list: 'kills' });
  assert.deepEqual(listRule('kills', 3, 3), { mode: 'all', list: 'kills' }, 'all three of three is just "all"');
  assert.deepEqual(listRule('skill', 2, 3), { mode: 'nOf', n: 2, list: 'skill' });
  assert.deepEqual(parseComboRule(serializeComboRule({ mode: 'nOf', n: 2, list: 'skill' })), { mode: 'nOf', n: 2, list: 'skill' });
  const junk = validateComboRule({ mode: 'all', list: 'drops' });
  assert.deepEqual(junk.ok && junk.value, { mode: 'all' }, 'an unknown list is dropped, the rule stands');
});

test('a list of skills reads back with each goal, the shared one and how many are needed', () => {
  const tile = {
    ...base,
    tileType: 'combo',
    comboRule: { mode: 'nOf', n: 2, list: 'skill' },
    parts: [
      part({ id: 11, statType: 'skill', trackedStat: 'fishing', statGoal: 1_000_000 }),
      part({ id: 12, statType: 'skill', trackedStat: 'mining', statGoal: 1_000_000 }),
      part({ id: 13, statType: 'skill', trackedStat: 'smithing', statGoal: 500_000 }),
    ],
  } as unknown as TileConfig;
  const list = readListTile(tile)!;
  assert.equal(list.list, 'skill');
  assert.equal(list.need, 2);
  assert.equal(list.shared, 1_000_000);
  assert.deepEqual(list.entries.map((e) => [e.id, e.key, e.goal]), [[11, 'fishing', 1_000_000], [12, 'mining', 1_000_000], [13, 'smithing', 500_000]]);
  assert.deepEqual([list.seed.tileType, list.seed.statType, list.seed.statGoal, list.seed.parts], ['standard', 'skill', 1_000_000, null]);
});

test('a list of bosses keeps each one’s engine; a real combo, or an ordinary tile, is not a list', () => {
  const tile = {
    ...base,
    tileType: 'combo',
    comboRule: { mode: 'all', list: 'kills' },
    parts: [
      part({ id: 1, statType: 'boss', trackedStat: 'zulrah', statGoal: 50 }),
      part({ id: 2, tileType: 'kill', targetNpcs: ['Some Unlisted Monster'], requiredAmount: 30 }),
    ],
  } as unknown as TileConfig;
  const list = readListTile(tile)!;
  assert.equal(list.need, 0);
  assert.deepEqual(list.entries.map((e) => [e.source, e.goal]), [['hiscores', 50], ['plugin', 30]]);
  assert.equal(list.seed.tileType, 'kill', 'one plugin entry makes the seed a plugin tile');
  assert.equal(readListTile({ ...tile, comboRule: { mode: 'all' } } as TileConfig), null);
  assert.equal(readListTile({ ...base, tileType: 'kill' } as TileConfig), null);
});
