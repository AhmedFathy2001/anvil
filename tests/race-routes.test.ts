import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRouteTemplate,
  canCreditRaceTile,
  canUndoRaceTile,
  isBranchingRoute,
  moveTileToStep,
  raceGraph,
  rankRaceTeams,
  removeStep,
  swapSteps,
  insertStep,
  teamRoute,
  toggleRouteLink,
  validateRoute,
  routeEntries,
  type RouteEntry,
} from '../src/lib/raceRoutes.ts';
import { scoreTeams } from '../src/lib/boardScoring.ts';

// A straight line: no steps stored anywhere.
const line = [1, 2, 3, 4].map((id, i) => ({ id, position: i }));

// A route with a split, a junction and two ends:
//   step 0: 10, 11       (two starts)
//   step 1: 20           (merge/junction: from 10 and 11, leads to 30 and 31)
//   step 2: 30, 31       (split)
//   step 3: 40, 41       (ends; 30 -> 40, 31 -> 40 and 41)
const branch = [
  { id: 10, position: 0, raceStep: 0, raceNext: [20] },
  { id: 11, position: 1, raceStep: 0, raceNext: [20] },
  { id: 20, position: 2, raceStep: 1, raceNext: [30, 31] },
  { id: 30, position: 3, raceStep: 2, raceNext: [40] },
  { id: 31, position: 4, raceStep: 2, raceNext: [40, 41] },
  { id: 40, position: 5, raceStep: 3, raceNext: [] },
  { id: 41, position: 6, raceStep: 3, raceNext: [] },
  // A mission and a combo part never sit on the route.
  { id: 99, position: 7, mission: 1 },
  { id: 98, position: 2, parentTileId: 20 },
];

test('a board with no steps is the classic straight line', () => {
  assert.equal(isBranchingRoute(line), false);
  const g = raceGraph(line);
  assert.deepEqual(g.nodes.map((n) => [n.step, n.next]), [[0, [2]], [1, [3]], [2, [4]], [3, []]]);
  const r = teamRoute(g, [1, 2]);
  assert.deepEqual(r.path, [1, 2]);
  assert.deepEqual(r.open, [3]);
  assert.equal(r.state.get(4), 'ahead');
  // The old guard: only the next tile credits, only the furthest undoes.
  assert.equal(canCreditRaceTile(g, [1, 2], 3), true);
  assert.equal(canCreditRaceTile(g, [1, 2], 4), false);
  assert.equal(canUndoRaceTile(g, [1, 2], 1), false);
  assert.equal(canUndoRaceTile(g, [1, 2], 2), true);
});

test('every start is open before a team finishes anything', () => {
  const g = raceGraph(branch);
  assert.equal(g.branching, true);
  assert.equal(g.lastStep, 3);
  const r = teamRoute(g, []);
  assert.deepEqual(r.open, [10, 11]);
  assert.equal(r.stepsDone, 0);
  assert.equal(r.state.get(41), 'ahead');
});

test('finishing a tile commits the team and closes the other options at that step', () => {
  const g = raceGraph(branch);
  const r = teamRoute(g, [11]);
  assert.deepEqual(r.path, [11]);
  assert.deepEqual(r.open, [20]);
  assert.equal(r.state.get(10), 'closed');
  assert.equal(canCreditRaceTile(g, [11], 10), false);

  const r2 = teamRoute(g, [11, 20, 30]);
  assert.deepEqual(r2.open, [40]);
  // 31 closed (passed up), and 41 is only reachable from 31, so it closes too.
  assert.equal(r2.state.get(31), 'closed');
  assert.equal(r2.state.get(41), 'closed');
  assert.equal(canCreditRaceTile(g, [11, 20, 30], 41), false);
  assert.equal(canCreditRaceTile(g, [11, 20, 30], 40), true);
});

test('a junction lets a team switch lanes: every link out of it is open', () => {
  const g = raceGraph(branch);
  assert.deepEqual(teamRoute(g, [10, 20]).open, [30, 31]);
  assert.deepEqual(teamRoute(g, [10, 20, 31]).open, [40, 41]);
});

test('locked tiles ahead never credit; missions are not the race guard’s to refuse', () => {
  const g = raceGraph(branch);
  assert.equal(canCreditRaceTile(g, [], 20), false);
  assert.equal(canCreditRaceTile(g, [], 40), false);
  assert.equal(canCreditRaceTile(g, [], 99), true);
});

test('two finished tiles at one step: the one with the most links carries the team', () => {
  const g = raceGraph(branch);
  // Admin finished both 30 and 31; 31 has two links, so it wins.
  const r = teamRoute(g, [10, 20, 30, 31]);
  assert.deepEqual(r.path, [10, 20, 31]);
  assert.deepEqual(r.open, [40, 41]);
  // Both stay done.
  assert.equal(r.state.get(30), 'done');
});

test('finishing an end tile finishes the race', () => {
  const g = raceGraph(branch);
  const r = teamRoute(g, [10, 20, 31, 41]);
  assert.equal(r.finished, true);
  assert.equal(r.stepsDone, 4);
  assert.deepEqual(r.open, []);
});

