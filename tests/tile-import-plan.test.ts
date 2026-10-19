import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTileImport } from '../src/lib/tileImportPlan.ts';

const blank = (n: number) => ({ id: n, label: `Tile ${n}`, tileType: 'standard', trackedStat: null });
const written = (n: number, label: string) => ({ id: n, label, tileType: 'drop', trackedStat: null });
const base = { append: true, canGrow: false, started: false, maxTiles: 100 };

test('adding to a classic grid fills its blank tiles in order', () => {
  const tiles = [written(1, 'Zenyte shard'), blank(2), blank(3), written(4, 'Twisted bow'), blank(5)];
  const plan = planTileImport({ ...base, rowCount: 2, tiles });
  assert.ok(plan.ok);
  assert.deepEqual(plan.targets.map((t) => t.id), [2, 3, 5]);
  assert.equal(plan.updates, 2);
  assert.equal(plan.creates, 0);
  assert.equal(plan.ignored, 0);
});

test('more rows than blanks on a grid that cannot grow: the rest are ignored, not written over real tiles', () => {
  const tiles = [written(1, 'Zenyte shard'), blank(2)];
  const plan = planTileImport({ ...base, rowCount: 3, tiles });
  assert.ok(plan.ok);
  assert.equal(plan.updates, 1);
  assert.equal(plan.ignored, 2);
});

test('a full classic grid says so instead of silently doing nothing', () => {
  const plan = planTileImport({ ...base, rowCount: 1, tiles: [written(1, 'A'), written(2, 'B')] });
  assert.equal(plan.ok, false);
});

test('a Leagues board fills its blanks first, then grows', () => {
  const plan = planTileImport({ ...base, canGrow: true, rowCount: 4, tiles: [blank(1), written(2, 'A')] });
  assert.ok(plan.ok);
  assert.equal(plan.updates, 1);
  assert.equal(plan.creates, 3);
});

test('a started board takes no additions', () => {
  const plan = planTileImport({ ...base, started: true, rowCount: 1, tiles: [blank(1)] });
  assert.equal(plan.ok, false);
});

test('a spreadsheet import still maps row i to position i, blanks or not', () => {
  const tiles = [written(1, 'A'), blank(2), blank(3)];
  const plan = planTileImport({ ...base, append: false, rowCount: 2, tiles });
  assert.ok(plan.ok);
  assert.deepEqual(plan.targets.slice(0, plan.updates).map((t) => t.id), [1, 2]);
});
