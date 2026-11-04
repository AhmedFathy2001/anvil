// Seats at once across overlapping events (lib/concurrentSeats): the sweep line behind a host's
// player cap. Pure — no database.
//
// Run: npx tsx --test tests/concurrent-seats.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  eventWindow,
  newlyCovered,
  peakConcurrentSeats,
  roomVerdict,
  windowChangeVerdict,
  type SeatWindow,
} from '../src/lib/concurrentSeats.ts';

const day = (d: number) => Date.UTC(2026, 9, d); // Oct d, 2026
const iso = (d: number) => new Date(day(d)).toISOString();
const w = (id: number, from: number, to: number, seats: number): SeatWindow => ({ id, start: day(from), end: to === Infinity ? Infinity : day(to), seats });

test('eventWindow: drafts have none, force-end ends it, no end is open-ended', () => {
  assert.equal(eventWindow({ startDate: null, endDate: iso(10), forceEndedAt: null }), null, 'undated draft');
  assert.deepEqual(eventWindow({ startDate: iso(7), endDate: iso(10), forceEndedAt: null }), { start: day(7), end: day(10) });
  assert.deepEqual(eventWindow({ startDate: iso(7), endDate: null, forceEndedAt: null }), { start: day(7), end: Infinity }, 'open-ended');
  assert.deepEqual(eventWindow({ startDate: iso(7), endDate: iso(10), forceEndedAt: iso(8) }), { start: day(7), end: day(8) }, 'force-ended early');
  assert.deepEqual(eventWindow({ startDate: iso(7), endDate: null, forceEndedAt: iso(9) }), { start: day(7), end: day(9) }, 'open-ended, then ended');
  assert.deepEqual(eventWindow({ startDate: iso(7), endDate: iso(8), forceEndedAt: iso(12) }), { start: day(7), end: day(8) }, 'a later force-end changes nothing');
  assert.equal(eventWindow({ startDate: iso(7), endDate: null, forceEndedAt: iso(6) }), null, 'ended before it began');
  assert.equal(eventWindow({ startDate: 'not a date', endDate: null, forceEndedAt: null }), null);
});

test('peak: one event is its own count; nothing is 0', () => {
  assert.deepEqual(peakConcurrentSeats([]), { peak: 0, at: null, ids: [] });
  assert.equal(peakConcurrentSeats([w(1, 7, 10, 400)]).peak, 400);
});

test('peak: the owner’s examples (Oct 7–10 + Oct 8–11 share; Oct 1–3 and Oct 7–10 do not)', () => {
  const overlap = peakConcurrentSeats([w(1, 7, 10, 600), w(2, 8, 11, 500)]);
  assert.equal(overlap.peak, 1100);
  assert.equal(overlap.at, day(8));
  assert.deepEqual(overlap.ids, [1, 2]);
  assert.equal(peakConcurrentSeats([w(1, 1, 3, 900), w(2, 7, 10, 900)]).peak, 900, 'apart: each on its own');
});

test('peak: touching endpoints do not overlap (half-open windows)', () => {
  assert.equal(peakConcurrentSeats([w(1, 1, 5, 700), w(2, 5, 9, 700)]).peak, 700);
});

test('peak: identical windows add up; nested windows add up', () => {
  assert.equal(peakConcurrentSeats([w(1, 3, 6, 200), w(2, 3, 6, 300)]).peak, 500);
  const nested = peakConcurrentSeats([w(1, 1, 20, 100), w(2, 5, 7, 50), w(3, 6, 8, 25)]);
  assert.equal(nested.peak, 175, 'outer + both inner where all three meet');
  assert.equal(nested.at, day(6));
});

test('peak: a chain A–B–C where A and C never meet is the worst PAIR, not the sum', () => {
  const chain = [w(1, 1, 5, 400), w(2, 4, 8, 300), w(3, 7, 11, 500)];
  const p = peakConcurrentSeats(chain);
  assert.equal(p.peak, 800, 'B + C');
  assert.deepEqual(p.ids, [3, 2]);
  assert.notEqual(p.peak, 1200);
});

