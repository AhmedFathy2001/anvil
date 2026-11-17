// A road saved unfinished before the start (lib/raceRoutes routeStamp, roadBlockers; lib/eventReadiness). Pure.
//
// Run: npx tsx --test tests/race-road-drafts.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roadBlockers, routeStamp, validateRoute, type RouteEntry } from '../src/lib/raceRoutes.ts';
import { computeStartReadiness, describeStartBlockers } from '../src/lib/eventReadiness.ts';

const road: RouteEntry[] = [
  { id: 1, step: 0, next: [2, 3] },
  { id: 2, step: 1, next: [4] },
  { id: 3, step: 1, next: [4] },
  { id: 4, step: 2, next: [] },
];

test('the stamp is the same road whatever order it is listed in, and changes when a road or a step does', () => {
  const shuffled = [road[2], road[0], road[3], { ...road[1] }];
  assert.equal(routeStamp(shuffled), routeStamp(road));
  assert.equal(routeStamp([{ id: 1, step: 0, next: [3, 2] }, ...road.slice(1)]), routeStamp(road), 'link order does not matter');
  assert.notEqual(routeStamp([{ id: 1, step: 0, next: [2] }, ...road.slice(1)]), routeStamp(road));
  assert.notEqual(routeStamp([...road.slice(0, 3), { id: 4, step: null, next: [] }]), routeStamp(road));
});

test('a tile nobody placed, or a link to a tile that is gone, does not stop a race; a dead end does', () => {
  assert.deepEqual(roadBlockers(road), []);
  // Tiles 11 to 13 added from the list and never placed.
  const withLoose = [...road, { id: 11, step: null, next: [] }, { id: 12, step: null, next: [] }];
  assert.equal(validateRoute(withLoose).length, 2, 'the editor still lists them');
  assert.deepEqual(roadBlockers(withLoose), []);
  // A link to a tile that was deleted.
  assert.deepEqual(roadBlockers([{ id: 1, step: 0, next: [2, 3, 99] }, ...road.slice(1)]), []);
  // Tile 3 leads nowhere: a team that took that road could never finish.
  const deadEnd = [road[0], road[1], { id: 3, step: 1, next: [] }, road[3]];
  assert.ok(roadBlockers(deadEnd).length > 0);
  // A step with nothing on it.
  assert.ok(roadBlockers([{ id: 1, step: 0, next: [] }, { id: 4, step: 2, next: [] }]).length > 0);
});

test('an unfinished road holds the start, and says where to fix it', () => {
  const base = { draftStatus: 'none', teamCount: 3, assignedPlayerCount: 6, totalPlayerCount: 6 };
  assert.equal(computeStartReadiness(base).ready, true);
  assert.equal(computeStartReadiness({ ...base, raceRoadProblems: 0 }).ready, true);
  const held = computeStartReadiness({ ...base, raceRoadProblems: 2 });
  assert.deepEqual(held.blockers, ['race-road']);
  assert.match(describeStartBlockers(held.blockers), /road map is not finished/);
});
