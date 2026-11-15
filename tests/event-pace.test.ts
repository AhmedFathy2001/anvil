// The admin events list's "on pace" label (lib/eventPace) and the home page's streak nudge
// (lib/streakNudge): pure rules, no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventPace } from '../src/lib/eventPace.ts';
import { streakNudge } from '../src/lib/streakNudge.ts';

const START = Date.parse('2026-11-01T00:00:00Z');
const END = Date.parse('2026-11-11T00:00:00Z');
const at = (pct: number) => START + ((END - START) * pct) / 100;

test('40% of the time gone with 25% of the tiles done is behind pace', () => {
  const p = eventPace({ start: START, end: END, now: at(40), cleared: 5, total: 20 });
  assert.equal(p?.label, 'behind pace');
  assert.equal(p?.timePct, 40);
  assert.equal(p?.boardPct, 25);
  assert.match(p!.title, /40% of the time has gone and 25% of the tiles are cleared/);
});

test('within ten points either way is on pace; further ahead says ahead', () => {
  assert.equal(eventPace({ start: START, end: END, now: at(40), cleared: 6, total: 20 })?.label, 'on pace'); // 30% vs 40%
  assert.equal(eventPace({ start: START, end: END, now: at(40), cleared: 10, total: 20 })?.label, 'on pace'); // 50% vs 40%: exactly ten ahead
  assert.equal(eventPace({ start: START, end: END, now: at(40), cleared: 12, total: 20 })?.label, 'ahead'); // 60% vs 40%
  assert.equal(eventPace({ start: START, end: END, now: at(0), cleared: 0, total: 20 })?.label, 'on pace');
});

test('no end date, no start, no tiles or a window that runs backwards: nothing to say', () => {
  assert.equal(eventPace({ start: START, end: null, now: at(40), cleared: 5, total: 20 }), null);
  assert.equal(eventPace({ start: null, end: END, now: at(40), cleared: 5, total: 20 }), null);
  assert.equal(eventPace({ start: START, end: END, now: at(40), cleared: 0, total: 0 }), null);
  assert.equal(eventPace({ start: END, end: START, now: at(40), cleared: 5, total: 20 }), null);
});

test('a board past its end clamps to 100% of the time', () => {
  const p = eventPace({ start: START, end: END, now: END + 86_400_000, cleared: 20, total: 20 });
  assert.equal(p?.timePct, 100);
  assert.equal(p?.label, 'on pace');
});

test('streak nudge: only a live streak with nothing yet this week', () => {
  const quiet = { current: 4, weeks: [true, true, true, true, false] };
  assert.equal(streakNudge(quiet), 'Play in anything this week to keep your 4-week streak.');
  assert.equal(streakNudge({ current: 5, weeks: [true, true, true, true, true] }), null, 'already played this week');
  assert.equal(streakNudge({ current: 0, weeks: [false, false] }), null, 'no streak');
  assert.equal(streakNudge({ current: 0, weeks: [] }), null);
  assert.equal(streakNudge({ current: 3, weeks: [] }), null);
  assert.doesNotMatch(streakNudge(quiet)!, /!/);
});
