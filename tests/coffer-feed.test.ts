// What the coffer channel says about a movement.
//
// Pure string building, pinned because these lines are how a clan finds out its money moved — and
// because the unfunded case is the one nobody tests until it happens to them.
//
// Run: npm run test:cofferfeed

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cofferLine } from '../src/lib/cofferFeedText.ts';

type Entry = Parameters<typeof cofferLine>[0];
const entry = (over: Partial<Entry>): Entry =>
  ({
    id: 1,
    clanId: 1,
    kind: 'donation',
    amount: 1_000_000,
    status: 'approved',
    clanMemberId: 1,
    rsn: 'Zezima',
    createdByUserId: null,
    settledByUserId: null,
    settledAt: null,
    eventId: null,
    tileId: null,
    completionId: null,
    weeklyCompetitionId: null,
    place: null,
    proofBlobUrl: null,
    note: null,
    createdAt: '2026-09-06',
    ...over,
  }) as Entry;

test('a donation reads differently before and after staff look at it', () => {
  assert.match(cofferLine(entry({ status: 'pending' }), null), /reported/);
  assert.match(cofferLine(entry({ status: 'pending' }), null), /waiting on staff/);
  assert.match(cofferLine(entry({ status: 'approved' }), null), /donated/);
  assert.match(cofferLine(entry({ status: 'rejected' }), null), /rejected/);
});

test('a prize that cannot be paid says so plainly', () => {
  // The whole reason unfunded rows are written rather than dropped: somebody won and the pot was
  // empty, and that has to be visible rather than silent.
  const line = cofferLine(
    entry({ kind: 'award', status: 'unfunded', amount: -5_000_000, note: 'BOTW: Zulrah — 1st' }),
    0,
  );
  assert.match(line, /could not cover it/);
  assert.match(line, /BOTW: Zulrah/);
});

test('an award owed and an award paid are not the same sentence', () => {
  assert.match(cofferLine(entry({ kind: 'award', status: 'reserved', amount: -1 }), null), /is owed/);
  assert.match(cofferLine(entry({ kind: 'award', status: 'paid', amount: -1 }), null), /was paid/);
});

test('an adjustment says which way it went', () => {
  assert.match(cofferLine(entry({ kind: 'adjustment', amount: 500, rsn: null }), null), /added/);
  assert.match(cofferLine(entry({ kind: 'adjustment', amount: -500, rsn: null }), null), /taken/);
});

test('amounts read as gp, and negatives are not shown as negative', () => {
  // An award is stored as a negative movement; "-5,000,000 gp paid" would read as a refund.
  const line = cofferLine(entry({ kind: 'award', status: 'paid', amount: -5_000_000 }), null);
  assert.match(line, /5,000,000 gp/);
  assert.doesNotMatch(line, /-5,000,000/);
});

test('the balance rides along when we know it, and is omitted when we do not', () => {
  assert.match(cofferLine(entry({}), 12_345), /Coffer now holds \*\*12,345 gp\*\*/);
  assert.doesNotMatch(cofferLine(entry({}), null), /Coffer now holds/);
});

test('a movement nobody owns still reads as a sentence', () => {
  assert.match(cofferLine(entry({ rsn: null, kind: 'adjustment', amount: 10 }), null), /coffer/);
});
