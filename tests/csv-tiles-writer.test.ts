// The template CSV writer (lib/csvTiles tilesToCsvText): escaping, column alignment, and that what it
// writes reads back through the importer.
// Run: node --experimental-strip-types --test tests/csv-tiles-writer.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE_CSV_COLUMNS, csvField, parseTileCsv, templateExampleCells, tilesToCsvText } from '../src/lib/csvTiles.ts';
import type { Tile } from '../src/lib/types.ts';

const tile = (t: Partial<Tile>): Tile => ({ id: 1, eventId: 1, position: 0, label: 'x', points: 1, tileType: 'standard', ...t }) as Tile;

test('csvField quotes commas, quotes and line breaks, and nothing else', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
});

test('an empty board gets the worked examples, flagged as examples', () => {
  const { text, hasExamples } = tilesToCsvText([]);
  assert.equal(hasExamples, true);
  assert.equal(text.split('\n').length, 1 + 5);
});

test('every example row has exactly one cell per column', () => {
  for (const cells of templateExampleCells()) assert.equal(cells.length, TILE_CSV_COLUMNS.length);
});

test('the examples land in the right columns and import as what they say', () => {
  const parsed = parseTileCsv(tilesToCsvText([]).text);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.rows.length, 5);
  const byLabel = Object.fromEntries(parsed.rows.map((r, i) => [parsed.labels[i], r]));
  assert.equal(byLabel['10M Mining XP'].statType, 'skill');
  assert.equal(byLabel['10M Mining XP'].statGoal, 10_000_000);
  assert.equal(byLabel['50 Zulrah KC'].statGoal, 50);
  assert.equal(byLabel['Kill 100 cows'].tileType, 'kill');
  assert.equal(byLabel['Kill 100 cows'].requiredAmount, 100);
  assert.equal(byLabel['Sub-30 Inferno'].tileType, 'timed');
  assert.equal(byLabel['Sub-30 Inferno'].timeThresholdSeconds, 1800);
  // Nothing slid into the effort columns the way the old positional rows did.
  assert.ok(parsed.rows.every((r) => r.points != null && r.points > 0));
});

test('a board with tiles is written as those tiles, with commas in labels kept in one cell', () => {
  const { text, hasExamples } = tilesToCsvText([tile({ label: 'Bows, arrows & "more"', points: 4 })]);
  assert.equal(hasExamples, false);
  const parsed = parseTileCsv(text);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.labels[0], 'Bows, arrows & "more"');
  assert.equal(parsed.rows[0].points, 4);
});
