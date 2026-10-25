// The plugin's pinned tile tracker: one tile's progress for every team, top contributors first.
//
// Run: npx tsx --test tests/tile-tracker.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { collectionTileTeams, countTileTeams, statTileTeams, TRACKER_TOP_MEMBERS, type TrackerInput } from '../src/lib/tileTracker';

const input = (over: Partial<TrackerInput> = {}): TrackerInput => ({
  teams: [
    { teamId: 1, name: 'Red', color: '#f00' },
    { teamId: 2, name: 'Blue', color: null },
  ],
  trackingMode: 'team',
  completedTeamIds: new Set(),
  viewerTeamId: 2,
  viewerPlayerId: 20,
  names: new Map([[10, 'Alice'], [11, 'Bob'], [20, 'Me'], [21, 'Cat']]),
  ...over,
});

test('count tile sums each team and puts the viewer team first', () => {
  const out = countTileTeams(input(), [
    { teamId: 1, playerId: 10, amount: 5 },
    { teamId: 1, playerId: 11, amount: 4 },
    { teamId: 2, playerId: 20, amount: 2 },
    { teamId: 2, playerId: 21, creditPlayerId: 20, amount: 1 },
  ]);
  assert.deepEqual(out.map((t) => [t.name, t.current, t.mine]), [['Blue', 3, true], ['Red', 9, false]]);
  assert.deepEqual(out[0].members, [{ name: 'Me', amount: 3, mine: true }]);
  assert.deepEqual(out[1].members.map((m) => m.name), ['Alice', 'Bob']);
});

test('solo count tile reports the best single member', () => {
  const out = countTileTeams(input({ trackingMode: 'individual', viewerTeamId: null }), [
    { teamId: 1, playerId: 10, amount: 5 },
    { teamId: 1, playerId: 11, amount: 4 },
  ]);
  assert.equal(out.find((t) => t.teamId === 1)!.current, 5);
  assert.equal(out.find((t) => t.teamId === 2)!.current, 0);
});

test('unattributed uploads show as a staff line, completions are flagged', () => {
  const out = countTileTeams(input({ completedTeamIds: new Set([1]) }), [{ teamId: 1, playerId: null, amount: 2 }]);
  const red = out.find((t) => t.teamId === 1)!;
  assert.equal(red.complete, true);
  assert.deepEqual(red.members, [{ name: 'Staff upload', amount: 2, mine: false }]);
});

test('the viewer keeps their line beyond the top members', () => {
  const names = new Map<number, string>();
  const subs = [];
  for (let i = 1; i <= TRACKER_TOP_MEMBERS + 2; i++) {
    names.set(i, `P${i}`);
    subs.push({ teamId: 2, playerId: i, amount: 100 - i });
  }
  names.set(20, 'Me');
  subs.push({ teamId: 2, playerId: 20, amount: 1 });
  const blue = countTileTeams(input({ names }), subs).find((t) => t.mine)!;
  assert.equal(blue.members.length, TRACKER_TOP_MEMBERS + 1);
  assert.deepEqual(blue.members.at(-1), { name: 'Me', amount: 1, mine: true });
});

test('stat tile sums gains, or takes the best on a solo tile', () => {
  const players = [
    { playerId: 10, teamId: 1, gained: 3 },
    { playerId: 11, teamId: 1, gained: 7 },
    { playerId: 20, teamId: 2, gained: 0 },
  ];
  assert.equal(statTileTeams(input(), players).find((t) => t.teamId === 1)!.current, 10);
  assert.equal(statTileTeams(input({ trackingMode: 'solo' }), players).find((t) => t.teamId === 1)!.current, 7);
  assert.deepEqual(statTileTeams(input(), players).find((t) => t.teamId === 2)!.members, []);
});

test('a set tile counts pieces toward the set, not submissions against requiredAmount', () => {
  const voidwaker = [
    { itemId: 1, requiredAmount: 1 },
    { itemId: 2, requiredAmount: 1 },
    { itemId: 3, requiredAmount: 1 },
  ];
  const out = collectionTileTeams(input(), [{ teamId: 2, playerId: 20, amount: 1, itemId: 2 }], voidwaker, null, 1);
  assert.equal(out.goal, 3);
  assert.deepEqual(out.teams.map((t) => [t.name, t.current]), [['Blue', 1], ['Red', 0]]);
});

test('an any-of-these-sets tile shows the closest set, and a stray piece of another set does not add', () => {
  const set = (g: string, base: number) => [0, 1, 2, 3].map((i) => ({ itemId: base + i, requiredAmount: 1, group: g }));
  const barrows = [...set('Ahrim', 10), ...set('Verac', 20)];
  const out = collectionTileTeams(input(), [
    { teamId: 1, playerId: 10, amount: 1, itemId: 20 },
    { teamId: 1, playerId: 11, amount: 1, itemId: 22 },
    { teamId: 1, playerId: 11, amount: 1, itemId: 10 },
  ], barrows, 'any', 1);
  assert.equal(out.goal, 4);
  assert.equal(out.teams.find((t) => t.name === 'Red')!.current, 2);
});
