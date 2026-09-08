// A roster push that changes nothing should write nothing.
//
// The plugin sends the in-game roster whenever an admin's clan channel loads — many times a day on
// a busy clan. Every existing member used to be written on every one of those, two UPDATEs each,
// one of them the wide `accounts` row. Production showed it as every seat in the clan carrying the
// identical update count: each sync rewrote the whole roster to change nothing.
//
// Run: npx tsx --test tests/roster-sync-diff.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accountChanged, seatChanged, lastSeenIsFresh, type RosterFacts } from '../src/lib/rosterSync.ts';

const HOUR = 60 * 60 * 1000;
const NOW = '2026-09-08T12:00:00.000Z';

const facts = (over: Partial<RosterFacts> = {}): RosterFacts => ({
  rsn: 'Drenvox mdps',
  rsnNormalized: 'drenvox mdps',
  accountHash: 'hash-1',
  previousRsns: null,
  rank: 'captain',
  kind: 'member',
  source: 'roster',
  leftAt: null,
  ...over,
});

test('the ordinary sync: the roster says what it said last time, and writes nothing', () => {
  const stored = facts();
  assert.equal(accountChanged(stored, facts()), false);
  assert.equal(seatChanged(stored, facts()), false);
});

test('a promotion is a seat write', () => {
  assert.equal(seatChanged(facts(), facts({ rank: 'general' })), true);
  // …and not an account write: a rank belongs to the seat.
  assert.equal(accountChanged(facts(), facts({ rank: 'general' })), false);
});

test('a rename is an account write', () => {
  const renamed = facts({ rsn: 'Denoverse', rsnNormalized: 'denoverse', previousRsns: '["Drenvox mdps"]' });
  assert.equal(accountChanged(facts(), renamed), true);
  // The seat did not move: same person, same clan, same rank.
  assert.equal(seatChanged(facts(), renamed), false);
});

test('a guest the roster now ranks, and a member who came back, are seat writes', () => {
  assert.equal(seatChanged(facts({ kind: 'guest' }), facts()), true);
  assert.equal(seatChanged(facts({ leftAt: '2026-08-01T00:00:00.000Z' }), facts()), true);
});

test('null and undefined are the same absence — an absent value is not a change', () => {
  // The nullable columns arrive as null from the database and undefined from a payload that omits
  // them; comparing those with !== would mark every row dirty forever.
  assert.equal(accountChanged(facts({ accountHash: null }), facts({ accountHash: null })), false);
  assert.equal(seatChanged(facts({ rank: null }), facts({ rank: null })), false);
  assert.equal(seatChanged(facts({ leftAt: null }), facts({ leftAt: null })), false);
});

test('an account hash first seen is a write, because it is the rename-proof anchor', () => {
  assert.equal(accountChanged(facts({ accountHash: null }), facts({ accountHash: 'hash-1' })), true);
});

test('last-seen refreshes hourly, not per push', () => {
  const tenMinutesAgo = new Date(Date.parse(NOW) - 10 * 60_000).toISOString();
  const twoHoursAgo = new Date(Date.parse(NOW) - 2 * HOUR).toISOString();
  assert.equal(lastSeenIsFresh(tenMinutesAgo, NOW, HOUR), true, 'seen this hour — leave it alone');
  assert.equal(lastSeenIsFresh(twoHoursAgo, NOW, HOUR), false, 'stale enough to be worth a write');
});

test('a member never stamped is never fresh, and a bad stamp is not fresh either', () => {
  assert.equal(lastSeenIsFresh(null, NOW, HOUR), false);
  assert.equal(lastSeenIsFresh(undefined, NOW, HOUR), false);
  assert.equal(lastSeenIsFresh('not a date', NOW, HOUR), false);
});

test('a stamp from the future is clock skew, not a reason to write', () => {
  const ahead = new Date(Date.parse(NOW) + HOUR).toISOString();
  assert.equal(lastSeenIsFresh(ahead, NOW, HOUR), true);
});
