// The task library stores a task as a TileCsvRow and edits it as a TileConfig (admin/tile-library
// taskConfig). A combo must survive that round trip whole: its rule and every part.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { payloadToCsvRow, toTileConfig } from '../src/app/admin/tile-library/taskConfig';

test('a combo saved to the library reopens with its rule and its parts', async () => {
  const payload = {
    label: 'Ironman myself',
    tileType: 'combo',
    points: 1,
    comboRule: { mode: 'all' },
    parts: [
      { label: 'Test', tileType: 'pvp', requiredAmount: 3 },
      { label: 'Testing Test', tileType: 'drop', requiredAmount: 1, trackedItemIds: [9901], comboWeight: 0.5 },
    ],
  };
  const row = payloadToCsvRow(payload);
  assert.deepEqual(row.comboRule, { mode: 'all' });
  assert.equal(row.parts?.length, 2);
  assert.equal(row.parts?.[1].comboWeight, 0.5);

  const back = await toTileConfig(row, { label: 'x', points: 1, category: null, description: null });
  assert.equal(back.tileType, 'combo');
  assert.deepEqual(back.comboRule, { mode: 'all' });
  assert.deepEqual(back.parts?.map((p) => [p.label, p.tileType, p.requiredAmount]), [['Test', 'pvp', 3], ['Testing Test', 'drop', 1]]);
  assert.deepEqual(back.parts?.[1].trackedItemIds, [9901]);
  assert.equal(back.parts?.[1].comboWeight, 0.5);
});

test('an ordinary task carries no combo fields', async () => {
  const row = payloadToCsvRow({ label: 'Zulrah', tileType: 'kill', requiredAmount: 5 });
  assert.equal('parts' in row || 'comboRule' in row, false);
  const back = await toTileConfig(row, { label: 'x', points: 1, category: null, description: null });
  assert.equal(back.parts, null);
});
