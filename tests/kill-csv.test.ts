// Spreadsheet rows for the one "Kills" kind: `type=kills` picks the source; the old explicit shapes
// (and a few hand-typed names for them) import exactly as before; exports round-trip.
//
// Run: npx tsx --test tests/kill-csv.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTileCsv, tileToCsvCells, TILE_CSV_COLUMNS, parseTileGrid } from '../src/lib/csvTiles.ts';
import { resolveKillsRow } from '../src/lib/killSource.ts';
import { rowToTileConfig } from '../src/lib/taskSuggestRows.ts';
import type { Tile } from '../src/lib/types.ts';

const parseOne = (header: string, line: string) => {
  const parsed = parseTileCsv(`${header}\n${line}`);
  assert.equal(parsed.error, undefined);
  return parsed.rows[0];
};

test('type=kills with all-hiscores bosses becomes a hiscores boss tile', () => {
  const row = parseOne('label,type,targetNpcs,requiredAmount', '50 GWD,kills,"General Graardor|Kree\'Arra",50');
  assert.equal(row.tileType, 'kills');
  const r = resolveKillsRow(row);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.row.tileType, 'standard');
  assert.equal(r.row.statType, 'boss');
  assert.equal(r.row.trackedStat, 'generalGraardor,kreeArra');
  assert.equal(r.row.statGoal, 50);
  assert.equal(r.row.requiredAmount, null);
  assert.equal(r.row.targetNpcs, null);
});

test('type=kills with a boss key in trackedStat works too', () => {
  const row = parseOne('label,type,trackedStat,statGoal', '50 Zulrah,kills,Zulrah,50');
  const r = resolveKillsRow(row);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.row.statType, 'boss');
  assert.equal(r.row.trackedStat, 'zulrah');
  assert.equal(r.row.statGoal, 50);
});

test('type=kills with anything off the hiscores becomes a plugin kill tile for all of it', () => {
  const row = parseOne('label,type,targetNpcs,requiredAmount', 'Mixed,kills,"Zulrah|Chicken",20');
  const r = resolveKillsRow(row);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.row.tileType, 'kill');
  assert.deepEqual(r.row.targetNpcs, ['Zulrah', 'Chicken']);
  assert.equal(r.row.requiredAmount, 20);
  assert.equal(r.row.statType, null);
  assert.equal(r.row.trackedStat, null);
});

test('a started tile keeps its source — the row must fit it', () => {
  const row = parseOne('label,type,targetNpcs,requiredAmount', 'x,kills,Zulrah,20');
  const plugin = resolveKillsRow(row, 'plugin');
  if (!plugin.ok) throw new Error(plugin.error);
  assert.equal(plugin.row.tileType, 'kill');
  const mixed = parseOne('label,type,targetNpcs,requiredAmount', 'x,kills,"Zulrah|Cow",20');
  assert.equal(resolveKillsRow(mixed, 'hiscores').ok, false);
});

test('old shapes import unchanged; "boss" and "kill count" are accepted as aliases', () => {
  const kill = parseOne('label,type,targetNpcs,requiredAmount', 'Cows,kill,Cow|Cow calf,100');
  assert.equal(kill.tileType, 'kill');
  assert.deepEqual(kill.targetNpcs, ['Cow', 'Cow calf']);
  const boss = parseOne('label,type,trackedStat,statType,statGoal', '50 Zulrah,standard,zulrah,boss,50');
  assert.equal(boss.tileType, 'standard');
  assert.equal(boss.statType, 'boss');
  const aliasBoss = parseOne('label,type,trackedStat,statGoal', '50 Zulrah,Boss KC,zulrah,50');
  assert.equal(aliasBoss.tileType, 'standard');
  assert.equal(aliasBoss.statType, 'boss');
  const aliasKill = parseOne('label,type,targetNpcs,requiredAmount', 'Cows,Kill count,Cow,100');
  assert.equal(aliasKill.tileType, 'kill');
  // Explicit rows pass resolveKillsRow untouched.
  const same = resolveKillsRow(kill);
  assert.ok(same.ok && same.row === kill);
});

test('exports keep the explicit shapes and re-import to the same tile', () => {
  const tile = (t: Partial<Tile>): Tile => ({ id: 1, eventId: 1, position: 0, label: 'x', points: 1, ...t }) as Tile;
  const boss = tile({ label: '50 Zulrah', tileType: 'standard', trackedStat: 'zulrah', statType: 'boss', statGoal: 50 });
  const back = parseTileGrid([[...TILE_CSV_COLUMNS], tileToCsvCells(boss)]).rows[0];
  assert.equal(back.tileType, 'standard');
  assert.equal(back.statType, 'boss');
  assert.equal(back.trackedStat, 'zulrah');
  const kill = tile({ label: 'Cows', tileType: 'kill', targetNpcs: '["Cow"]', requiredAmount: 10 });
  const back2 = parseTileGrid([[...TILE_CSV_COLUMNS], tileToCsvCells(kill)]).rows[0];
  assert.equal(back2.tileType, 'kill');
  assert.deepEqual(back2.targetNpcs, ['Cow']);
});

test('a library "kills" task suggests the shape the importer would make', () => {
  const cfg = rowToTileConfig({ label: '25 Vorkath', tileType: 'kills', targetNpcs: ['Vorkath'], requiredAmount: 25 }, new Map());
  assert.equal(cfg?.tileType, 'standard');
  assert.equal(cfg?.statType, 'boss');
  assert.equal(cfg?.trackedStat, 'vorkath');
  assert.equal(cfg?.statGoal, 25);
  const plugin = rowToTileConfig({ label: '25 cows', tileType: 'kills', targetNpcs: ['Cow'], requiredAmount: 25 }, new Map());
  assert.equal(plugin?.tileType, 'kill');
  assert.deepEqual(plugin?.targetNpcs, ['Cow']);
});
