// Weekly competitions described in event terms (lib/weeklyStage) — the stage a weekly is at, and
// the four lifecycle steps its workspace shows.
//
// Run: node --experimental-strip-types --test tests/weekly-stage.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { weeklyLifecycleSteps, weeklyStage, type WeeklyCounts } from '../src/lib/weeklyStage.ts';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const iso = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

const FULL: WeeklyCounts = { participants: 12, withBaseline: 12, moving: 7, flagged: 0, leavers: 0 };

test('the recorded status wins over the clock', () => {
  // Mid-window but marked complete: the badge, the public page and the workspace must agree.
  assert.equal(weeklyStage({ startDate: iso(-2), endDate: iso(5), status: 'completed' }, NOW), 'wrap');
  assert.equal(weeklyStage({ startDate: iso(-2), endDate: iso(5), status: 'upcoming' }, NOW), 'build');
});

test('an active competition follows its window', () => {
  assert.equal(weeklyStage({ startDate: iso(-2), endDate: iso(5), status: 'active' }, NOW), 'run');
  assert.equal(weeklyStage({ startDate: iso(-9), endDate: iso(-2), status: 'active' }, NOW), 'wrap');
  assert.equal(weeklyStage({ startDate: iso(1), endDate: iso(8), status: 'active' }, NOW), 'build');
});

test('before it starts, the lit step is whatever is missing', () => {
  const empty = weeklyLifecycleSteps(
    { startDate: iso(2), endDate: iso(9), status: 'upcoming' },
    { ...FULL, participants: 0, withBaseline: 0 },
    NOW,
  );
  assert.equal(empty.find((s) => s.state === 'now')?.key, 'enrolled');

  const noBaselines = weeklyLifecycleSteps(
    { startDate: iso(2), endDate: iso(9), status: 'upcoming' },
    { ...FULL, withBaseline: 3 },
    NOW,
  );
  assert.equal(noBaselines.find((s) => s.state === 'now')?.key, 'baselines');
  assert.match(noBaselines.find((s) => s.key === 'baselines')!.detail, /3 of 12/);
});

test('a ready-to-go competition points at Running, and a live one stays there', () => {
  const ready = weeklyLifecycleSteps({ startDate: iso(2), endDate: iso(9), status: 'upcoming' }, FULL, NOW);
  assert.equal(ready.find((s) => s.state === 'now')?.key, 'running');

  const live = weeklyLifecycleSteps({ startDate: iso(-2), endDate: iso(5), status: 'active' }, FULL, NOW);
  assert.equal(live.find((s) => s.state === 'now')?.key, 'running');
  assert.match(live.find((s) => s.key === 'running')!.detail, /7 scoring/);
});

test('once finished, everything is history except the result', () => {
  const done = weeklyLifecycleSteps({ startDate: iso(-9), endDate: iso(-2), status: 'completed' }, FULL, NOW);
  assert.equal(done.filter((s) => s.state === 'now').length, 1);
  assert.equal(done.find((s) => s.state === 'now')?.key, 'results');
  assert.deepEqual(
    done.filter((s) => s.key !== 'results').map((s) => s.state),
    ['done', 'done', 'done'],
  );
});
