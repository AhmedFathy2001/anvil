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
  howItCounts,
  itemCap,
  setTimes,
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

const barrows = (have: Record<string, number>) =>
  ['Ahrim', 'Dharok'].flatMap((set) =>
    ['helm', 'body', 'legs', 'weapon'].map((p) => item(`${set}'s ${p}`, have[`${set} ${p}`] ?? have[set] ?? 0, { group: set })),
  );

test('setTimes: a full set is bounded by its rarest piece; a partial one by its Nth best', () => {
  assert.equal(setTimes([item('a', 2), item('b', 1), item('c', 3)], 3), 1);
  assert.equal(setTimes([item('a', 2), item('b', 2), item('c', 0)], 2), 2, 'any 2 of 3: two pieces at 2 each');
  assert.equal(setTimes([item('a', 4, { need: 2 }), item('b', 2)], 2), 2, 'each piece measured in its own amount');
});

test('N sets: two different sets count, one set twice counts, a mix of pieces does not', () => {
  assert.equal(evaluateCollection(barrows({ Ahrim: 1, Dharok: 1 }), 'any', 2).isComplete, true, "Ahrim's + Dharok's");
  assert.equal(evaluateCollection(barrows({ Ahrim: 2 }), 'any', 2).isComplete, true, "Ahrim's twice");
  const short = evaluateCollection(barrows({ Ahrim: 2, 'Ahrim weapon': 1 }), 'any', 2);
  assert.equal(short.isComplete, false, 'second Ahrim set is missing its weapon');
  assert.equal(short.setsDone, 1);
  assert.equal(evaluateCollection(barrows({ Ahrim: 1, 'Dharok helm': 1 }), 'any', 2).isComplete, false, 'pieces never mix');
  assert.equal(evaluateCollection(barrows({ Ahrim: 1 }), 'any', null).isComplete, true, 'unset = one set, as before');
});

test('itemCap lets a piece count once per set the tile needs, only for grouped any-mode items', () => {
  assert.equal(itemCap({ requiredAmount: 1, group: 'Ahrim' }, 'any', 2), 2);
  assert.equal(itemCap({ requiredAmount: 1, group: 'Ahrim' }, 'all', 2), 1);
  assert.equal(itemCap({ requiredAmount: 3, group: null }, 'any', 2), 3, 'always-required items are needed once');
  assert.equal(itemCap({ requiredAmount: 1, group: 'Ahrim' }, 'any', null), 1);
});

test('howItCounts spells out each item mode', () => {
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 3, poolSize: 5 })!, /3 drops of any items.*repeats count/);
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 3, poolSize: 5, countMode: 'distinct' })!, /3 DIFFERENT items.*doesn’t count/);
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 2, poolSize: 1 })!, /Get 2 of the item/);
  const flat = [item('a', 0), item('b', 0)];
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 2, itemRequirements: flat })!, /EVERY item below — one of each/);
  const sets = barrows({});
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 4, itemRequirements: sets })!, /ANY ONE set below — all 4 pieces of the SAME set\. Pieces from different sets don’t mix/);
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 8, itemRequirements: sets, setsRequired: 2 })!, /Complete 2 sets — each one needs all 4 pieces.*Ahrim \+ Dharok, or Ahrim twice/);
  assert.match(howItCounts({ tileType: 'drop', requiredAmount: 8, itemRequirements: sets, groupMode: 'all' })!, /EVERY set below in full/);
  assert.equal(howItCounts({ tileType: 'kill', requiredAmount: 5 }), null);
});