test('peak: open-ended overlaps everything after it; `from` drops the past', () => {
  const ws = [w(1, 1, Infinity, 300), w(2, 20, 25, 400), w(3, 2, 4, 900)];
  assert.equal(peakConcurrentSeats(ws).peak, 1200, 'the open-ended one and the early big one');
  assert.equal(peakConcurrentSeats(ws, { from: day(10) }).peak, 700, 'from Oct 10 the early one is over');
});

test('peak: `within` only looks inside the given spans; empty and seatless windows change nothing', () => {
  const ws = [w(1, 1, 10, 100), w(2, 5, 15, 200), w(3, 6, 6, 999), w(4, 1, 30, 0)];
  assert.equal(peakConcurrentSeats(ws, { within: [{ start: day(1), end: day(5) }] }).peak, 100);
  assert.equal(peakConcurrentSeats(ws, { within: [{ start: day(11), end: day(20) }] }).peak, 200);
  assert.equal(peakConcurrentSeats(ws).peak, 300);
});

test('seats, not people: one person in two overlapping events counts twice', () => {
  // Each event's count is its enrolments; the same person enrolled on both is one seat on each.
  const onePersonTwice = [w(1, 7, 10, 1), w(2, 8, 11, 1)];
  assert.equal(peakConcurrentSeats(onePersonTwice).peak, 2);
  // So with a cap of 1 they cannot hold a second overlapping seat…
  assert.equal(roomVerdict({ cap: 1, target: { id: 2, window: { start: day(8), end: day(11) }, seats: 0 }, others: [w(1, 7, 10, 1)], adding: 1 }).ok, false);
  // …but can on dates that don't overlap.
  assert.equal(roomVerdict({ cap: 1, target: { id: 2, window: { start: day(12), end: day(14) }, seats: 0 }, others: [w(1, 7, 10, 1)], adding: 1 }).ok, true);
});

test('roomVerdict: refuses only past the cap, anywhere in THIS event’s window', () => {
  const A = w(1, 7, 10, 600);
  const target = { id: 2, window: { start: day(8), end: day(11) }, seats: 399 };
  assert.deepEqual(roomVerdict({ cap: 1000, target, others: [A], adding: 1 }), { ok: true, peak: 999 });
  const no = roomVerdict({ cap: 1000, target, others: [A], adding: 2 });
  assert.equal(no.ok, false);
  if (!no.ok) {
    assert.equal(no.total, 1001);
    assert.deepEqual(no.others, [1], 'names the overlapping event');
    assert.equal(no.at, day(8));
  }
  // An event far away from the target never counts against it.
  assert.equal(roomVerdict({ cap: 1000, target, others: [A, w(3, 20, 25, 1000)], adding: 1 }).ok, true);
  // In a chain the target in the middle sees both neighbours, one at a time.
  const mid = { id: 2, window: { start: day(4), end: day(8) }, seats: 100 };
  const chain = [w(1, 1, 5, 400), w(3, 7, 11, 500)];
  assert.equal(roomVerdict({ cap: 1000, target: mid, others: chain, adding: 400 }).ok, true, '500+100+400 = 1000 at worst');
  assert.equal(roomVerdict({ cap: 1000, target: mid, others: chain, adding: 401 }).ok, false);
});

test('roomVerdict: drafts and ended events are judged on their own seats', () => {
  const others = [w(1, 1, Infinity, 950)];
  const draft = { id: 2, window: null, seats: 49 };
  assert.equal(roomVerdict({ cap: 50, target: draft, others, adding: 1 }).ok, true, 'a draft overlaps nothing');
  assert.equal(roomVerdict({ cap: 50, target: draft, others, adding: 2 }).ok, false, 'but still has the cap on its own');
  // An event that ended before `from` frees its time; its own board still counts.
  const ended = { id: 3, window: { start: day(1), end: day(3) }, seats: 10 };
  assert.equal(roomVerdict({ cap: 1000, target: ended, others, adding: 5, from: day(10) }).ok, true);
});

