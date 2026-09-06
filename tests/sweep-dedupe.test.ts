// One hiscores fetch per character, however many clan seats it holds.
//
// This could not be proven on the box: production has 24 accounts holding two live seats, but every
// one of them is a MEMBER in one clan and a GUEST in the other, and the roster pass only enqueues
// member seats — so the first tick after shipping it reported seatsCollapsed=0, correctly. The
// duplicate only reaches the work list when a competition claims the second seat, which no clan is
// running right now. Hence a test, rather than waiting for the day it matters.
//
// Run: npm run test:sweepdedupe

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeSeatsByAccount } from '../src/lib/sweepWork.ts';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const seat = (over: Partial<Parameters<typeof mergeSeatsByAccount>[0] extends Iterable<infer T> ? T : never> = {}) => ({
  accountId: 1 as number | null,
  fetchRsn: 'Zezima',
  clanMemberId: 10 as number | null,
  staleKey: 'zzzz',
  nextDueAt: null as string | null,
  rosterOnly: true,
  bingo: [] as unknown[],
  weekly: [] as unknown[],
  ...over,
});

test('two seats for one account become one fetch', () => {
  const out = mergeSeatsByAccount([seat({ clanMemberId: 10 }), seat({ clanMemberId: 77 })], norm);
  assert.equal(out.length, 1);
  assert.equal(out[0].accountId, 1);
});

test('different accounts are never merged, same RSN text or not', () => {
  const out = mergeSeatsByAccount([seat({ accountId: 1 }), seat({ accountId: 2 })], norm);
  assert.equal(out.length, 2);
});

test('without an account id it falls back to the RSN, which is what gets fetched', () => {
  const out = mergeSeatsByAccount(
    [seat({ accountId: null, fetchRsn: 'Zezima' }), seat({ accountId: null, fetchRsn: 'zezima' })],
    norm,
  );
  assert.equal(out.length, 1);
});

test("each clan's work survives the merge — that is the whole point", () => {
  const a = seat({ clanMemberId: 10, bingo: ['tile-a'], weekly: ['comp-a'] });
  const b = seat({ clanMemberId: 77, bingo: ['tile-b'], weekly: ['comp-b'] });
  const out = mergeSeatsByAccount([a, b], norm);
  assert.deepEqual(out[0].bingo, ['tile-a', 'tile-b']);
  assert.deepEqual(out[0].weekly, ['comp-a', 'comp-b']);
});

test('a competition in ANY clan makes them priority work, not roster filler', () => {
  const out = mergeSeatsByAccount(
    [seat({ clanMemberId: 10, rosterOnly: true }), seat({ clanMemberId: 77, rosterOnly: false })],
    norm,
  );
  assert.equal(out[0].rosterOnly, false);
});

test('"due now" beats any scheduled time, and the earliest schedule wins', () => {
  const now = mergeSeatsByAccount(
    [seat({ clanMemberId: 10, nextDueAt: '2026-01-01T00:00:00Z' }), seat({ clanMemberId: 77, nextDueAt: null })],
    norm,
  );
  assert.equal(now[0].nextDueAt, null);

  const earliest = mergeSeatsByAccount(
    [
      seat({ clanMemberId: 10, nextDueAt: '2026-06-01T00:00:00Z' }),
      seat({ clanMemberId: 77, nextDueAt: '2026-01-01T00:00:00Z' }),
    ],
    norm,
  );
  assert.equal(earliest[0].nextDueAt, '2026-01-01T00:00:00Z');
});

test('the oldest staleKey wins, so the queue still sorts by who waited longest', () => {
  const out = mergeSeatsByAccount(
    [seat({ clanMemberId: 10, staleKey: 'zzzz' }), seat({ clanMemberId: 77, staleKey: '2026-01-01' })],
    norm,
  );
  assert.equal(out[0].staleKey, '2026-01-01');
});
