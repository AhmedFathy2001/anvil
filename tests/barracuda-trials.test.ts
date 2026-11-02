// Barracuda Trials: the course × rank options (with each course's Sailing unlock level) and the
// parse that decides whether a timed tile is a rank tile (gated on rank, counted in runs).
//
// Run: node --experimental-strip-types --test tests/barracuda-trials.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TRIAL_RANK_OPTIONS, TRIAL_RANK_ACTIVITIES, parseTrialRankTile, trialRankLevel } from '../src/lib/barracudaTrials.ts';

test('nine course × rank options, levels per course', () => {
  assert.equal(TRIAL_RANK_OPTIONS.length, 9);
  assert.deepEqual(TRIAL_RANK_ACTIVITIES, TRIAL_RANK_OPTIONS.map((o) => o.activity));
  const level = (course: string) => new Set(TRIAL_RANK_OPTIONS.filter((o) => o.course === course).map((o) => o.level));
  assert.deepEqual([...level('Tempor Tantrum')], [30]);
  assert.deepEqual([...level('Jubbly Jive')], [55]);
  assert.deepEqual([...level('Gwenith Glide')], [72]);
  assert.deepEqual(
    TRIAL_RANK_OPTIONS.filter((o) => o.course === 'Gwenith Glide').map((o) => o.rank),
    ['Swordfish', 'Shark', 'Marlin'],
  );
});

test('every option parses back as a rank tile with its level', () => {
  for (const o of TRIAL_RANK_OPTIONS) {
    const parsed = parseTrialRankTile(o.activity);
    assert.ok(parsed, o.activity);
    assert.equal(parsed!.rank, o.rank.toLowerCase());
    assert.equal(trialRankLevel(o.activity), o.level);
  }
});

test('non-trial activities are not rank tiles and have no level', () => {
  assert.equal(parseTrialRankTile('Inferno'), null);
  assert.equal(trialRankLevel('Inferno'), null);
  assert.equal(trialRankLevel(null), null);
  assert.equal(trialRankLevel('the gwenith glide - marlin'), 72);
});
