// The "who reacted" line on a reaction chip (panel tooltip, site hover): lib/reactionWho.
//
// Run: npx tsx --test tests/reaction-who.test.ts (pure, no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WHO_CAP, whoList, whoText } from '../src/lib/reactionWho.ts';

test('one, two and three names read as a sentence', () => {
  assert.equal(whoList(['Mossy']), 'Mossy');
  assert.equal(whoList(['Mossy', 'Rikkert']), 'Mossy and Rikkert');
  assert.equal(whoList(['Mossy', 'Rikkert', 'Zezima']), 'Mossy, Rikkert and Zezima');
});

test('past the cap the rest are counted, not named', () => {
  const names = Array.from({ length: 13 }, (_, i) => `P${i + 1}`);
  const line = whoList(names);
  assert.equal(WHO_CAP, 10);
  assert.ok(line.startsWith('P1, P2, P3'));
  assert.ok(line.endsWith('P10 and 3 others'));
  assert.ok(!line.includes('P11'));
  assert.equal(whoList(['A', 'B', 'C'], 2), 'A, B and 1 other');
});

test('a reactor with no character here is counted in the others, never named', () => {
  assert.equal(whoList(['Mossy', null]), 'Mossy and 1 other');
  assert.equal(whoList(['Mossy', null, null, '  ']), 'Mossy and 3 others');
  assert.equal(whoList([null]), '1 person');
  assert.equal(whoList([null, null]), '2 people');
});

test('the chip line leads with the reaction, and nobody means no line', () => {
  assert.equal(whoText('GZ', ['Mossy', 'Rikkert', null, null, null]), 'GZ · Mossy, Rikkert and 3 others');
  assert.equal(whoText('Sit', ['Lucky One']), 'Sit · Lucky One');
  assert.equal(whoText('GZ', []), '');
});
