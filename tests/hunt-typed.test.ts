// The hunt form's typed box (lib/huntTyped): what a line typed the way it is said in clan chat
// reads back as.
//
// Run: npx tsx --test tests/hunt-typed.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTypedHunt, typedPet } from '../src/lib/huntTyped';

test('the mock line: rows with points, all of them, top 3', () => {
  const t = parseTypedHunt('graardor pet 5, heron 3, rocky 2, bandos chestplate 1, all of them, top 3');
  assert.deepEqual(
    t.rows.map((r) => [r.query, r.points, r.pet?.name ?? null]),
    [
      ['graardor pet', 5, 'Pet general graardor'],
      ['heron', 3, 'Heron'],
      ['rocky', 2, 'Rocky'],
      ['bandos chestplate', 1, null],
    ],
  );
  assert.equal(t.endsAll, true);
  assert.equal(t.places, 3);
  // A number after a name is points, so the rule is points.
  assert.equal(t.rule, 'points');
});

test('no numbers: no points rule, rows still read', () => {
  const t = parseTypedHunt('tumeken\'s shadow; zulrah pet\nfirst');
  assert.deepEqual(t.rows.map((r) => [r.query, r.points]), [["tumeken's shadow", null], ['zulrah pet', null]]);
  assert.equal(t.rows[1].pet?.name, 'Pet snakeling');
  assert.equal(t.rule, 'first');
  assert.equal(t.endsAll, false);
  assert.equal(t.places, null);
});

test('a boss name alone stays an item search: only "pet" makes it the pet', () => {
  assert.equal(typedPet('graardor'), null);
  assert.equal(typedPet('graardor pet')?.id, 12650);
  assert.equal(typedPet('pet general graardor')?.id, 12650);
  assert.equal(typedPet('general graardor pet')?.id, 12650);
});

test('a name two pets answer to is not guessed', () => {
  // The three Dagannoth Kings each have a pet.
  assert.equal(typedPet('dagannoth pet'), null);
  assert.equal(typedPet('dagannoth rex pet')?.name, 'Pet dagannoth rex');
});

test('pet groups, places and endings in other words', () => {
  const t = parseTypedHunt('gwd pets, skilling pets, top 2 win, ends when one player has all');
  assert.deepEqual(t.groups, ['gwd', 'skilling']);
  assert.equal(t.places, 2);
  assert.equal(t.endsAll, true);
  assert.equal(t.rows.length, 0);
});

test('points written several ways, clamped', () => {
  const t = parseTypedHunt('heron x3, rocky 2 pts, beaver 5000');
  assert.deepEqual(t.rows.map((r) => r.points), [3, 2, 1000]);
  assert.ok(t.rows.every((r) => r.pet));
});

test('an empty box is an empty read', () => {
  assert.deepEqual(parseTypedHunt(' , ,, '), { rows: [], endsAll: false, places: null, rule: null, groups: [] });
});
