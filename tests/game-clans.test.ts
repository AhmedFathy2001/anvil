// The plugin's in-game clan report, cleaned (lib/gameClanReport). Pure — no database.
//
// Run: npx tsx --test tests/game-clans.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gameClanKey, parseGameClanReport } from '../src/lib/gameClanReport.ts';

test('one key per clan however the game spells it', () => {
  assert.equal(gameClanKey('Iron Foundry'), 'iron foundry');
  assert.equal(gameClanKey('  iron foundry '), 'iron foundry');
  assert.equal(gameClanKey('Iron_Foundry'), 'iron foundry');
  assert.equal(gameClanKey('Iron   Foundry'), 'iron foundry');
});

test('a full report survives cleaning', () => {
  assert.deepEqual(
    parseGameClanReport({ clan: { name: 'Iron Foundry', rank: 100, title: 'Dragonstone', joinedOn: '2025-03-14' } }),
    { name: 'Iron Foundry', rank: 100, title: 'Dragonstone', joinedOn: '2025-03-14' },
  );
});

test('null clan means "in no clan"; garbage means "ignore", never "left"', () => {
  assert.equal(parseGameClanReport({ clan: null }), null);
  assert.equal(parseGameClanReport({}), undefined);
  assert.equal(parseGameClanReport(null), undefined);
  assert.equal(parseGameClanReport({ clan: 'Iron Foundry' }), undefined);
  assert.equal(parseGameClanReport({ clan: { name: '' } }), undefined);
  assert.equal(parseGameClanReport({ clan: { name: '   ' } }), undefined);
  assert.equal(parseGameClanReport({ clan: { name: 'x'.repeat(21) } }), undefined);
});

test('bad optional fields drop to null without sinking the report', () => {
  assert.deepEqual(
    parseGameClanReport({ clan: { name: 'Iron <b>Foundry', rank: 500, title: 'y'.repeat(31), joinedOn: '14/03/2025' } }),
    { name: 'Iron bFoundry', rank: null, title: null, joinedOn: null },
  );
  assert.equal(parseGameClanReport({ clan: { name: 'A', rank: 1.5 } })?.rank, null);
  assert.equal(parseGameClanReport({ clan: { name: 'A', rank: -1 } })?.rank, -1);
  assert.equal(parseGameClanReport({ clan: { name: 'A', joinedOn: '2025-13-45' } })?.joinedOn, null);
});
