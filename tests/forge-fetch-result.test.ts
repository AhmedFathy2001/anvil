// The pure half of the Forge fetch queue (lib/forgeFetchResult): what a stored row means, and which
// work entry a result is applied to. The rule worth pinning above all is that an OLD read is dropped
// rather than applied — applied, it would look like a stranger took the name (less XP than last time)
// and park a perfectly good account.
//
// Run: npx tsx --test tests/forge-fetch-result.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_RESULT_AGE_MS, nextProbeStep, planForgeApply, toFetchResult, type FetchedRow } from '../src/lib/forgeFetchResult.ts';

const key = (rsn: string) => rsn.toLowerCase().replace(/[_\s]+/g, ' ').trim();
const now = new Date('2026-10-12T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const row = (id: number, rsnKey: string, fetchedAt: Date, outcome = 'ok'): FetchedRow => ({
  id,
  rsnKey,
  outcome,
  body: '{"x":1}',
  fetchedAt,
});

test('toFetchResult: ok parses, unranked passes through, anything else is transient', () => {
  const parse = (b: string) => JSON.parse(b) as { x: number };
  assert.deepEqual(toFetchResult({ outcome: 'ok', body: '{"x":1}' }, parse), { kind: 'value', snapshot: { x: 1 } });
  assert.deepEqual(toFetchResult({ outcome: 'unranked', body: null }, parse), { kind: 'unranked' });
  assert.deepEqual(toFetchResult({ outcome: 'transient', body: null }, parse), { kind: 'transient' });
  assert.deepEqual(toFetchResult({ outcome: 'ok', body: null }, parse), { kind: 'transient' }, 'ok with no body');
  assert.deepEqual(toFetchResult({ outcome: 'ok', body: 'not json' }, parse), { kind: 'transient' }, 'a bad body never throws');
  assert.deepEqual(toFetchResult({ outcome: null, body: null }, parse), { kind: 'transient' });
});

test('planForgeApply: matches by normalised name, every entry with that name gets the read', () => {
  const a = { fetchRsn: 'Some_Guy' };
  const a2 = { fetchRsn: 'some guy' };
  const b = { fetchRsn: 'Other' };
  const plan = planForgeApply([row(1, 'some guy', ago(60_000))], [a, a2, b], key, now);
  assert.deepEqual(plan.applies.map((x) => x.entry), [a, a2]);
  assert.deepEqual([...plan.appliedKeys], ['some guy']);
  assert.equal(plan.orphaned, 0);
  assert.equal(plan.stale, 0);
});

test('planForgeApply: the newest of two reads for one name wins', () => {
  const e = { fetchRsn: 'Zezima' };
  const plan = planForgeApply([row(1, 'zezima', ago(120_000)), row(2, 'zezima', ago(60_000))], [e], key, now);
  assert.equal(plan.applies.length, 1);
  assert.equal(plan.applies[0].rowId, 2);
});

test('planForgeApply: an old read is dropped, a result nobody wants is orphaned', () => {
  const e = { fetchRsn: 'Zezima' };
  const plan = planForgeApply(
    [row(1, 'zezima', ago(MAX_RESULT_AGE_MS + 1000)), row(2, 'gone', ago(1000))],
    [e],
    key,
    now,
  );
  assert.equal(plan.applies.length, 0);
  assert.equal(plan.stale, 1);
  assert.equal(plan.orphaned, 1);
  assert.equal(plan.appliedKeys.size, 0, 'a dropped read leaves the name free to be queued again');
});

test('type probe: not on the ironman table settles with NO type — regular and group look the same there', () => {
  assert.deepEqual(nextProbeStep('ironman', 'unranked', null, 5_000_000), { kind: 'done', type: null });
});

test('type probe: on the ironman table but behind the main table is a de-ironed account', () => {
  assert.deepEqual(nextProbeStep('ironman', 'ok', 3_000_000, 5_000_000), { kind: 'done', type: 'normal' });
});

test('type probe: a current ironman goes on to ultimate, then hardcore', () => {
  assert.deepEqual(nextProbeStep('ironman', 'ok', 5_000_000, 5_000_000), { kind: 'next', mode: 'ultimate' });
  assert.deepEqual(nextProbeStep('ironman', 'ok', 5_000_100, 5_000_000), { kind: 'next', mode: 'ultimate' }, 'read later, ahead is fine');
  assert.deepEqual(nextProbeStep('ultimate', 'ok', 5_000_000, 5_000_000), { kind: 'done', type: 'ultimate' });
  assert.deepEqual(nextProbeStep('ultimate', 'unranked', null, 5_000_000), { kind: 'next', mode: 'hardcore' });
  assert.deepEqual(nextProbeStep('hardcore', 'ok', 5_000_000, 5_000_000), { kind: 'done', type: 'hardcore' });
  assert.deepEqual(nextProbeStep('hardcore', 'unranked', null, 5_000_000), { kind: 'done', type: 'ironman' });
});

test('type probe: a frozen ultimate or dead hardcore entry falls through to plain ironman', () => {
  assert.deepEqual(nextProbeStep('ultimate', 'ok', 4_000_000, 5_000_000), { kind: 'next', mode: 'hardcore' });
  assert.deepEqual(nextProbeStep('hardcore', 'ok', 4_000_000, 5_000_000), { kind: 'done', type: 'ironman' });
});

test('type probe: a failed read, or no main-table XP to compare against, retries later', () => {
  assert.deepEqual(nextProbeStep('ironman', 'transient', null, 5_000_000), { kind: 'retry' });
  assert.deepEqual(nextProbeStep('ironman', 'ok', 5_000_000, null), { kind: 'retry' });
  assert.deepEqual(nextProbeStep('ultimate', 'ok', -1, 0), { kind: 'retry' });
});
