// Clan events: when an occurrence falls (lib/clanEventTimes), pure.
//
// Run: npx tsx --test tests/clan-events.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type ClanEventTiming, currentOccurrence, dueNotice, phaseOf } from '../src/lib/clanEventTimes';

const timing = (over: Partial<ClanEventTiming> = {}): ClanEventTiming => ({
  startsAt: '2026-10-20T19:00:00.000Z', // Tuesday 20:00 in London (BST ends 25 Oct)
  durationMin: 90,
  repeat: 'none',
  repeatUntil: null,
  timezone: 'Europe/London',
  cancelledAt: null,
  ...over,
});

test('a one-off is on until it ends, then gone', () => {
  const e = timing();
  assert.deepEqual(currentOccurrence(e, Date.parse('2026-10-20T10:00:00Z')), { start: '2026-10-20T19:00:00.000Z', end: '2026-10-20T20:30:00.000Z' });
  assert.equal(currentOccurrence(e, Date.parse('2026-10-20T20:00:00Z'))?.start, '2026-10-20T19:00:00.000Z', 'still on');
  assert.equal(currentOccurrence(e, Date.parse('2026-10-20T20:31:00Z')), null);
  assert.equal(currentOccurrence(timing({ cancelledAt: '2026-10-19 10:00:00' }), Date.parse('2026-10-20T10:00:00Z')), null);
});

test('a weekly keeps its local hour across the clock change, and stops at its last day', () => {
  const e = timing({ repeat: 'weekly' });
  // The week after the clocks go back, 20:00 London is 20:00 UTC.
  assert.equal(currentOccurrence(e, Date.parse('2026-10-21T12:00:00Z'))?.start, '2026-10-27T20:00:00.000Z');
  assert.equal(currentOccurrence(e, Date.parse('2026-12-31T12:00:00Z'))?.start, '2027-01-05T20:00:00.000Z');
  const ending = timing({ repeat: 'weekly', repeatUntil: '2026-11-04T00:00:00.000Z' });
  assert.equal(currentOccurrence(ending, Date.parse('2026-10-28T12:00:00Z'))?.start, '2026-11-03T20:00:00.000Z');
  assert.equal(currentOccurrence(ending, Date.parse('2026-11-04T12:00:00Z')), null, 'past its last day');
});

test('the reminder goes 15 minutes out, then "starting now", each once per occurrence', () => {
  const o = { start: '2026-10-27T20:00:00.000Z', end: '2026-10-27T21:30:00.000Z' };
  const at = (iso: string) => Date.parse(iso);
  assert.equal(phaseOf(o, at('2026-10-27T19:00:00Z')), 'upcoming');
  assert.equal(dueNotice(o, at('2026-10-27T19:00:00Z'), null, null), null);
  assert.equal(dueNotice(o, at('2026-10-27T19:46:00Z'), null, null), 'reminder');
  assert.equal(dueNotice(o, at('2026-10-27T19:50:00Z'), o.start, null), null, 'already reminded');
  assert.equal(dueNotice(o, at('2026-10-27T20:00:30Z'), o.start, null), 'start');
  assert.equal(dueNotice(o, at('2026-10-27T20:01:00Z'), null, null), 'start', 'a missed reminder is covered by the start');
  assert.equal(dueNotice(o, at('2026-10-27T20:10:00Z'), o.start, o.start), null);
  assert.equal(dueNotice(o, at('2026-10-27T20:10:00Z'), '2026-10-20T19:00:00.000Z', '2026-10-20T19:00:00.000Z'), 'start', "last week's doesn't count");
});
