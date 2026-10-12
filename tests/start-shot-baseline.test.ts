// The starting shot's login push becomes a PARTIAL event baseline: every skill, only the bosses the
// plugin had seen. A key it lacks must score nothing (not the whole account) until the sweep fills it.
//
// Run: npx tsx --test tests/start-shot-baseline.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startBaselineFromLiveStats } from '../src/lib/liveSnapshot.ts';
import { computeGain, milestoneState, completePartialBaseline } from '../src/lib/statTracking.ts';
import type { HiscoresSnapshot } from '../src/lib/hiscores.ts';

const live = JSON.stringify({ woodcutting: 4_859_841, attack: 13_034_431, hitpoints: 1_154, zulrah: 12 });

test('the login push becomes a partial baseline', () => {
  const base = startBaselineFromLiveStats(live)!;
  assert.equal(base.partial, true);
  assert.equal(base.skills.woodcutting.xp, 4_859_841);
  assert.equal(base.bosses.zulrah.score, 12);
  assert.equal(startBaselineFromLiveStats(JSON.stringify({ zulrah: 3 })), null);
});

test('skill gains count from the shot', () => {
  const base = startBaselineFromLiveStats(live)!;
  assert.equal(computeGain(base, null, { woodcutting: 4_900_000 }, ['woodcutting'], 'skill'), 40_159);
});

test('a boss the push never saw scores nothing, not lifetime KC', () => {
  const base = startBaselineFromLiveStats(live)!;
  assert.equal(computeGain(base, null, { vorkath: 900 }, ['vorkath'], 'boss'), 0);
  assert.equal(computeGain(base, null, { zulrah: 15 }, ['zulrah'], 'boss'), 3);
  // Milestone: unknown start = can't prove they didn't already have it.
  assert.equal(milestoneState(base, null, { vorkath: 1 }, ['vorkath'], 'boss', 1).eligible, false);
  assert.equal(milestoneState(base, null, {}, ['zulrah'], 'boss', 50).eligible, true);
});

test('a hiscores baseline still reads a missing key as 0 (unranked at the start)', () => {
  const full: HiscoresSnapshot = { skills: {}, bosses: {} };
  assert.equal(computeGain(full, null, { vorkath: 5 }, ['vorkath'], 'boss'), 5);
});

test('the sweep fills the gaps and keeps the shot as the starting line', () => {
  const base = startBaselineFromLiveStats(live)!;
  const hiscores: HiscoresSnapshot = {
    skills: { woodcutting: { rank: 1, level: 99, xp: 5_000_000 }, fishing: { rank: 1, level: 80, xp: 2_000_000 } },
    bosses: { vorkath: { rank: 1, score: 900 }, zulrah: { rank: 1, score: 20 } },
  };
  const done = completePartialBaseline(base, hiscores);
  assert.equal(done.partial, undefined);
  assert.equal(done.skills.woodcutting.xp, 4_859_841); // the shot's value wins
  assert.equal(done.skills.fishing.xp, 2_000_000); // filled from hiscores
  assert.equal(done.bosses.vorkath.score, 900);
  assert.equal(done.bosses.zulrah.score, 12);
  assert.equal(computeGain(done, null, { vorkath: 905 }, ['vorkath'], 'boss'), 5);
});