test('roomVerdict: no cap, nothing added, or an edit is never refused — even over the cap', () => {
  const over = { id: 2, window: { start: day(1), end: day(9) }, seats: 2000 };
  assert.equal(roomVerdict({ cap: null, target: over, others: [], adding: 5 }).ok, true);
  assert.equal(roomVerdict({ cap: 1000, target: over, others: [], adding: 0 }).ok, true);
  assert.equal(roomVerdict({ cap: 1000, target: over, others: [], adding: 1 }).ok, false, 'over after a downgrade: nobody new');
});

test('newlyCovered: what a window change adds', () => {
  const b = { start: day(5), end: day(10) };
  assert.deepEqual(newlyCovered({ start: day(6), end: day(9) }, b), [], 'shortened');
  assert.deepEqual(newlyCovered({ start: day(3), end: day(10) }, b), [{ start: day(3), end: day(5) }], 'earlier start');
  assert.deepEqual(newlyCovered({ start: day(5), end: day(12) }, b), [{ start: day(10), end: day(12) }], 'later end');
  assert.deepEqual(newlyCovered({ start: day(3), end: day(12) }, b), [{ start: day(3), end: day(5) }, { start: day(10), end: day(12) }]);
  assert.deepEqual(newlyCovered({ start: day(20), end: day(22) }, b), [{ start: day(20), end: day(22) }], 'moved');
  assert.deepEqual(newlyCovered({ start: day(1), end: day(2) }, null), [{ start: day(1), end: day(2) }], 'a draft getting dates');
  assert.deepEqual(newlyCovered(null, b), [], 'undated again');
});

test('windowChangeVerdict: moving onto another event is refused; shortening or moving apart is fine', () => {
  const other = w(1, 10, 15, 700);
  const base = { cap: 1000, eventId: 2, seats: 400, others: [other] };
  const before = { start: day(1), end: day(5) };
  const onto = windowChangeVerdict({ ...base, before, after: { start: day(1), end: day(12) } });
  assert.equal(onto.ok, false);
  if (!onto.ok) {
    assert.equal(onto.total, 1100);
    assert.deepEqual(onto.others, [1]);
  }
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(1), end: day(10) } }).ok, true, 'touching is not overlapping');
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(2), end: day(4) } }).ok, true, 'shortened');
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(20), end: day(25) } }).ok, true, 'moved apart');
  assert.equal(windowChangeVerdict({ ...base, before: null, after: { start: day(11), end: day(12) } }).ok, false, 'a draft dated onto it');
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(1), end: Infinity } }).ok, false, 'made open-ended into it');
  assert.equal(windowChangeVerdict({ ...base, cap: null, before, after: { start: day(1), end: day(12) } }).ok, true, 'no cap');
  assert.equal(windowChangeVerdict({ ...base, seats: 0, before, after: { start: day(1), end: day(12) } }).ok, true, 'an empty board adds nobody');
});

test('windowChangeVerdict: already over the cap where it ran — tidying is allowed, spreading is not', () => {
  // A downgrade left 1,200 at once on Oct 3–5. Shortening into that span changes nothing.
  const others = [w(1, 1, 6, 700)];
  const before = { start: day(3), end: day(9) };
  const base = { cap: 1000, eventId: 2, seats: 500, others };
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(4), end: day(9) } }).ok, true);
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(2), end: day(9) } }).ok, false, 'reaching further into the overlap');
  assert.equal(windowChangeVerdict({ ...base, before, after: { start: day(3), end: day(12) } }).ok, true, 'longer, but the new days are clear');
});

test('windowChangeVerdict: `from` ignores the past (Start now, resume)', () => {
  const others = [w(1, 1, 4, 900)];
  // Resuming an event force-ended on Oct 3 (orig. end Oct 9) on Oct 5: the overlap on Oct 3–4 is past.
  const v = windowChangeVerdict({ cap: 1000, eventId: 2, seats: 300, others, before: { start: day(2), end: day(3) }, after: { start: day(2), end: day(9) }, from: day(5) });
  assert.equal(v.ok, true);
  const v2 = windowChangeVerdict({ cap: 1000, eventId: 2, seats: 300, others, before: { start: day(2), end: day(3) }, after: { start: day(2), end: day(9) }, from: day(3) });
  assert.equal(v2.ok, false, 'on Oct 3 the other event is still running');
});
