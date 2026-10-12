import { test } from 'node:test';
import assert from 'node:assert/strict';

import { overlaySnapshot } from '../src/lib/liveHistory';
import { computeDeltas } from '../src/lib/statDeltas';
import type { HiscoresSnapshot } from '../src/lib/hiscores';

const snap = {
  skills: {
    overall: { xp: 13_100_000, level: 199, rank: 1 },
    slayer: { xp: 13_000_000, level: 98, rank: 1 },
    agility: { xp: 100_000, level: 50, rank: 1 },
  },
  bosses: { vorkath: { score: 990, rank: 1 }, zulrah: { score: -1, rank: -1 } },
} as unknown as HiscoresSnapshot;

test('raises pushed skills, recomputes the level and the overall total', () => {
  const eff = overlaySnapshot(snap, { slayer: 13_100_000 });
  const skills = eff.skills as unknown as Record<string, { xp: number; level: number }>;
  assert.equal(skills.slayer.xp, 13_100_000);
  assert.equal(skills.slayer.level, 99);
  assert.equal(skills.overall.xp, 13_200_000);
});

test('raises pushed boss kill counts and never lowers anything', () => {
  const eff = overlaySnapshot(snap, { vorkath: 1001, slayer: 1, unknownKey: 5 });
  assert.equal((eff.bosses as unknown as Record<string, { score: number }>).vorkath.score, 1001);
  assert.equal((eff.skills as unknown as Record<string, { xp: number }>).slayer.xp, 13_000_000);
});

test('a poll after pushes counts only what the plugin did not see', () => {
  const pushed = { slayer: 13_100_000 };
  const beforePoll = overlaySnapshot(snap, pushed);
  // The hiscores caught up on slayer, AND show agility the plugin never saw (mobile).
  const fresh = {
    ...snap,
    skills: { ...snap.skills, overall: { xp: 13_250_000, level: 200, rank: 1 }, slayer: { xp: 13_100_000, level: 99, rank: 1 }, agility: { xp: 150_000, level: 52, rank: 1 } },
  } as unknown as HiscoresSnapshot;
  const afterPoll = overlaySnapshot(fresh, pushed);
  const d = computeDeltas(beforePoll, afterPoll);
  assert.deepEqual(Object.keys(d.skills ?? {}).filter((k) => k !== 'overall'), ['agility']);
});
