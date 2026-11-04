// Lab tile controls, the pure half (lib/labTileProgress): where each tile kind keeps its progress,
// the rows that set it, the stat readings that set a gain, and how a lab stats push folds into a
// character's baseline and reading. No database.
//
// Run: npm run test:labtiles

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clampProgress,
  foldLabPush,
  MAX_ITEM_ROWS,
  progressGoal,
  progressRows,
  progressStore,
  reachesGoal,
  withStatProgress,
  type ControlTile,
  type Snapshot,
} from '../src/lib/labTileProgress.ts';
import { computeGain, milestoneState } from '../src/lib/statTracking.ts';

const tile = (over: Partial<ControlTile>): ControlTile => ({
  id: 1,
  tileType: 'standard',
  trackedStat: null,
  statType: null,
  statGoal: null,
  requiredAmount: null,
  itemRequirements: null,
  trackedItemIds: null,
  targetNpcs: null,
  countMode: null,
  timedActivity: null,
  timeThresholdSeconds: null,
  capBy: null,
  ...over,
});

test('each tile kind maps to the store its progress lives in', () => {
  assert.equal(progressStore(tile({ trackedStat: 'vorkath', statType: 'boss', statGoal: 10 })), 'stat');
  assert.equal(progressStore(tile({ tileType: 'standard' })), null);
  for (const kind of ['kill', 'lap', 'pvp', 'gain', 'deathless', 'diary', 'ca', 'lms', 'valuetotal']) {
    assert.equal(progressStore(tile({ tileType: kind, requiredAmount: 5 })), 'count', kind);
  }
  assert.equal(progressStore(tile({ tileType: 'kill' })), null, 'no goal, nothing to count toward');
  assert.equal(progressStore(tile({ tileType: 'drop', requiredAmount: 3 })), 'count');
  assert.equal(progressStore(tile({ tileType: 'drop', requiredAmount: 3, countMode: 'distinct' })), 'distinct');
  assert.equal(
    progressStore(tile({ tileType: 'drop', requiredAmount: 1, itemRequirements: '[{"itemId":1,"name":"x","requiredAmount":1}]' })),
    null,
    'a collection has per-item progress, not one number',
  );
  assert.equal(progressStore(tile({ tileType: 'value', requiredAmount: 1_000_000 })), 'best');
  assert.equal(progressStore(tile({ tileType: 'timed', timeThresholdSeconds: 60 })), 'fastest');
  assert.equal(progressStore(tile({ tileType: 'timed' })), null);
  assert.equal(progressStore(tile({ tileType: 'clog', requiredAmount: 3 })), 'slots');
  assert.equal(progressStore(tile({ tileType: 'combo' })), null);
});

test('the goal and when progress reaches it', () => {
  assert.equal(progressGoal(tile({ trackedStat: 'vorkath', statType: 'boss', statGoal: 10 }), 'stat'), 10);
  assert.equal(progressGoal(tile({ tileType: 'kill', requiredAmount: 25 }), 'count'), 25);
  assert.equal(progressGoal(tile({ tileType: 'timed', timeThresholdSeconds: 90 }), 'fastest'), 90);
  assert.equal(progressGoal(tile({ tileType: 'clog', requiredAmount: 4 }), 'slots'), 4);
  assert.equal(progressGoal(tile({}), null), null);

  assert.equal(reachesGoal('count', 9, 10), false);
  assert.equal(reachesGoal('count', 10, 10), true);
  assert.equal(reachesGoal('fastest', 85, 90), true, 'a timed run finishes under the cap');
  assert.equal(reachesGoal('fastest', 95, 90), false);
  assert.equal(reachesGoal('fastest', 0, 90), false, 'no run at all is not a fast run');
  assert.equal(reachesGoal('count', 5, null), false);
});

test('the submission rows that set a number', () => {
  assert.deepEqual(progressRows(tile({ tileType: 'kill', requiredAmount: 10 }), 'count', 7), [
    { amount: 7, itemId: null, durationSeconds: null, goal: null },
  ]);
  assert.deepEqual(progressRows(tile({ tileType: 'kill', requiredAmount: 10 }), 'count', 0), [], 'zero is no rows');

  const capped = progressRows(tile({ tileType: 'kill', requiredAmount: 10, capBy: '["energy"]' }), 'count', 4);
  assert.deepEqual(capped.map((r) => [r.amount, r.goal]), [[4, null], [4, 'cap:0']], 'a capped tile gets its cap counter too');

  const distinct = progressRows(tile({ tileType: 'drop', requiredAmount: 3, countMode: 'distinct', trackedItemIds: '[11,22]' }), 'distinct', 3);
  assert.deepEqual(distinct.map((r) => [r.amount, r.itemId]), [[1, 11], [1, 22], [1, -1]], 'own items first, then made-up ones');

  assert.deepEqual(progressRows(tile({ tileType: 'timed', timeThresholdSeconds: 60 }), 'fastest', 45), [
    { amount: 1, itemId: null, durationSeconds: 45, goal: null },
  ]);
  assert.deepEqual(progressRows(tile({ tileType: 'value', requiredAmount: 5 }), 'best', 9_000_000)[0].amount, 9_000_000);
  assert.deepEqual(progressRows(tile({ trackedStat: 'vorkath', statType: 'boss', statGoal: 10 }), 'stat', 5), [], 'stats are not submissions');

  assert.equal(clampProgress('slots', 10_000), MAX_ITEM_ROWS);
  assert.equal(clampProgress('count', -3), 0);
  assert.equal(clampProgress('count', 2.6), 3);
});

