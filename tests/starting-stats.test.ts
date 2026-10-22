// A late joiner's starting stats: when to read them, and what the roster says meanwhile.
//
// Run: npx tsx --test tests/starting-stats.test.ts
//
// Somebody put on a running event used to wait for the next sweep for their start line, and the
// roster gave no sign of it. The capture is now kicked off by the add itself (lib/startingStats);
// these are the rules it runs on (lib/startingStatsRules), which must never take a start line before
// the whistle, and must treat a pre-start or partial one as not taken.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventIsRunning,
  joinedAfterStart,
  shouldCaptureNow,
  shouldCaptureWeeklyNow,
  startingStatsStatus,
  weeklyStartingStatsStatus,
} from '../src/lib/startingStatsRules.ts';

const START = '2026-10-20T12:00:00.000Z';
const END = '2026-10-27T12:00:00.000Z';
const ms = (iso: string) => Date.parse(iso);
const DURING = ms('2026-10-21T09:00:00.000Z');
const BEFORE = ms('2026-10-20T11:00:00.000Z');
const AFTER = ms('2026-10-28T00:00:00.000Z');

const event = { startDate: START, endDate: END, forceEndedAt: null };
const fullBaseline = JSON.stringify({ skills: { overall: { xp: 1_000 } }, bosses: {} });
const partialBaseline = JSON.stringify({ skills: { overall: { xp: 1_000 } }, bosses: {}, partial: true });

const player = (over: Partial<Parameters<typeof shouldCaptureNow>[1]> = {}) => ({
  teamId: 7,
  frozenAt: null,
  statsSnapshot: null,
  snapshotAt: null,
  pickedAt: '2026-10-21T08:59:00.000Z',
  ...over,
});

test('the event window: started and not over, force-end and undated both count as not running', () => {
  assert.equal(eventIsRunning(event, DURING), true);
  assert.equal(eventIsRunning(event, BEFORE), false);
  assert.equal(eventIsRunning(event, AFTER), false);
  assert.equal(eventIsRunning({ ...event, forceEndedAt: '2026-10-21T00:00:00.000Z' }, DURING), false);
  assert.equal(eventIsRunning({ startDate: null, endDate: null }, DURING), false);
  // The space-separated stored format reads as UTC, not local.
  assert.equal(eventIsRunning({ startDate: '2026-10-20 12:00:00', endDate: '2026-10-27 12:00:00' }, DURING), true);
});

test('before the start nothing is captured, however incomplete the row is', () => {
  assert.equal(shouldCaptureNow(event, player(), BEFORE), false);
});

test('a late joiner on a team with no start line is captured now', () => {
  assert.equal(shouldCaptureNow(event, player(), DURING), true);
});

test('pool players and benched players are left alone — the sweep skips them too', () => {
  assert.equal(shouldCaptureNow(event, player({ teamId: null }), DURING), false);
  assert.equal(shouldCaptureNow(event, player({ frozenAt: '2026-10-21T08:00:00.000Z' }), DURING), false);
});

test('a start line taken BEFORE the start is not trusted — it is re-taken', () => {
  const early = player({ statsSnapshot: fullBaseline, snapshotAt: '2026-10-20T11:30:00.000Z' });
  assert.equal(shouldCaptureNow(event, early, DURING), true);
});

test('a start line with no time on it is unknown-timing and re-taken', () => {
  assert.equal(shouldCaptureNow(event, player({ statsSnapshot: fullBaseline, snapshotAt: null }), DURING), true);
});

test('a partial (starting-shot) start line still counts as not captured', () => {
  const partial = player({ statsSnapshot: partialBaseline, snapshotAt: '2026-10-21T09:00:00.000Z' });
  assert.equal(shouldCaptureNow(event, partial, DURING), true);
  assert.deepEqual(startingStatsStatus(event, partial, DURING), { state: 'pending' });
});

test('a good start line is left alone', () => {
  const ok = player({ statsSnapshot: fullBaseline, snapshotAt: '2026-10-21T09:00:05.000Z' });
  assert.equal(shouldCaptureNow(event, ok, DURING), false);
});

test('roster line: nothing before the start', () => {
  assert.equal(startingStatsStatus(event, player(), BEFORE), null);
});

test('roster line: pending while missing, failed once an attempt has failed', () => {
  assert.deepEqual(startingStatsStatus(event, player(), DURING), { state: 'pending' });
  assert.deepEqual(startingStatsStatus(event, player(), DURING, { ok: false, at: DURING }), { state: 'failed' });
});

test('roster line: taken is shown for late joiners only, so the roster is not noisy', () => {
  const late = player({ statsSnapshot: fullBaseline, snapshotAt: '2026-10-21T09:00:05.000Z' });
  assert.deepEqual(startingStatsStatus(event, late, DURING), { state: 'taken', at: '2026-10-21T09:00:05.000Z' });

  // On the board at the whistle, captured by the first sweep a few minutes in: say nothing.
  const onTime = player({ pickedAt: '2026-10-19T10:00:00.000Z', statsSnapshot: fullBaseline, snapshotAt: '2026-10-20T12:05:00.000Z' });
  assert.equal(startingStatsStatus(event, onTime, DURING), null);
  // …unless this process is what just captured them (an account swap, a reset).
  assert.deepEqual(startingStatsStatus(event, onTime, DURING, { ok: true, at: DURING }), { state: 'taken', at: '2026-10-20T12:05:00.000Z' });
});

test('joinedAfterStart: placed after the start, or a start line taken well after it', () => {
  assert.equal(joinedAfterStart(event, player()), true);
  assert.equal(joinedAfterStart(event, player({ pickedAt: null, snapshotAt: '2026-10-20T12:10:00.000Z' })), false);
  assert.equal(joinedAfterStart(event, player({ pickedAt: null, snapshotAt: '2026-10-20T14:00:00.000Z' })), true);
});

const comp = { status: 'active', startDate: START, endDate: END };

test('weekly: only an active, started competition captures, and only a missing start line', () => {
  assert.equal(shouldCaptureWeeklyNow(comp, { baselineValue: null }, DURING), true);
  assert.equal(shouldCaptureWeeklyNow(comp, { baselineValue: 500 }, DURING), false);
  assert.equal(shouldCaptureWeeklyNow({ ...comp, status: 'upcoming' }, { baselineValue: null }, DURING), false);
  assert.equal(shouldCaptureWeeklyNow(comp, { baselineValue: null }, BEFORE), false);
  assert.equal(shouldCaptureWeeklyNow({ ...comp, status: 'completed' }, { baselineValue: null }, AFTER), false);
});

test('weekly roster line: pending, failed, and taken only when just captured', () => {
  assert.deepEqual(weeklyStartingStatsStatus(comp, { baselineValue: null }, DURING), { state: 'pending' });
  assert.deepEqual(weeklyStartingStatsStatus(comp, { baselineValue: null }, DURING, { ok: false, at: DURING }), { state: 'failed' });
  assert.equal(weeklyStartingStatsStatus(comp, { baselineValue: 10 }, DURING), null);
  assert.equal(weeklyStartingStatsStatus(comp, { baselineValue: 10 }, DURING, { ok: true, at: DURING })?.state, 'taken');
  assert.equal(weeklyStartingStatsStatus({ ...comp, status: 'upcoming' }, { baselineValue: null }, BEFORE), null);
});
