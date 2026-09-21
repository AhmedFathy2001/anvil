import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeltas, mergeDeltas } from '../src/lib/statDeltas.ts';
import { nextDueAfterMiss, nextDueAt } from '../src/lib/pollLadder.ts';

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

// ── The poll ladder ──────────────────────────────────────────────────────────────────────────────
//
// The ladder exists because the hiscores budget is shared by every clan on the box, so an idle
// member must not be polled every tick. It assumes the plugin is the live signal and the sweep only
// fills gaps — and when a push stops arriving for any reason (the setting off, a failing config
// poll, a client that simply isn't running), that assumption fails silently. What the person sees
// is their own competition row frozen while they train the metric, which is indistinguishable from
// the feature being broken. Hence a shorter tail for anyone actually racing.

test('an idle member backs off to the full two hours', () => {
  assert.equal(nextDueAfterMiss(1), 30 * 60_000);
  assert.equal(nextDueAfterMiss(2), 60 * 60_000);
  assert.equal(nextDueAfterMiss(3), 120 * 60_000);
  assert.equal(nextDueAfterMiss(9), 120 * 60_000);
});

test('a member in a live competition is never left longer than half an hour', () => {
  assert.equal(nextDueAfterMiss(3, true), 30 * 60_000);
  assert.equal(nextDueAfterMiss(9, true), 30 * 60_000);
});

test('being enrolled never makes a poll LESS frequent', () => {
  for (const streak of [0, 1, 2, 3, 12]) {
    assert.ok(nextDueAfterMiss(streak, true) <= nextDueAfterMiss(streak, false));
  }
});

test('a gain still clears the ladder outright, enrolled or not', () => {
  assert.equal(nextDueAfterMiss(0), 0);
  assert.equal(nextDueAfterMiss(0, true), 0);
  assert.equal(nextDueAt(0, new Date()), null);
  assert.equal(nextDueAt(0, new Date(), true), null);
});

test('the enrolled cap is applied to the timestamp the sweep actually writes', () => {
  const from = new Date('2026-09-21T00:00:00.000Z');
  assert.equal(nextDueAt(3, from), '2026-09-21T02:00:00.000Z');
  assert.equal(nextDueAt(3, from, true), '2026-09-21T00:30:00.000Z');
});
