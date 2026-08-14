// Tiles that can't credit themselves (lib/boardMisconfig) — the checks behind the live board's
// "something's misconfigured" panel.
//
// Run: node --experimental-strip-types --test tests/board-misconfig.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findBoardProblems, summariseProblems, type MisconfigTile } from '../src/lib/boardMisconfig.ts';

const tile = (over: Partial<MisconfigTile> = {}): MisconfigTile => ({
  id: 1,
  position: 1,
  label: 'A tile',
  tileType: 'standard',
  points: 5,
  ...over,
});

test('a drop tile with nothing to watch for cannot credit', () => {
  const problems = findBoardProblems([tile({ tileType: 'drop' })], { pointsMode: true });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].severity, 'broken');
  assert.match(problems[0].problem, /No item/);
});

test('a drop tile is fine once it watches items, either way of listing them', () => {
  const byIds = findBoardProblems([tile({ tileType: 'drop', trackedItemIds: '[4151]' })], { pointsMode: true });
  const byRequirements = findBoardProblems(
    [tile({ tileType: 'drop', itemRequirements: '[{"itemId":4151,"amount":1}]' })],
    { pointsMode: true },
  );
  assert.deepEqual([byIds, byRequirements].map((p) => p.length), [0, 0]);
});

test('empty JSON lists count as empty, not as configuration', () => {
  for (const empty of ['[]', '  ', '{}']) {
    const problems = findBoardProblems([tile({ tileType: 'kill', targetNpcs: empty })], { pointsMode: false });
    assert.equal(problems.length, 1, `expected ${JSON.stringify(empty)} to read as unset`);
  }
});

test('turning off automatic crediting is a decision, not a fault', () => {
  const problems = findBoardProblems([tile({ tileType: 'kill', autoTrackDisabled: 1 })], { pointsMode: false });
  assert.deepEqual(problems, []);
});

test('a tracked stat with no goal can never finish', () => {
  const problems = findBoardProblems([tile({ trackedStat: 'agility' })], { pointsMode: false });
  assert.equal(problems[0].severity, 'broken');
  assert.match(problems[0].problem, /no goal/i);
});

test('a timed tile with no time to beat cannot be cleared', () => {
  const problems = findBoardProblems([tile({ tileType: 'timed' })], { pointsMode: false });
  assert.equal(problems[0].severity, 'broken');
});

test('a scoring tile worth nothing on a points board is worth a look, not broken', () => {
  const problems = findBoardProblems([tile({ tileType: 'drop', trackedItemIds: '[4151]', points: 0 })], {
    pointsMode: true,
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].severity, 'check');

  // An optional tile is allowed to be worth nothing — that's what optional means.
  const optional = findBoardProblems([tile({ tileType: 'drop', trackedItemIds: '[4151]', points: 0, optional: 1 })], {
    pointsMode: true,
  });
  assert.deepEqual(optional, []);

  // And on a tile-scored board, points are irrelevant.
  const tilesMode = findBoardProblems([tile({ tileType: 'drop', trackedItemIds: '[4151]', points: 0 })], {
    pointsMode: false,
  });
  assert.deepEqual(tilesMode, []);
});

test('a count tile that needs zero completes on the first credit', () => {
  const problems = findBoardProblems([tile({ tileType: 'kill', targetNpcs: '["zulrah"]', requiredAmount: 0 })], {
    pointsMode: false,
  });
  assert.equal(problems[0].severity, 'check');
  assert.match(problems[0].problem, /first one/);
});

test('broken tiles sort ahead of things worth a look, then by board position', () => {
  const problems = findBoardProblems(
    [
      tile({ id: 1, position: 9, tileType: 'drop', trackedItemIds: '[1]', points: 0 }),
      tile({ id: 2, position: 4, tileType: 'kill' }),
      tile({ id: 3, position: 2, tileType: 'drop' }),
    ],
    { pointsMode: true },
  );
  assert.deepEqual(problems.map((p) => p.tileId), [3, 2, 1]);
  assert.equal(summariseProblems(problems), "2 tiles can't credit, 1 worth a look");
});

test('a clean board says nothing at all', () => {
  assert.equal(summariseProblems([]), null);
  assert.deepEqual(findBoardProblems([tile({ tileType: 'drop', trackedItemIds: '[4151]' })], { pointsMode: true }), []);
});