const snap = (bosses: Record<string, number>, skills: Record<string, number> = {}): Snapshot => ({
  bosses: Object.fromEntries(Object.entries(bosses).map(([k, v]) => [k, { score: v }])),
  skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { xp: v }])),
});

test('a stat gain is set exactly, whatever the reading was', () => {
  const { baseline, reading } = withStatProgress(snap({ vorkath: 100 }), snap({ vorkath: 140 }), 'boss', ['vorkath'], 7);
  assert.equal(computeGain(baseline as never, reading as never, {}, ['vorkath'], 'boss'), 7);
  const zero = withStatProgress(snap({ vorkath: 100 }), snap({ vorkath: 140 }), 'boss', ['vorkath'], 0);
  assert.equal(computeGain(zero.baseline as never, zero.reading as never, {}, ['vorkath'], 'boss'), 0);

  // Composite tile: the first key carries it, the others are pinned to their baseline.
  const both = withStatProgress(snap({ cox: 5, coxCm: 2 }), snap({ cox: 9, coxCm: 8 }), 'boss', ['cox', 'coxCm'], 3);
  assert.equal(computeGain(both.baseline as never, both.reading as never, {}, ['cox', 'coxCm'], 'boss'), 3);

  // Overall XP is read as the larger of the overall delta and the summed skills, so the skills are pinned.
  const overall = withStatProgress(snap({}, { overall: 1000, attack: 500 }), snap({}, { overall: 5000, attack: 4500 }), 'skill', ['overall'], 250);
  assert.equal(computeGain(overall.baseline as never, overall.reading as never, {}, ['overall'], 'skill'), 250);
});

test('a milestone tile reads the number as a lifetime total, from an eligible start', () => {
  const { baseline, reading } = withStatProgress(snap({ tzkalZuk: 3 }), snap({ tzkalZuk: 3 }), 'boss', ['tzkalZuk'], 1, { milestone: true });
  const ms = milestoneState(baseline as never, reading as never, {}, ['tzkalZuk'], 'boss', 1);
  assert.deepEqual(ms, { lifetime: 1, eligible: true, reached: true });
});

test('a lab stats push: the first sight of a key is the starting line, later pushes are the gain', () => {
  const first = foldLabPush(null, null, { vorkath: 100 });
  assert.equal(first.baseline.lab, true);
  assert.equal(computeGain(first.baseline as never, first.reading as never, {}, ['vorkath'], 'boss'), 0);

  const second = foldLabPush(first.baseline, first.reading, { vorkath: 106, zulrah: 40 });
  assert.equal(computeGain(second.baseline as never, second.reading as never, {}, ['vorkath'], 'boss'), 6);
  assert.equal(computeGain(second.baseline as never, second.reading as never, {}, ['zulrah'], 'boss'), 0, 'a new key starts where it is first seen');

  const lower = foldLabPush(second.baseline, second.reading, { vorkath: 50 });
  assert.equal(computeGain(lower.baseline as never, lower.reading as never, {}, ['vorkath'], 'boss'), 6, 'a reading only ever rises');

  const skill = foldLabPush(null, null, { attack: 1000 });
  const more = foldLabPush(skill.baseline, skill.reading, { attack: 1500 });
  assert.equal(computeGain(more.baseline as never, more.reading as never, {}, ['attack'], 'skill'), 500);
});

test('a real hiscores baseline is never rewritten by a push', () => {
  const hiscores = snap({ vorkath: 800 });
  const { baseline, reading } = foldLabPush(hiscores, snap({ vorkath: 800 }), { vorkath: 812, zulrah: 4 });
  assert.equal(baseline.lab, undefined);
  assert.equal(computeGain(baseline as never, reading as never, {}, ['vorkath'], 'boss'), 12);
  assert.equal(computeGain(baseline as never, reading as never, {}, ['zulrah'], 'boss'), 4, 'unranked at the start is 0, as on a real board');
});
