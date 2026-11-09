import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateMilestones, bestXpPerHour, MAX_SAMPLE_GAP_MS, RATE_HEADROOM, MIN_RATE_WINDOW_MS } from '../src/lib/milestoneGate.ts';

// The bug this pins: The AFK Spot was told "Veyyr has reached 10M Woodcutting XP" at 10.5M — a
// crossing from long ago, found because the previous snapshot the sweep compared against was old.
// A milestone is news only when it was crossed between two consecutive, recent observations.

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-09T00:05:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const snap = (skills: Record<string, number>, bosses: Record<string, number> = {}) =>
  ({
    skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp, level: 99 }])),
    bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { score }])),
  }) as never;

const wc10m = { kind: 'xp' as const, metric: 'woodcutting', threshold: 10_000_000 };

test('first observation at 10.5M posts nothing', () => {
  const g = gateMilestones([wc10m], { before: null, after: snap({ woodcutting: 10_500_000 }), previousAt: null, now: NOW });
  assert.deepEqual(g.announce, []);
  assert.equal(g.reason, 'no-previous-sample');
});

test('a crossing between two recent samples posts', () => {
  const g = gateMilestones([wc10m], {
    before: snap({ woodcutting: 9_990_000, overall: 200_000_000 }),
    after: snap({ woodcutting: 10_010_000, overall: 200_020_000 }),
    previousAt: ago(2 * HOUR),
    now: NOW,
  });
  assert.deepEqual(g.announce, [wc10m]);
  assert.deepEqual(g.silent, []);
});

test('a crossing across a large gap posts nothing (recorded silently)', () => {
  const g = gateMilestones([wc10m], {
    before: snap({ woodcutting: 9_800_000 }),
    after: snap({ woodcutting: 10_500_000 }),
    previousAt: ago(MAX_SAMPLE_GAP_MS + HOUR),
    now: NOW,
  });
  assert.deepEqual(g.announce, []);
  assert.deepEqual(g.silent, [wc10m]);
  assert.equal(g.reason, 'sample-gap-too-large');
});

test('an unknown previous-sample time posts nothing', () => {
  const g = gateMilestones([wc10m], {
    before: snap({ woodcutting: 9_990_000 }),
    after: snap({ woodcutting: 10_010_000 }),
    previousAt: null,
    now: NOW,
  });
  assert.deepEqual(g.announce, []);
});

test('an impossible rate posts nothing', () => {
  const best = bestXpPerHour('woodcutting', 'main')!;
  assert.ok(best > 0, 'woodcutting has a rate');
  // More than RATE_HEADROOM× the best rate over the minimum window, inside the allowed gap.
  const gained = Math.ceil(best * RATE_HEADROOM * (MIN_RATE_WINDOW_MS / HOUR) * 1.2);
  const g = gateMilestones([wc10m], {
    before: snap({ woodcutting: 10_000_000 - gained + 1 }),
    after: snap({ woodcutting: 10_000_001 }),
    previousAt: ago(HOUR),
    now: NOW,
  });
  assert.deepEqual(g.announce, []);
  assert.equal(g.reason, 'impossible-rate');
});

test('a whole session landing in one poll (hiscores update on logout) still posts', () => {
  // 5 minutes between polls, but 4 hours of good woodcutting arriving at once.
  const best = bestXpPerHour('woodcutting', 'main')!;
  const g = gateMilestones([wc10m], {
    before: snap({ woodcutting: 10_000_000 - best * 4 }),
    after: snap({ woodcutting: 10_000_100 }),
    previousAt: ago(5 * 60 * 1000),
    now: NOW,
  });
  assert.deepEqual(g.announce, [wc10m]);
});

test('a skill or boss missing (or 0) in the previous sample posts nothing', () => {
  const kc = { kind: 'kc' as const, metric: 'zulrah', threshold: 100 };
  const g = gateMilestones([wc10m, kc], {
    before: snap({ attack: 1_000_000 }),
    after: snap({ attack: 1_000_000, woodcutting: 10_500_000 }, { zulrah: 150 }),
    previousAt: ago(HOUR),
    now: NOW,
  });
  assert.deepEqual(g.announce, []);
  assert.equal(g.reason, 'no-previous-value');
});

test('KC milestones obey the same gap and rate rules', () => {
  const kc = { kind: 'kc' as const, metric: 'zulrah', threshold: 1000 };
  const ok = gateMilestones([kc], { before: snap({}, { zulrah: 995 }), after: snap({}, { zulrah: 1002 }), previousAt: ago(HOUR), now: NOW });
  assert.deepEqual(ok.announce, [kc]);
  const old = gateMilestones([kc], { before: snap({}, { zulrah: 900 }), after: snap({}, { zulrah: 1002 }), previousAt: ago(3 * 24 * HOUR), now: NOW });
  assert.deepEqual(old.announce, []);
  const fast = gateMilestones([kc], { before: snap({}, { zulrah: 10 }), after: snap({}, { zulrah: 1002 }), previousAt: ago(HOUR), now: NOW });
  assert.deepEqual(fast.announce, [], '992 Zulrah kills in one window is not real');
});

test('total XP: a jump no skill could make posts nothing', () => {
  const tx = { kind: 'totalxp' as const, metric: null, threshold: 100 };
  const g = gateMilestones([tx], {
    before: snap({ overall: 80_000_000 }),
    after: snap({ overall: 100_000_000 }),
    previousAt: ago(HOUR),
    now: NOW,
  });
  assert.deepEqual(g.announce, []);
});
