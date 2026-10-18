// Repeating Skill / Boss of the Week: what the next one is.
//
// Run: npm run test:weeklyrepeat

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultWeeklyTitle, nextMetric, nextWindow, parseRepeat } from '../src/lib/weeklyRepeatPlan.ts';

const DAY = 86_400_000;

test('no rotation repeats the same metric; a rotation cycles and wraps', () => {
  assert.equal(nextMetric('agility', { rotation: null }), 'agility');
  const r = { rotation: ['agility', 'slayer', 'mining'] };
  assert.equal(nextMetric('agility', r), 'slayer');
  assert.equal(nextMetric('mining', r), 'agility');
  // A metric no longer in the list starts the rotation over.
  assert.equal(nextMetric('fishing', r), 'agility');
});

test('the next week starts when the last one ended, same length', () => {
  const start = Date.UTC(2026, 9, 5);
  const prev = { startDate: new Date(start).toISOString(), endDate: new Date(start + 7 * DAY).toISOString() };
  const w = nextWindow(prev, start + 7 * DAY + 60_000);
  assert.equal(w.startDate, prev.endDate);
  assert.equal(Date.parse(w.endDate) - Date.parse(w.startDate), 7 * DAY);
});

test('after missed weeks it lands on the window that contains now, never in the past', () => {
  const start = Date.UTC(2026, 9, 5);
  const prev = { startDate: new Date(start).toISOString(), endDate: new Date(start + 7 * DAY).toISOString() };
  const now = start + 23 * DAY;
  const w = nextWindow(prev, now);
  assert.ok(Date.parse(w.startDate) <= now && Date.parse(w.endDate) > now);
});

test('stored config parses defensively, and titles read like the form', () => {
  assert.equal(parseRepeat(null), null);
  assert.equal(parseRepeat('nope'), null);
  assert.deepEqual(parseRepeat('{"rotation":[]}'), { rotation: null });
  assert.deepEqual(parseRepeat('{"rotation":["a",3,"b"]}'), { rotation: ['a', 'b'] });
  assert.equal(defaultWeeklyTitle('boss', 'zulrah'), 'BOTW: Zulrah');
});
