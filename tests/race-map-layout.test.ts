// The race map turns to run top to bottom when its box is too narrow to keep it near full size.
//
// Run: npx tsx --test tests/race-map-layout.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_SCALE, V_COL_MIN, V_GUTTER, layoutFor, naturalWidth } from '../src/lib/raceMapLayout.ts';

test('unmeasured (server render) keeps the natural horizontal map', () => {
  assert.deepEqual(layoutFor(0, 10, 2), { vertical: false, scale: 1 });
});

test('a box that fits the map shows it at full size; a little short, shrunk no further than 85%', () => {
  const w = naturalWidth(10, 1);
  assert.deepEqual(layoutFor(w + 8, 10, 1), { vertical: false, scale: 1 });
  const snug = layoutFor(Math.ceil(w * 0.9) + 8, 10, 1);
  assert.equal(snug.vertical, false);
  assert.ok(!snug.vertical && snug.scale >= MIN_SCALE && snug.scale < 1);
});

test('the owner’s ~600px column: a 10-step race turns vertical, full-width road columns, no sideways scroll', () => {
  const l = layoutFor(600, 10, 1);
  assert.equal(l.vertical, true);
  assert.ok(l.vertical && !l.scrolls && l.colW >= V_COL_MIN);
});

test('a phone (390px) holds three roads side by side without scrolling; five roads scroll the columns', () => {
  const three = layoutFor(358, 7, 3);
  assert.ok(three.vertical && !three.scrolls, JSON.stringify(three));
  const five = layoutFor(358, 7, 5);
  assert.ok(five.vertical && five.scrolls && five.colW === V_COL_MIN);
  assert.ok(V_GUTTER + 5 * V_COL_MIN > 358);
});

test('desktop widths stay horizontal; a one-step board never turns', () => {
  assert.equal(layoutFor(1600, 10, 2).vertical, false);
  assert.equal(layoutFor(1000, 6, 2).vertical, false);
  assert.equal(layoutFor(300, 1, 1).vertical, false);
  // 1000px with a 10-step race (natural ~1650px) is under 85%: vertical.
  assert.equal(layoutFor(1000, 10, 2).vertical, true);
});

test('canTurn off only shrinks (the old behaviour)', () => {
  assert.equal(layoutFor(600, 10, 1, false).vertical, false);
});
