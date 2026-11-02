// The "All proofs" feed's URL filters (lib/proofFeedQuery).
//
// Run: npx tsx --test tests/proof-feed-query.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pageCount, parseProofFeedQuery, proofFeedSearch } from '../src/lib/proofFeedQuery.ts';

test('defaults: everything, page 1', () => {
  assert.deepEqual(parseProofFeedQuery(new URLSearchParams('')), { teamId: null, tileId: null, playerId: null, flag: 'all', page: 1 });
});

test('junk is ignored rather than trusted', () => {
  const q = parseProofFeedQuery(new URLSearchParams('team=abc&tile=-3&player=1.5&flag=maybe&page=0'));
  assert.deepEqual(q, { teamId: null, tileId: null, playerId: null, flag: 'all', page: 1 });
});

test('round-trips through the client builder', () => {
  const q = { teamId: 4, tileId: 9, playerId: 12, flag: 'unflagged' as const, page: 3 };
  assert.deepEqual(parseProofFeedQuery(new URLSearchParams(proofFeedSearch(q))), q);
  assert.equal(proofFeedSearch({ flag: 'all', page: 1 }), '');
});

test('page count never drops below one', () => {
  assert.equal(pageCount(0, 30), 1);
  assert.equal(pageCount(30, 30), 1);
  assert.equal(pageCount(31, 30), 2);
});
