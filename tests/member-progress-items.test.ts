// The item-by-item lists behind the progress counters (lib/memberProgressItems): what a push may
// say, and what a browser shows.
//
// Run: node --experimental-strip-types --test tests/member-progress-items.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  combatTaskVarps,
  completedTasksFromVarps,
  decodeCombatTasks,
  decodeCompletedTaskIds,
} from '../src/lib/combatTasks.ts';
import {
  cleanItems,
  countDone,
  filterItems,
  isItemCategory,
  itemGroups,
  parseItems,
  serializeItems,
  type ProgressItem,
} from '../src/lib/memberProgressItems.ts';

const QUESTS: ProgressItem[] = [
  { id: 1, name: 'Cook\'s Assistant', state: 2, group: 'Novice' },
  { id: 2, name: 'Dragon Slayer II', state: 0, group: 'Grandmaster' },
  { id: 3, name: 'Monkey Madness II', state: 1, group: 'Master' },
  { id: 4, name: 'Recipe for Disaster', state: 0, group: 'Grandmaster' },
];

test('cleanItems: drops the bad rows one at a time, never the whole list', () => {
  const clean = cleanItems([
    { id: 1, name: 'Cook\'s Assistant', state: 2 },
    { id: 1, name: 'A duplicate id', state: 0 },   // same id twice
    { id: 2, name: '', state: 0 },                  // no name
    { id: -3, name: 'Negative', state: 0 },         // impossible id
    { id: 4, name: 'Bad state', state: 9 },         // outside the three states
    'not an object',
    { id: 5, name: 'Fine', state: 1, group: 'Master' },
  ]);
  assert.deepEqual(clean.map((i) => i.name), ["Cook's Assistant", 'Fine']);
  assert.equal(clean[1].group, 'Master');
  assert.equal(cleanItems(null).length, 0);
});

test('serialize/parse: a stored payload round-trips, name-sorted so it is diffable', () => {
  const payload = serializeItems(QUESTS);
  assert.deepEqual(JSON.parse(payload).items.map((i: ProgressItem) => i.name), [
    "Cook's Assistant", 'Dragon Slayer II', 'Monkey Madness II', 'Recipe for Disaster',
  ]);
  assert.equal(parseItems(payload).length, 4);
  // Anything unreadable is an empty list rather than a crash on a profile page.
  assert.deepEqual(parseItems('not json'), []);
  assert.deepEqual(parseItems(null), []);
  assert.equal(countDone(QUESTS), 1);
});

test('filterItems: what is LEFT comes first, because that is the question', () => {
  const all = filterItems(QUESTS, { filter: 'all' });
  assert.deepEqual(all.map((i) => i.name), [
    'Dragon Slayer II', 'Recipe for Disaster',  // not started
    'Monkey Madness II',                        // in progress
    "Cook's Assistant",                         // finished, last
  ]);
  assert.deepEqual(filterItems(QUESTS, { filter: 'done' }).map((i) => i.name), ["Cook's Assistant"]);
  assert.deepEqual(filterItems(QUESTS, { filter: 'started' }).map((i) => i.name), ['Monkey Madness II']);
  assert.equal(filterItems(QUESTS, { filter: 'todo' }).length, 3);
});

test('filterItems: search and category narrow together', () => {
  assert.deepEqual(filterItems(QUESTS, { search: 'dragon' }).map((i) => i.name), ['Dragon Slayer II']);
  // Case and partial words both work — nobody types a quest name exactly.
  assert.equal(filterItems(QUESTS, { search: 'MADNESS' }).length, 1);
  assert.deepEqual(filterItems(QUESTS, { group: 'Grandmaster' }).map((i) => i.name), [
    'Dragon Slayer II', 'Recipe for Disaster',
  ]);
  // A search with nothing behind it is empty, not everything.
  assert.equal(filterItems(QUESTS, { search: 'zzz' }).length, 0);
  assert.deepEqual(itemGroups(QUESTS), ['Grandmaster', 'Master', 'Novice']);
});

test('isItemCategory: only the two we store', () => {
  assert.equal(isItemCategory('quest'), true);
  assert.equal(isItemCategory('ca'), true);
  assert.equal(isItemCategory('diary'), false);
  assert.equal(isItemCategory(7), false);
});

test('combat tasks: the bits decode to task ids, in the published varp order', () => {
  const varps = combatTaskVarps();
  assert.ok(varps.length >= 20, 'the varp list should cover every task slot');

  // Task 0 is bit 0 of the first varp; task 33 is bit 1 of the second.
  const done = decodeCompletedTaskIds({ [String(varps[0])]: 0b101, [String(varps[1])]: 0b10 });
  assert.deepEqual([...done].sort((a, b) => a - b), [0, 2, 33]);

  // A varp we weren't told about can't shift the others along.
  assert.equal(decodeCompletedTaskIds({ '999999': 0xff }).size, 0);
  assert.equal(decodeCompletedTaskIds(null).size, 0);

  // The top bit is a bit, not a sign: varps are signed 32-bit and bit 31 must still read as task 31.
  assert.ok(decodeCompletedTaskIds({ [String(varps[0])]: -2147483648 }).has(31));
});

test('combat tasks: a decode that does not reconcile is thrown away, not stored', () => {
  const varps = combatTaskVarps();
  // Task 0 is "Noxious Foe", an Easy task worth 1 point.
  const oneEasy = { [String(varps[0])]: 0b1 };
  const accepted = completedTasksFromVarps(oneEasy, 1);
  assert.equal(accepted?.length, 1);
  assert.equal(accepted?.[0].state, 2);

  // The same bits against a total that says otherwise: the layout moved, so we know nothing.
  assert.equal(completedTasksFromVarps(oneEasy, 1472), null);
  // No bits at all, or no total to check against, is also "we don't know" — never "none done".
  assert.equal(completedTasksFromVarps({}, 100), null);
  assert.equal(completedTasksFromVarps(oneEasy, 0), null);
});

test('combat tasks: a task the catalogue is too old to know still lets the rest through', () => {
  const varps = combatTaskVarps();
  // Task 0 (Easy, 1 point) plus a bit far past anything the wiki has dumped yet.
  const withUnknown = { [String(varps[0])]: 0b1, [String(varps[20])]: 1 << 31 };

  // The unknown task is worth SOMETHING between 1 and 6, so a total inside that window reconciles.
  const low = decodeCombatTasks(withUnknown, 1 + 1);
  assert.equal(low.unknownTasks, 1);
  assert.equal(low.items?.length, 1, 'the task we do know is still stored');
  assert.equal(decodeCombatTasks(withUnknown, 1 + 6).items?.length, 1);

  // Outside the window it's a misaligned layout again, and nothing is stored.
  assert.equal(decodeCombatTasks(withUnknown, 1 + 7).items, null);
  assert.equal(decodeCombatTasks(withUnknown, 1472).items, null);

  // With nothing unknown the window is a single number — the original exact check, unchanged.
  const known = { [String(varps[0])]: 0b1 };
  assert.equal(decodeCombatTasks(known, 1).items?.length, 1);
  assert.equal(decodeCombatTasks(known, 2).items, null);
});
