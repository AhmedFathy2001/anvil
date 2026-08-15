// Calendar lane packing and gap detection (lib/scheduleLanes) — the two pieces of the admin
// schedule that decide whether a month reads as six bars or forty pills.
//
// Run: node --experimental-strip-types --test tests/schedule-lanes.test.ts
// (lib/scheduleLanes imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  dayOf,
  daysBetween,
  findGaps,
  isoDay,
  laneRowsFor,
  overlaps,
  packLanes,
  type Span,
} from '../src/lib/scheduleLanes.ts';

/** Local midnight for a plain calendar date, matching how the page reads stored timestamps. */
const d = (s: string) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
};

const span = (start: string, end: string): Span => ({ start: d(start), end: d(end) });

test('a span is inclusive of both ends', () => {
  const one = span('2026-08-15', '2026-08-15');
  assert.equal(daysBetween(one.start, one.end) + 1, 1);
  assert.ok(overlaps(one, span('2026-08-15', '2026-08-20')));
});

test('touching-but-not-overlapping spans share a lane', () => {
  const laid = packLanes(
    [span('2026-08-01', '2026-08-07'), span('2026-08-08', '2026-08-14')],
    (s) => s,
  );
  assert.deepEqual(laid.map((l) => l.lane), [0, 0]);
});

test('an event that overlaps by a single day is pushed to the next lane', () => {
  const laid = packLanes(
    [span('2026-08-01', '2026-08-07'), span('2026-08-07', '2026-08-14')],
    (s) => s,
  );
  assert.deepEqual(laid.map((l) => l.lane), [0, 1]);
});

test('the longest of two same-day starts takes the top lane', () => {
  const laid = packLanes(
    [span('2026-08-10', '2026-08-11'), span('2026-08-10', '2026-08-20')],
    (s) => s,
  );
  const long = laid.find((l) => daysBetween(l.start, l.end) === 10);
  assert.equal(long?.lane, 0);
});

test('a lane is reused once its occupant has finished', () => {
  // Three events: a long one across the month, and two short ones that follow each other.
  const laid = packLanes(
    [
      span('2026-08-01', '2026-08-28'), // lane 0 all month
      span('2026-08-02', '2026-08-05'), // lane 1
      span('2026-08-10', '2026-08-12'), // lane 1 again — the first short one is over
    ],
    (s) => s,
  );
  assert.deepEqual(laid.map((l) => l.lane), [0, 1, 1]);
});

test('lanes are stable across a week boundary', () => {
  // The bug this replaces: per-week packing moved a running competition to a different row
  // every Sunday, so one event looked like several.
  const weekly = span('2026-08-10', '2026-08-17'); // Mon → next Mon, crosses a Sunday
  const laid = packLanes([span('2026-08-09', '2026-08-09'), weekly], (s) => s);
  const crossing = laid.find((l) => l.end.getTime() === weekly.end.getTime());
  // One lane for the whole run — there is only one entry for it, not one per week.
  assert.equal(laid.filter((l) => l.end.getTime() === weekly.end.getTime()).length, 1);
  assert.equal(typeof crossing?.lane, 'number');
});

test('gaps are the days nothing runs, and know how long they are', () => {
  const gaps = findGaps(
    [span('2026-08-01', '2026-08-10'), span('2026-08-18', '2026-08-31')],
    d('2026-08-01'),
    d('2026-08-31'),
  );
  assert.equal(gaps.length, 1);
  assert.equal(isoDay(gaps[0].start), '2026-08-11');
  assert.equal(isoDay(gaps[0].end), '2026-08-17');
  assert.equal(gaps[0].days, 7);
});

test('a fully covered window has no gaps', () => {
  const gaps = findGaps([span('2026-08-01', '2026-08-31')], d('2026-08-01'), d('2026-08-31'));
  assert.deepEqual(gaps, []);
});

test('an empty window is one big gap', () => {
  const gaps = findGaps([], d('2026-09-01'), d('2026-09-30'));
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].days, 30);
});

test('overlapping events do not double-count coverage', () => {
  const gaps = findGaps(
    [span('2026-08-01', '2026-08-20'), span('2026-08-05', '2026-08-31')],
    d('2026-08-01'),
    d('2026-08-31'),
  );
  assert.deepEqual(gaps, []);
});

test('minDays hides a one-day seam but keeps a real hole', () => {
  const spans = [span('2026-08-01', '2026-08-09'), span('2026-08-11', '2026-08-13')];
  assert.equal(findGaps(spans, d('2026-08-01'), d('2026-08-13'), 1).length, 1);
  assert.equal(findGaps(spans, d('2026-08-01'), d('2026-08-13'), 2).length, 0);
});

test('a span reaching outside the window is clamped, not iterated forever', () => {
  // A rolling ladder with a far-future end date must not cost a decade of day steps.
  const gaps = findGaps(
    [span('2020-01-01', '2030-01-01')],
    d('2026-08-01'),
    d('2026-08-31'),
  );
  assert.deepEqual(gaps, []);
});

test('week lanes compact without letting bars cross', () => {
  // A week using global lanes 0 and 5 should render two rows, in that order — not six.
  const inWeek = [
    { item: 'a', ...span('2026-08-10', '2026-08-12'), lane: 5 },
    { item: 'b', ...span('2026-08-10', '2026-08-11'), lane: 0 },
  ];
  const rows = laneRowsFor(inWeek, 4);
  assert.equal(rows.get(0), 0);
  assert.equal(rows.get(5), 1);
  assert.equal(rows.size, 2);
});

test('week lanes past the cap are dropped so the caller can count them', () => {
  const inWeek = [0, 1, 2, 3, 4, 5].map((lane) => ({
    item: lane,
    ...span('2026-08-10', '2026-08-12'),
    lane,
  }));
  const rows = laneRowsFor(inWeek, 4);
  assert.equal(rows.size, 4);
  assert.equal(rows.has(4), false);
});

test('dayOf keeps a midnight-UTC board date on the date someone typed', () => {
  // Boards serialise a date picker as midnight UTC. Read as local time this lands on the previous
  // day for every reader west of Greenwich, which is how the old calendar started boards a day
  // early in the Americas. It must resolve to the 10th regardless of where it is read.
  const day = dayOf('2026-07-10T00:00:00.000Z');
  assert.equal(day.getFullYear(), 2026);
  assert.equal(day.getMonth(), 6);
  assert.equal(day.getDate(), 10);
  assert.equal(day.getHours(), 0);
});

test('dayOf resolves a real instant in the reader’s own timezone', () => {
  // A weekly closes at a moment, not on a date, so it belongs on whatever local day that is.
  const raw = new Date('2026-06-14T19:00:00.000Z');
  const day = dayOf(raw);
  assert.equal(day.getDate(), raw.getDate());
  assert.equal(day.getMonth(), raw.getMonth());
  assert.equal(day.getHours(), 0);
});

test('a same-day span is one day long however its ends were stored', () => {
  const start = dayOf('2026-08-17T00:00:00.000Z');
  const end = dayOf('2026-08-17T00:00:00.000Z');
  assert.equal(daysBetween(start, end), 0);
});

test('addDays walks whole calendar days', () => {
  assert.equal(isoDay(addDays(d('2026-08-31'), 1)), '2026-09-01');
  assert.equal(isoDay(addDays(d('2026-01-01'), -1)), '2025-12-31');
});
