import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMemberBreakdown, computeIndividualStandings, teamEstimate } from '../src/lib/memberBreakdown.ts';

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

test('open tiles estimate points off the share of the GOAL, not of the team progress', () => {
  const rows = computeMemberBreakdown({
    teamId: 10,
    scoringMode: 'points',
    players,
    tiles: [
      { id: 200, label: '10M XP', points: 400, optional: 0, trackedStat: 'slayer', statType: 'skill', statGoal: 10_000_000 },
      { id: 201, label: '500 kills', points: 50, optional: 0, tileType: 'kill', requiredAmount: 500 },
      { id: 202, label: 'One big haul', points: 30, optional: 0, tileType: 'value', requiredAmount: 50_000_000 },
    ],
    completions: [],
    submissions: [
      { tileId: 201, teamId: 10, creditPlayerId: 2, amount: 250 },
      { tileId: 202, teamId: 10, creditPlayerId: 2, amount: 20_000_000 },
    ],
    statGains: { 200: [{ playerId: 1, gained: 10 }, { playerId: 2, gained: 4_000_000 }] },
  });
  const a = rows.find((r) => r.playerId === 1)!;
  const b = rows.find((r) => r.playerId === 2)!;
  // 10 XP alone on a 10M tile is worth nothing, even though it's "all" of player 1's tile work.
  assert.equal(a.estPoints, 0);
  // 4M/10M of 400 + 250/500 of 50; a single haul short of the bar estimates nothing.
  assert.equal(b.estPoints, 185);
  assert.equal(b.contributions.find((c) => c.tileId === 202)?.estPoints, 0);
  assert.equal(b.points, 0);
});

test('no estimate on finished tiles or outside points mode', () => {
  const args = {
    teamId: 10,
    players,
    tiles: [{ id: 300, label: 'Kills', points: 50, optional: 0, tileType: 'kill', requiredAmount: 10 }],
    submissions: [{ tileId: 300, teamId: 10, creditPlayerId: 1, amount: 10 }],
  };
  const done = computeMemberBreakdown({ ...args, scoringMode: 'points', completions: [{ teamId: 10, tileId: 300 }] });
  assert.equal(done.find((r) => r.playerId === 1)?.estPoints, 0);
  assert.equal(done.find((r) => r.playerId === 1)?.points, 50);
  const classic = computeMemberBreakdown({ ...args, scoringMode: 'classic', completions: [] });
  assert.equal(classic.find((r) => r.playerId === 1)?.estPoints, 0);
});

test('the team estimate sums members per tile, capped at each tile’s points', () => {
  const rows = computeMemberBreakdown({
    teamId: 10,
    scoringMode: 'points',
    players,
    tiles: [
      { id: 400, label: 'Each of you: 100 kills', points: 50, optional: 0, tileType: 'kill', requiredAmount: 100 },
      { id: 401, label: '10M XP', points: 400, optional: 0, trackedStat: 'slayer', statType: 'skill', statGoal: 10_000_000 },
    ],
    completions: [],
    submissions: [
      { tileId: 400, teamId: 10, creditPlayerId: 1, amount: 80 },
      { tileId: 400, teamId: 10, creditPlayerId: 2, amount: 70 },
    ],
    statGains: { 401: [{ playerId: 1, gained: 1_000_000 }] },
  });
  // 40 + 35 on a 50-pt tile caps at 50; plus 1M/10M of 400.
  assert.equal(teamEstimate(rows), 90);
});
