import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMemberBreakdown, computeIndividualStandings } from '../src/lib/memberBreakdown.ts';

// Two people on one team, plus a one-person team — the shape a ladder actually runs (every
// competitor enrolled as their own team) next to the shape a bingo runs.
const players = [
  { id: 1, name: 'Ember A', teamId: 10 },
  { id: 2, name: 'Ember B', teamId: 10 },
  { id: 3, name: 'Solo', teamId: 20 },
];
const tiles = [
  { id: 100, label: 'Drop tile', points: 60, optional: 0 },
  { id: 101, label: 'Manual tile', points: 40, optional: 0 },
];
const teams = [
  { id: 10, name: 'Ember', color: '#e0603f' },
  { id: 20, name: 'Solo', color: '#4aa3d4' },
];

test('submission amounts still decide the split when they exist', () => {
  const rows = computeMemberBreakdown({
    teamId: 10,
    scoringMode: 'points',
    players,
    tiles,
    completions: [{ teamId: 10, tileId: 100 }],
    submissions: [
      { tileId: 100, teamId: 10, creditPlayerId: 1, amount: 3 },
      { tileId: 100, teamId: 10, creditPlayerId: 2, amount: 1 },
    ],
  });
  assert.equal(rows.find((r) => r.playerId === 1)?.points, 45);
  assert.equal(rows.find((r) => r.playerId === 2)?.points, 15);
});

test('a completion the engine credited to one player scores for them without a submission', () => {
  const rows = computeMemberBreakdown({
    teamId: 10,
    scoringMode: 'points',
    players,
    tiles,
    completions: [
      { teamId: 10, tileId: 101, creditPlayerId: 2 },
    ],
    submissions: [],
  });
  assert.equal(rows.find((r) => r.playerId === 2)?.points, 40);
  assert.equal(rows.find((r) => r.playerId === 2)?.tasks, 1);
  assert.equal(rows.find((r) => r.playerId === 1)?.points, 0);
});

test('on a one-person team the person IS the team, credited or not', () => {
  const rows = computeMemberBreakdown({
    teamId: 20,
    scoringMode: 'points',
    players,
    tiles,
    completions: [{ teamId: 20, tileId: 101 }],
    submissions: [],
  });
  assert.equal(rows[0].points, 40);
  assert.equal(rows[0].tasks, 1);
});

test('a multi-person team effort with no per-member signal stays unattributed', () => {
  const rows = computeMemberBreakdown({
    teamId: 10,
    scoringMode: 'points',
    players,
    tiles,
    completions: [{ teamId: 10, tileId: 101 }],
    submissions: [],
  });
  assert.equal(rows.reduce((s, r) => s + r.points, 0), 0);
});

test('the ladder board therefore adds up to what each solo team scored', () => {
  const standings = computeIndividualStandings({
    scoringMode: 'points',
    teams,
    players,
    tiles,
    completions: [
      { teamId: 20, tileId: 100 },
      { teamId: 20, tileId: 101 },
    ],
    submissions: [],
  });
  const solo = standings.find((r) => r.playerId === 3);
  assert.equal(solo?.points, 100);
  assert.equal(solo?.tasks, 2);
});