test('ranking: first to an end wins, then steps done, then who got there first', () => {
  const g = raceGraph(branch);
  const teams = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }];
  const c = (teamId: number, tileId: number, at: string) => ({ teamId, tileId, completedAt: at });
  const done = [
    // A: two steps, reached at 10:00
    c(1, 10, '2026-11-01 09:00:00'), c(1, 20, '2026-11-01 10:00:00'),
    // B: finished at 12:00
    c(2, 11, '2026-11-01 08:00:00'), c(2, 20, '2026-11-01 09:00:00'), c(2, 30, '2026-11-01 11:00:00'), c(2, 40, '2026-11-01 12:00:00'),
    // C: two steps, reached at 09:30 — ahead of A on time
    c(3, 10, '2026-11-01 09:00:00'), c(3, 20, '2026-11-01 09:30:00'),
  ];
  const ranked = rankRaceTeams(g, teams, done);
  assert.deepEqual(ranked.map((r) => r.teamId), [2, 3, 1, 4]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3, 4]);
  assert.equal(ranked[0].finished, true);
  assert.equal(ranked[3].stepsDone, 0);
});

test('scoring: a branching race scores steps out of the step count', () => {
  const scored = scoreTeams({
    scoringMode: 'tiles',
    tiles: branch,
    completions: [{ teamId: 1, tileId: 10 }, { teamId: 1, tileId: 20 }, { teamId: 1, tileId: 99 }],
    teams: [{ id: 1 }],
  });
  assert.equal(scored[0].total, 4);
  assert.equal(scored[0].boardScore, 2);
  assert.equal(scored[0].pct, 50);
  // A straight line is still counted in tiles.
  const flat = scoreTeams({ scoringMode: 'tiles', tiles: line, completions: [{ teamId: 1, tileId: 1 }], teams: [{ id: 1 }] });
  assert.equal(flat[0].total, 4);
  assert.equal(flat[0].boardScore, 1);
});

test('validation names what is wrong and passes a good route', () => {
  assert.deepEqual(validateRoute(routeEntries(branch)), []);
  const bad: RouteEntry[] = [
    { id: 1, step: 0, next: [3] }, // skips a step
    { id: 2, step: 0, next: [] }, // leads nowhere
    { id: 3, step: 2, next: [] }, // unreachable via valid links; step 1 empty
    { id: 4, step: null, next: [] }, // unplaced
  ];
  const msgs = validateRoute(bad).map((p) => p.message);
  assert.ok(msgs.some((m) => m.includes('Tile 4') && m.includes('step')));
  assert.ok(msgs.some((m) => m.includes('Step 2 has no tiles')));
  assert.ok(msgs.some((m) => m.includes('Tile 1 links to Tile 3')));
  assert.ok(msgs.some((m) => m.includes('Tile 2 leads nowhere')));
  assert.ok(msgs.some((m) => m.includes("Tile 3 can't be reached")));
});

test('templates produce valid routes for many sizes', () => {
  for (const kind of ['line', 'lanes2', 'braid3', 'diamond'] as const) {
    for (let n = 1; n <= 14; n++) {
      const ids = Array.from({ length: n }, (_, i) => i + 1);
      const route = applyRouteTemplate(kind, ids);
      assert.equal(route.length, n, `${kind} ${n}`);
      assert.deepEqual(validateRoute(route), [], `${kind} ${n}`);
    }
  }
  // Braid: lanes swap out of odd steps only.
  const braid = applyRouteTemplate('braid3', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(braid.find((e) => e.id === 2)!.next, [5]);
  assert.deepEqual([...braid.find((e) => e.id === 5)!.next].sort(), [7, 8, 9]);
  // Diamond: one start, one end.
  const d = applyRouteTemplate('diamond', [1, 2, 3, 4, 5, 6]);
  assert.equal(d.filter((e) => e.step === 0).length, 1);
  assert.equal(d.filter((e) => e.step === Math.max(...d.map((x) => x.step!))).length, 1);
  // Free: placed, unlinked — validation asks for the links.
  assert.ok(validateRoute(applyRouteTemplate('free', [1, 2, 3])).length > 0);
});

test('editor helpers: toggle links, move tiles, add/remove/swap steps drop broken links', () => {
  let r = applyRouteTemplate('line', [1, 2, 3]);
  r = toggleRouteLink(r, 2, 1); // either click order links forward
  assert.deepEqual(r.find((e) => e.id === 1)!.next, []);
  r = toggleRouteLink(r, 1, 2);
  assert.deepEqual(r.find((e) => e.id === 1)!.next, [2]);
  assert.deepEqual(toggleRouteLink(r, 1, 3), r); // not adjacent steps: no-op

  const moved = moveTileToStep(r, 3, 1);
  assert.equal(moved.dropped, 1); // 2 -> 3 no longer runs forward
  assert.equal(moved.entries.find((e) => e.id === 3)!.step, 1);

  const inserted = insertStep(applyRouteTemplate('line', [1, 2, 3]), 1);
  assert.deepEqual(inserted.map((e) => e.step), [0, 2, 3]);
  assert.deepEqual(inserted.find((e) => e.id === 1)!.next, []);

  const removed = removeStep(applyRouteTemplate('line', [1, 2, 3]), 1);
  assert.equal(removed.entries.find((e) => e.id === 2)!.step, null);
  assert.equal(removed.entries.find((e) => e.id === 3)!.step, 1);

  const swapped = swapSteps(applyRouteTemplate('line', [1, 2, 3]), 0, 1);
  assert.equal(swapped.entries.find((e) => e.id === 1)!.step, 1);
  assert.ok(swapped.dropped > 0);
});
