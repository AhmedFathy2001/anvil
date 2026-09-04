import test from 'node:test';
import assert from 'node:assert/strict';
import { dueSlotCount, nextSlotAfter, slotLabelsForDay, slotsForDay } from '../src/lib/missionSchedule.ts';
import { localDayKey, parseHhMm, zonedTimeToUtcMs } from '../src/lib/zonedTime.ts';

// "One a day at 20:00, two on weekends" — Sunday first, so index 0 and 6 get the pair.
const FIXED = {
  timezone: 'Europe/London',
  times: ['20:00', '22:30'],
  window: null,
  perDay: [2, 1, 1, 1, 1, 1, 2],
};

const WINDOW = {
  timezone: 'Europe/London',
  times: [],
  window: { from: '18:00', to: '23:00' },
  perDay: [2, 1, 1, 1, 1, 1, 2],
};

const iso = (ms: number) => new Date(ms).toISOString();

test('fixed times: a weekday takes the first time, a weekend day takes both', () => {
  // 2026-09-02 is a Wednesday, 2026-09-05 a Saturday.
  assert.deepEqual(slotLabelsForDay(FIXED, '2026-09-02', 1), ['20:00']);
  assert.deepEqual(slotLabelsForDay(FIXED, '2026-09-05', 1), ['20:00', '22:30']);
});

test('a weekday set to zero drops nothing at all', () => {
  const noWednesdays = { ...FIXED, perDay: [2, 1, 1, 0, 1, 1, 2] };
  assert.deepEqual(slotsForDay(noWednesdays, '2026-09-02', 1), []);
});

test('fixed times survive the DST switch at the same wall clock', () => {
  // Europe/London springs forward on Sunday 2026-03-29. 20:00 stays 20:00 to the clan either side.
  const before = slotsForDay(FIXED, '2026-03-28', 1)[0]; // GMT
  const after = slotsForDay(FIXED, '2026-03-30', 1)[0]; // BST
  assert.equal(iso(before), '2026-03-28T20:00:00.000Z');
  assert.equal(iso(after), '2026-03-30T19:00:00.000Z');
});

test('a window rolls inside the range, in order, and the same way every time', () => {
  const slots = slotsForDay(WINDOW, '2026-09-05', 42); // Saturday: two drops
  assert.equal(slots.length, 2);
  const labels = slotLabelsForDay(WINDOW, '2026-09-05', 42);
  for (const label of labels) {
    const minutes = parseHhMm(label)!;
    assert.ok(minutes >= 18 * 60 && minutes <= 23 * 60, `${label} inside 18:00-23:00`);
  }
  assert.ok(slots[0] < slots[1], 'the second drop lands after the first');
  // Determinism is what lets the cron ask the same question every minute and get one answer.
  assert.deepEqual(slotLabelsForDay(WINDOW, '2026-09-05', 42), labels);
  // …and a different event gets a different roll, so two boards don't drop in lockstep.
  assert.notDeepEqual(slotLabelsForDay(WINDOW, '2026-09-05', 43), labels);
});

test('two drops are spread across the window rather than bunched', () => {
  const [a, b] = slotsForDay(WINDOW, '2026-09-05', 7);
  assert.ok(b - a >= 60_000, 'at least a minute apart');
  assert.ok(b - a <= 5 * 3_600_000, 'both still inside a five-hour window');
});

test('a window that wraps midnight runs into the small hours', () => {
  const lateNight = { ...WINDOW, window: { from: '22:00', to: '02:00' }, perDay: [1, 1, 1, 1, 1, 1, 1] };
  const [slot] = slotsForDay(lateNight, '2026-09-02', 3);
  const day = localDayKey(slot, lateNight.timezone);
  assert.ok(day === '2026-09-02' || day === '2026-09-03', `landed on ${day}`);
});

test('due count: only what today has already reached, and never before the event started', () => {
  const day = '2026-09-05';
  const at2100 = zonedTimeToUtcMs({ year: 2026, month: 9, day: 5, hour: 21, minute: 0 }, FIXED.timezone);
  // 20:00 has passed, 22:30 has not.
  assert.equal(dueSlotCount({ cfg: FIXED, nowMs: at2100, startMs: null, seed: 1 }), 1);
  const at2300 = zonedTimeToUtcMs({ year: 2026, month: 9, day: 5, hour: 23, minute: 0 }, FIXED.timezone);
  assert.equal(dueSlotCount({ cfg: FIXED, nowMs: at2300, startMs: null, seed: 1 }), 2);
  // An event that started at 21:00 never owes the 20:00 drop.
  assert.equal(dueSlotCount({ cfg: FIXED, nowMs: at2300, startMs: at2100, seed: 1 }), 1);
  assert.equal(localDayKey(at2100, FIXED.timezone), day);
});

test('due count does not carry yesterday forward', () => {
  // Nothing ran on Saturday; by Sunday lunchtime the schedule owes Sunday's slots only.
  const sundayNoon = zonedTimeToUtcMs({ year: 2026, month: 9, day: 6, hour: 12, minute: 0 }, FIXED.timezone);
  assert.equal(dueSlotCount({ cfg: FIXED, nowMs: sundayNoon, startMs: null, seed: 1 }), 0);
});

test('next slot: later today, else the next day that drops anything', () => {
  const fridayNoon = zonedTimeToUtcMs({ year: 2026, month: 9, day: 4, hour: 12, minute: 0 }, FIXED.timezone);
  assert.equal(iso(nextSlotAfter({ cfg: FIXED, nowMs: fridayNoon, seed: 1 })!), '2026-09-04T19:00:00.000Z');

  const fridayLate = zonedTimeToUtcMs({ year: 2026, month: 9, day: 4, hour: 23, minute: 0 }, FIXED.timezone);
  assert.equal(iso(nextSlotAfter({ cfg: FIXED, nowMs: fridayLate, seed: 1 })!), '2026-09-05T19:00:00.000Z');

  // Weekends only: from Monday, the next drop is Saturday's.
  const weekendsOnly = { ...FIXED, perDay: [1, 0, 0, 0, 0, 0, 1] };
  const monday = zonedTimeToUtcMs({ year: 2026, month: 8, day: 31, hour: 9, minute: 0 }, FIXED.timezone);
  assert.equal(iso(nextSlotAfter({ cfg: weekendsOnly, nowMs: monday, seed: 1 })!), '2026-09-05T19:00:00.000Z');
});

test('a schedule with every day at zero has no next drop rather than a wrong one', () => {
  const off = { ...FIXED, perDay: [0, 0, 0, 0, 0, 0, 0] };
  assert.equal(nextSlotAfter({ cfg: off, nowMs: Date.now(), seed: 1 }), null);
});
