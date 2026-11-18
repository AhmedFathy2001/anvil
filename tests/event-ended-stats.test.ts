import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventEndedAtMs, startedAfterEnd } from '../src/lib/eventEnd.ts';

const now = Date.parse('2026-11-18T00:00:00Z');

test('a running or upcoming event has no end to stop at', () => {
  assert.equal(eventEndedAtMs({ startDate: '2026-11-10T00:00:00Z', endDate: '2026-11-25T00:00:00Z' }, now), null);
});

test('an ended event stops at its end date, or at its force-end when that came first', () => {
  const ended = { startDate: '2026-10-15T00:00:00Z', endDate: '2026-10-29T20:00:00Z' };
  assert.equal(eventEndedAtMs(ended, now), Date.parse('2026-10-29T20:00:00Z'));
  assert.equal(eventEndedAtMs({ ...ended, forceEndedAt: '2026-10-27 12:00:00' }, now), Date.parse('2026-10-27T12:00:00Z'));
});

test('a starting line read after the end counts for nothing; one read during the event stands', () => {
  const end = Date.parse('2026-10-29T20:00:00Z');
  assert.equal(startedAfterEnd('2026-11-03 09:00:00', end), true);
  assert.equal(startedAfterEnd('2026-10-20T09:00:00.000Z', end), false);
  assert.equal(startedAfterEnd(null, end), false);
  assert.equal(startedAfterEnd('2026-11-03 09:00:00', null), false);
});

import { closeGains, gainAtClose, gainSinceReveal, parseRevealStats } from '../src/lib/revealStats.ts';

test('a closed tile holds each player at their gain when it closed', () => {
  const json = JSON.stringify({ 7: { g: 10, l: 500 }, _close: { 7: 3, 8: 0 } });
  const close = closeGains(json);
  assert.equal(gainAtClose(149, close, 7), 3);
  assert.equal(gainAtClose(2, close, 7), 2);
  assert.equal(gainAtClose(5, close, 8), 0);
  // Joined after it closed: nothing of theirs counts on it.
  assert.equal(gainAtClose(149, close, 99), 0);
});

test('a tile with no close record reads as before, and the announce capture is untouched', () => {
  const json = JSON.stringify({ 7: { g: 10, l: 500 } });
  assert.equal(closeGains(json), null);
  assert.equal(gainAtClose(149, null, 7), 149);
  assert.equal(gainSinceReveal(25, parseRevealStats(JSON.stringify({ 7: { g: 10, l: 500 }, _close: { 7: 3 } })), 7), 15);
});
