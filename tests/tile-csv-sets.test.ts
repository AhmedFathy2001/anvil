// CSV set syntax (lib/csvTiles) — the "@Set/N" item token and the groupMode column, round-tripped
// through parse → tile → serialize so an exported sheet re-imports as the same tile.
//
// Run: npx tsx --test tests/tile-csv-sets.test.ts
// (csvTiles imports the '@/' path alias, so this needs tsx rather than bare type-stripping.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTileGrid, tileToCsvCells, TILE_CSV_COLUMNS } from '../src/lib/csvTiles.ts';
import type { Tile } from '../src/lib/types.ts';

const HEADER = ['label', 'type', 'items', 'groupMode'];
const parseRow = (cells: string[]) => parseTileGrid([HEADER, cells]).rows[0];

test('"@Set" alone keeps the whole set required (no require count)', () => {
  const row = parseRow(['Any Barrows set', 'drop', "Dharok's helm:1@Dharok; Guthan's helm:1@Guthan", '']);
  assert.equal(row.items!.length, 2);
  assert.equal(row.items![0].group, 'Dharok');
  assert.equal(row.items![0].groupRequire, undefined);
  assert.equal(row.groupMode, null, 'blank column is the default any-one-set reading');
});

test('"@Set/1" carries the per-set require count', () => {
  const row = parseRow(['DT2 uniques', 'drop', 'Eye of the duke:1@Duke/1; Venator vestige:1@Leviathan/1', 'all']);
  assert.equal(row.groupMode, 'all');
  assert.deepEqual(
    row.items!.map((i) => [i.group, i.groupRequire]),
    [['Duke', 1], ['Leviathan', 1]],
  );
});

test('groupMode only recognises "all"; anything else is the default', () => {
  assert.equal(parseRow(['t', 'drop', 'Bones:1@A', 'ALL']).groupMode, 'all', 'case-insensitive');
  assert.equal(parseRow(['t', 'drop', 'Bones:1@A', 'any']).groupMode, null);
  assert.equal(parseRow(['t', 'drop', 'Bones:1@A', 'both']).groupMode, null);
});

test('a set name containing a slash is not eaten by the require parser', () => {
  const row = parseRow(['t', 'drop', 'Bones:1@Duke/Leviathan', '']);
  assert.equal(row.items![0].group, 'Duke/Leviathan');
  assert.equal(row.items![0].groupRequire, undefined);
});

test('item counts still parse alongside a set + require', () => {
  const row = parseRow(['t', 'drop', 'Blood shard:3@Wildy/2', 'all']);
  assert.equal(row.items![0].count, 3);
  assert.equal(row.items![0].group, 'Wildy');
  assert.equal(row.items![0].groupRequire, 2);
});

test('export → import round-trip preserves sets, require counts and the mode', () => {
  const tile = {
    id: 1,
    eventId: 1,
    position: 0,
    label: 'A unique from each DT2 boss',
    tileType: 'drop',
    requiredAmount: 2,
    groupMode: 'all',
    itemRequirements: JSON.stringify([
      { itemId: 28321, name: 'Eye of the duke', requiredAmount: 1, group: 'Duke', groupRequire: 1 },
      { itemId: 28316, name: 'Magus vestige', requiredAmount: 1, group: 'Duke', groupRequire: 1 },
      { itemId: 28319, name: 'Venator vestige', requiredAmount: 1, group: 'Leviathan', groupRequire: 1 },
    ]),
  } as Tile;

  const cells = tileToCsvCells(tile);
  const back = parseTileGrid([[...TILE_CSV_COLUMNS], cells]).rows[0];

  assert.equal(back.groupMode, 'all');
  assert.deepEqual(
    back.items!.map((i) => [i.name, i.id, i.count, i.group, i.groupRequire]),
    [
      ['Eye of the duke', 28321, 1, 'Duke', 1],
      ['Magus vestige', 28316, 1, 'Duke', 1],
      ['Venator vestige', 28319, 1, 'Leviathan', 1],
    ],
  );
});

test('a plain collection exports no groupMode cell — existing sheets are untouched', () => {
  const tile = {
    id: 2,
    eventId: 1,
    position: 1,
    label: 'Full Bandos',
    tileType: 'drop',
    itemRequirements: JSON.stringify([
      { itemId: 11832, name: 'Bandos chestplate', requiredAmount: 1 },
      { itemId: 11834, name: 'Bandos tassets', requiredAmount: 1 },
    ]),
  } as Tile;
  const cells = tileToCsvCells(tile);
  assert.equal(cells[TILE_CSV_COLUMNS.indexOf('groupMode')], '');
  assert.equal(cells[TILE_CSV_COLUMNS.indexOf('items')], 'Bandos chestplate#11832:1; Bandos tassets#11834:1');
});
