import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeltas, mergeDeltas } from '../src/lib/statHistory.ts';

// The daily row's per-metric JSON is built one 15-minute tick at a time, and each tick only knows
// what moved since the last fetch. These tests pin the accumulation, because the failure they guard
// against was silent: the day still reported the right TOTAL xp (that column adds in SQL) while its
// per-skill breakdown quietly reported only the final tick.

const snap = (skills: Record<string, number>, bosses: Record<string, number> = {}) => ({
  skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp }])),
  bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { score }])),
}) as never;

test('a skill gained across several ticks sums instead of replacing', () => {
  let day = mergeDeltas(null, { skills: { agility: 40_000 } });
  day = mergeDeltas(day, { skills: { agility: 35_000 } });
  day = mergeDeltas(day, { skills: { agility: 25_000 } });
  assert.equal(day.skills?.agility, 100_000);
});

test('metrics touched in earlier ticks survive later ones', () => {
  const day = mergeDeltas({ skills: { agility: 40_000 }, bosses: { zulrah: 12 } }, { skills: { slayer: 5_000 } });
  assert.deepEqual(day.skills, { agility: 40_000, slayer: 5_000 });
  assert.deepEqual(day.bosses, { zulrah: 12 });
});

test('skills and bosses accumulate independently', () => {
  let day = mergeDeltas(null, { skills: { ranged: 10 }, bosses: { vorkath: 3 } });
  day = mergeDeltas(day, { bosses: { vorkath: 4, zulrah: 1 } });
  assert.deepEqual(day.skills, { ranged: 10 });
  assert.deepEqual(day.bosses, { vorkath: 7, zulrah: 1 });
});

test('a missing or unparsed previous blob starts the day fresh', () => {
  assert.deepEqual(mergeDeltas(null, { skills: { mining: 900 } }), { skills: { mining: 900 } });
});

test('a tick that moved nothing leaves the day untouched', () => {
  const before = { skills: { agility: 40_000 } };
  assert.deepEqual(mergeDeltas(before, {}), before);
});

test('empty groups are omitted rather than stored as {}', () => {
  const day = mergeDeltas(null, { skills: { mining: 5 } });
  assert.equal('bosses' in day, false);
});

// The regression in full: two members gain the same 300k, one polled every tick (active — gaining XP
// resets the backoff) and one polled once (idle, one logout flush). Their days must agree.
test('an active member polled every tick totals the same as an idle one polled once', () => {
  const ticks = [50_000, 90_000, 60_000, 40_000, 60_000];
  let active: ReturnType<typeof mergeDeltas> | null = null;
  for (const xp of ticks) active = mergeDeltas(active, { skills: { agility: xp } });
  const idle = mergeDeltas(null, { skills: { agility: ticks.reduce((a, b) => a + b, 0) } });
  assert.equal(active?.skills?.agility, 300_000);
  assert.deepEqual(active, idle);
});

test('computeDeltas reports movement since the previous snapshot only', () => {
  const d = computeDeltas(snap({ overall: 1_000, agility: 500 }), snap({ overall: 1_600, agility: 900, mining: 200 }));
  assert.equal(d.skills?.agility, 400);
  assert.equal(d.skills?.mining, 200);
  assert.equal(d.skills?.overall, undefined); // stored as a column, never duplicated into the JSON
});

test('a first-ever snapshot records no gains', () => {
  assert.deepEqual(computeDeltas(null, snap({ overall: 50_000_000, agility: 3_000_000 })), {});
});
