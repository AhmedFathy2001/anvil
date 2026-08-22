// Collection set logic (lib/collectionSets) — OR-ed alternative sets, AND-ed "one from each source"
// sets, partial group requirements, and the back-compat promise that an untagged collection behaves
// exactly as it did before groupMode/groupRequire existed.
//
// Run: node --experimental-strip-types --test tests/collection-sets.test.ts
// (lib/collectionSets imports nothing, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateCollection,
  parseGroupMode,
  groupModeHint,
  type CollectionProgressItem,
} from '../src/lib/collectionSets.ts';

let nextId = 1;
const item = (
  name: string,
  have: number,
  opts: { need?: number; group?: string; groupRequire?: number } = {},
): CollectionProgressItem => ({
  itemId: nextId++,
  name,
  requiredAmount: opts.need ?? 1,
  currentAmount: have,
  group: opts.group ?? null,
  groupRequire: opts.groupRequire ?? null,
});

test('parseGroupMode: only "all" flips it; anything else is the legacy any-one-set reading', () => {
  assert.equal(parseGroupMode('all'), 'all');
  assert.equal(parseGroupMode('any'), 'any');
  assert.equal(parseGroupMode(null), 'any');
  assert.equal(parseGroupMode(undefined), 'any');
  assert.equal(parseGroupMode('nonsense'), 'any');
});

test('flat collection (no groups): every item required, unchanged behaviour', () => {
  const partial = evaluateCollection([item('Bandos chestplate', 1), item('Bandos tassets', 0)], null);
  assert.equal(partial.isComplete, false);
  assert.equal(partial.groups.length, 0);
  assert.equal(groupModeHint(partial), null, 'nothing to explain on a flat collection');

  const done = evaluateCollection([item('Bandos chestplate', 1), item('Bandos tassets', 1)], null);
  assert.equal(done.isComplete, true);
});

test('any mode: one FULL set completes it, and a half-set of each does not', () => {
  const reqs = [
    item("Dharok's helm", 1, { group: 'Dharok' }),
    item("Dharok's greataxe", 1, { group: 'Dharok' }),
    item("Guthan's helm", 1, { group: 'Guthan' }),
    item("Guthan's warspear", 1, { group: 'Guthan' }),
  ];
  assert.equal(evaluateCollection(reqs, 'any').isComplete, true, 'Dharok set is complete');

  const mixed = [
    item("Dharok's helm", 1, { group: 'Dharok' }),
    item("Dharok's greataxe", 0, { group: 'Dharok' }),
    item("Guthan's helm", 1, { group: 'Guthan' }),
    item("Guthan's warspear", 0, { group: 'Guthan' }),
  ];
  assert.equal(evaluateCollection(mixed, 'any').isComplete, false, 'pieces from different sets never mix');
});

test('ungrouped items stay required alongside the sets, in both modes', () => {
  const reqs = [
    item('Scythe of vitur', 0),
    item("Dharok's helm", 1, { group: 'Dharok' }),
    item("Dharok's greataxe", 1, { group: 'Dharok' }),
  ];
  assert.equal(evaluateCollection(reqs, 'any').isComplete, false, 'the set is done, the always-required item is not');
  assert.equal(evaluateCollection(reqs, 'all').isComplete, false);
});

test('all mode + require 1: one unique from EACH source — the DT2 case', () => {
  // Four bosses, three uniques each. One from every boss completes it; three from one boss does not.
  const board = (have: Record<string, number>) =>
    ['Duke', 'Leviathan', 'Whisperer', 'Vardorvis'].flatMap((boss) =>
      [1, 2, 3].map((n) => item(`${boss} unique ${n}`, have[`${boss}${n}`] ?? 0, { group: boss, groupRequire: 1 })),
    );

  const oneEach = evaluateCollection(board({ Duke1: 1, Leviathan2: 1, Whisperer1: 1, Vardorvis3: 1 }), 'all');
  assert.equal(oneEach.isComplete, true);
  assert.equal(oneEach.groups.length, 4);
  assert.ok(oneEach.groups.every((g) => g.require === 1 && g.satisfied));

  const allFromOneBoss = evaluateCollection(board({ Duke1: 1, Duke2: 1, Duke3: 1 }), 'all');
  assert.equal(allFromOneBoss.isComplete, false, 'three Duke uniques is one source, not four');
  assert.equal(allFromOneBoss.groups.filter((g) => g.satisfied).length, 1);

  // The same board under the legacy reading would have completed on that single boss.
  assert.equal(evaluateCollection(board({ Duke1: 1 }), 'any').isComplete, true);
});

test('partial groups: "any 3 of these 6"', () => {
  const six = (met: number) =>
    Array.from({ length: 6 }, (_, i) => item(`Megarare ${i}`, i < met ? 1 : 0, { group: 'Rares', groupRequire: 3 }));

  assert.equal(evaluateCollection(six(2), 'any').isComplete, false);
  const three = evaluateCollection(six(3), 'any');
  assert.equal(three.isComplete, true);
  assert.equal(three.groups[0].met, 3);
  assert.equal(three.groups[0].require, 3);
});

test('an item counts only once its own required amount is collected', () => {
  const reqs = [item('Ranger boots', 2, { need: 3, group: 'Wildy', groupRequire: 1 })];
  assert.equal(evaluateCollection(reqs, 'all').isComplete, false, '2 of 3 is not the item');
  reqs[0].currentAmount = 3;
  assert.equal(evaluateCollection(reqs, 'all').isComplete, true);
});

test('group tags match case-insensitively but display as first written', () => {
  const state = evaluateCollection(
    [item('A', 1, { group: 'Duke' }), item('B', 1, { group: 'duke' }), item('C', 0, { group: 'DUKE' })],
    'all',
  );
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0].name, 'Duke');
  assert.equal(state.groups[0].items.length, 3);
  assert.equal(state.isComplete, false, 'the third item is still missing from the one real group');
});

test('a stale groupRequire larger than the group stays satisfiable', () => {
  // Authored as "any 4 of", then the group was trimmed to 2 items.
  const reqs = [
    item('A', 1, { group: 'Set', groupRequire: 4 }),
    item('B', 1, { group: 'Set', groupRequire: 4 }),
  ];
  const state = evaluateCollection(reqs, 'all');
  assert.equal(state.groups[0].require, 2, 'clamped to the group size');
  assert.equal(state.isComplete, true);
});

test('disagreeing groupRequire rows resolve to the strictest', () => {
  const reqs = [
    item('A', 1, { group: 'Set', groupRequire: 1 }),
    item('B', 0, { group: 'Set', groupRequire: 2 }),
    item('C', 0, { group: 'Set' }),
  ];
  const state = evaluateCollection(reqs, 'all');
  assert.equal(state.groups[0].require, 2);
  assert.equal(state.isComplete, false);
});

test('groupModeHint says which reading is in force', () => {
  const sets = [
    item('A', 0, { group: 'One' }),
    item('B', 0, { group: 'Two' }),
  ];
  assert.match(groupModeHint(evaluateCollection(sets, 'any'))!, /any ONE set/);
  assert.match(groupModeHint(evaluateCollection(sets, 'all'))!, /Every set/);
});
