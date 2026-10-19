import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileToCsvRow } from '../src/lib/csvTiles.ts';
import type { Tile } from '../src/lib/types.ts';

// A board tile has to come out in the importer's own shape — `tileType`, an `items` array, numbers as
// numbers. It used to come out as raw spreadsheet cells, so a tile added to the library from a board
// (or a board shared to the board library) imported back as a Standard tile that tracked nothing.

const tile = (t: Partial<Tile>): Tile => ({ id: 1, eventId: 1, position: 0, label: 'x', points: 1, ...t }) as Tile;

test('a drop tile keeps its kind, amount and item', () => {
  const row = tileToCsvRow(tile({ label: 'Rune boots', tileType: 'drop', requiredAmount: 1, trackedItemIds: '[4131]', points: 15 }));
  assert.equal(row.tileType, 'drop');
  assert.equal(row.requiredAmount, 1);
  assert.equal(row.points, 15);
  assert.deepEqual(row.items?.map((i) => i.id), [4131]);
  assert.equal((row as Record<string, unknown>).type, undefined, 'no raw spreadsheet column names');
});

test('a kill tile keeps its targets as a list', () => {
  const row = tileToCsvRow(tile({ label: '25 Vorkath', tileType: 'kill', requiredAmount: 25, targetNpcs: '["Vorkath"]' }));
  assert.equal(row.tileType, 'kill');
  assert.deepEqual(row.targetNpcs, ['Vorkath']);
});

test('an XP tile keeps its skill and goal', () => {
  const row = tileToCsvRow(tile({ label: '500k Slayer', tileType: 'standard', statType: 'skill', trackedStat: 'slayer', statGoal: 500000 }));
  assert.equal(row.statType, 'skill');
  assert.equal(row.trackedStat, 'slayer');
  assert.equal(row.statGoal, 500000);
});
