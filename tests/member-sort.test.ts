// The members table's sort: every column both ways, rank by the clan's ladder, unknowns last.
//
// Run: npx tsx --test tests/member-sort.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortMembers } from '../src/lib/memberSort.ts';

const row = (id: number, rsn: string, o: Partial<{ rank: string | null; isGuest: boolean; ehp: number | null; ehb: number | null; overallXp: number | null }> = {}) => ({
  id, rsn, rank: null, isGuest: false, ehp: 0, ehb: 0, overallXp: 0, ...o,
});
const rows = [
  row(1, 'alpha', { rank: 'Recruit', ehp: 100, ehb: 5, overallXp: 10 }),
  row(2, 'bravo', { rank: 'Deputy_Owner', ehp: 300, ehb: null, overallXp: 30 }),
  row(3, 'charlie', { rank: 'Mystic', ehp: null, ehb: 50, overallXp: null }),
  row(4, 'delta', { isGuest: true, rank: 'Guest', ehp: 200, ehb: 1, overallXp: 20 }),
];
const ladder = ['owner', 'deputy owner', 'mystic', 'general', 'recruit'];
const names = (key: Parameters<typeof sortMembers>[1]['key'], desc: boolean) =>
  sortMembers(rows, { key, desc, movement: { 1: { week: 3 }, 2: { week: 9 } }, rankOrder: ladder }).map((r) => r.rsn);

test('rank sorts by the clan ladder, most senior first, guests last either way', () => {
  assert.deepEqual(names('rank', true), ['bravo', 'charlie', 'alpha', 'delta']);
  assert.deepEqual(names('rank', false), ['alpha', 'charlie', 'bravo', 'delta']);
});

test('numbers sort both ways with the unswept always last', () => {
  assert.deepEqual(names('ehp', true), ['bravo', 'delta', 'alpha', 'charlie']);
  assert.deepEqual(names('ehp', false), ['alpha', 'delta', 'bravo', 'charlie']);
  assert.deepEqual(names('ehb', true), ['charlie', 'alpha', 'delta', 'bravo']);
  assert.deepEqual(names('xp', false), ['alpha', 'delta', 'bravo', 'charlie']);
});

test('the week counts a quiet member as zero, not unknown', () => {
  assert.deepEqual(names('week', true).slice(0, 2), ['bravo', 'alpha']);
});

test('names go A→Z first, then Z→A', () => {
  assert.deepEqual(names('name', false), ['alpha', 'bravo', 'charlie', 'delta']);
  assert.deepEqual(names('name', true), ['delta', 'charlie', 'bravo', 'alpha']);
});

test('in-game rank numbers order custom titles exactly; titles without one follow the ladder', async () => {
  const { rankNumbersFrom, rankOrderWithNumbers, parseRankNumbers } = await import('../src/lib/rankRules.ts');
  const numbers = rankNumbersFrom([
    { rank: 'Commander', rankNum: 90 },
    { rank: 'Officer', rankNum: 40 },
    { rank: 'Recruit', rankNum: 0 },
    { rank: 'Deputy_Owner', rankNum: 125 },
    { rank: 'Imp', rankNum: 999 }, // out of range: ignored
    { rank: 'Marshal' }, // an older plugin: no number
  ]);
  assert.deepEqual(numbers, { commander: 90, officer: 40, recruit: 0, 'deputy owner': 125 });
  assert.deepEqual(parseRankNumbers(JSON.stringify(numbers)), numbers);
  assert.deepEqual(
    rankOrderWithNumbers(numbers, ['owner', 'deputy owner', 'recruit', 'marshal']),
    ['deputy owner', 'commander', 'officer', 'recruit', 'owner', 'marshal'],
  );
  const sorted = sortMembers(
    [row(1, 'a', { rank: 'Recruit' }), row(2, 'b', { rank: 'Officer' }), row(3, 'c', { rank: 'Commander' })],
    { key: 'rank', desc: true, movement: {}, rankOrder: rankOrderWithNumbers(numbers, []) },
  ).map((r) => r.rsn);
  assert.deepEqual(sorted, ['c', 'b', 'a']);
});

test('sorting by weekly streak: longest first, nobody-on-one last but still listed', async () => {
  const { sortMembers } = await import('../src/lib/memberSort.ts');
  const row = (id: number, rsn: string) => ({ id, rsn, rank: null, isGuest: false, ehp: 1, ehb: 0, overallXp: 1 });
  const out = sortMembers([row(1, 'A'), row(2, 'B'), row(3, 'C')], { key: 'streak', desc: true, movement: {}, rankOrder: [], streaks: { B: 9, C: 2 } });
  assert.deepEqual(out.map((r) => r.rsn), ['B', 'C', 'A']);
});
