import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceGraph, rankRaceTeams } from '../src/lib/raceRoutes.ts';

// Step 1: tile 1. Step 2: tiles 2 and 3 (either leads on). Step 3: tile 4.
const graph = raceGraph([
  { id: 1, position: 0, raceStep: 0, raceNext: [2, 3] },
  { id: 2, position: 1, raceStep: 1, raceNext: [4] },
  { id: 3, position: 2, raceStep: 1, raceNext: [4] },
  { id: 4, position: 3, raceStep: 2, raceNext: [] },
] as never);
const at = (h: number) => `2026-11-17 ${String(h).padStart(2, '0')}:00:00`;

test('going back for an earlier tile does not move when a team reached its furthest step', () => {
  const teams = [{ id: 1, name: 'Zed' }, { id: 2, name: 'Abe' }];
  const done = [
    // Zed reaches step 3 at 12:00, then goes back and finishes the other step-2 tile at 20:00.
    { teamId: 1, tileId: 1, completedAt: at(9) },
    { teamId: 1, tileId: 2, completedAt: at(10) },
    { teamId: 1, tileId: 4, completedAt: at(12) },
    { teamId: 1, tileId: 3, completedAt: at(20) },
    // Abe reaches step 3 at 13:00.
    { teamId: 2, tileId: 1, completedAt: at(9) },
    { teamId: 2, tileId: 3, completedAt: at(11) },
    { teamId: 2, tileId: 4, completedAt: at(13) },
  ];
  const r = rankRaceTeams(graph, teams, done);
  assert.deepEqual(r.map((x) => [x.teamId, x.rank]), [[1, 1], [2, 2]]);
  assert.equal(r[0].reachedAt, at(12));
});

test('a second tile on the furthest step does not reset the clock either', () => {
  const teams = [{ id: 1, name: 'Zed' }, { id: 2, name: 'Abe' }];
  const done = [
    // Zed is on step 2 since 10:00, and finishes the other step-2 tile at 16:00.
    { teamId: 1, tileId: 1, completedAt: at(9) },
    { teamId: 1, tileId: 2, completedAt: at(10) },
    { teamId: 1, tileId: 3, completedAt: at(16) },
    // Abe reaches step 2 at 11:00.
    { teamId: 2, tileId: 1, completedAt: at(9) },
    { teamId: 2, tileId: 3, completedAt: at(11) },
  ];
  const r = rankRaceTeams(graph, teams, done);
  assert.deepEqual(r.map((x) => x.teamId), [1, 2]);
  assert.equal(r[0].reachedAt, at(10));
});

test('same step: the one who got there first is ahead, whatever the names', () => {
  // The case from the race itself: both on step 2, "1p Sweet" sorts before "Steeldeck" by name.
  const teams = [{ id: 1, name: '1p Sweet' }, { id: 2, name: 'Steeldeck' }];
  const done = [
    { teamId: 1, tileId: 1, completedAt: at(9) },
    { teamId: 1, tileId: 2, completedAt: at(16) },
    { teamId: 2, tileId: 1, completedAt: at(9) },
    { teamId: 2, tileId: 2, completedAt: at(11) },
  ];
  assert.deepEqual(rankRaceTeams(graph, teams, done).map((x) => x.teamId), [2, 1]);
});
