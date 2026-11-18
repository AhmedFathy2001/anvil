import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closestToDone, lineNotes, ordinal, teamStanding } from '../src/lib/yourTeam.ts';

const teams = [
  { id: 1, name: 'Blue' },
  { id: 2, name: 'Red' },
  { id: 3, name: 'Gold' },
];
const scores = (m: Record<number, number>) => (id: number) => m[id] ?? 0;

test('ordinal handles the teens', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd', '111th']);
});

test('no gap is worded before anyone scores', () => {
  assert.deepEqual(teamStanding(teams, scores({}), 2, false), { rank: 1, of: 3, gap: null });
});

test('the leader alone is in the lead', () => {
  assert.deepEqual(teamStanding(teams, scores({ 1: 4, 2: 6, 3: 1 }), 2, false), { rank: 1, of: 3, gap: 'In the lead' });
});

test('level teams share a place and name each other', () => {
  assert.deepEqual(teamStanding(teams, scores({ 1: 6, 2: 6, 3: 5 }), 2, false), { rank: 1, of: 3, gap: 'Level with Blue' });
});

test('the gap is to the team directly above, in points on a points board', () => {
  assert.deepEqual(teamStanding(teams, scores({ 1: 24, 2: 2, 3: 22 }), 2, true), { rank: 3, of: 3, gap: '20 pts behind Gold' });
  assert.equal(teamStanding(teams, scores({ 1: 6, 2: 5 }), 2, false)?.gap, '1 behind Blue');
});

test('a team that is not on the board has no standing', () => {
  assert.equal(teamStanding(teams, scores({}), 9, false), null);
});

test('closest to done leaves out untouched and finished tiles', () => {
  const picked = closestToDone([
    { id: 1, current: 0, goal: 100 },
    { id: 2, current: 74, goal: 100 },
    { id: 3, current: 44, goal: 50 },
    { id: 4, current: 50, goal: 50 },
    { id: 5, current: 15, goal: 25 },
    { id: 6, current: 1, goal: 25 },
  ]);
  assert.deepEqual(picked.map((t) => t.id), [3, 2, 5]);
});

test('a tile that finishes a line says so, even when it also helps another', () => {
  const notes = lineNotes([
    { line: { name: 'Row 2' }, missing: [7, 9] },
    { line: { name: 'Column 3' }, missing: [7] },
  ]);
  assert.equal(notes.get(7), 'Finishes column 3');
  assert.equal(notes.get(9), 'Row 2 needs this and one more');
});
