import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGapPrefill } from '../src/lib/gapPrefill';

test('valid start and end', () => {
  assert.deepEqual(parseGapPrefill('2026-11-20', '2026-11-25'), { start: '2026-11-20', end: '2026-11-25' });
});
test('start only', () => {
  assert.deepEqual(parseGapPrefill('2026-11-20', undefined), { start: '2026-11-20', end: null });
});
test('end before start is dropped', () => {
  assert.deepEqual(parseGapPrefill('2026-11-20', '2026-11-10'), { start: '2026-11-20', end: null });
});
test('junk and impossible dates are ignored', () => {
  assert.equal(parseGapPrefill('2026-02-30', '2026-03-01'), null);
  assert.equal(parseGapPrefill('tomorrow', undefined), null);
  assert.equal(parseGapPrefill(undefined, '2026-11-20'), null);
  assert.deepEqual(parseGapPrefill('2026-11-20', 'x'), { start: '2026-11-20', end: null });
  assert.deepEqual(parseGapPrefill(['2026-11-20'], undefined), { start: '2026-11-20', end: null });
});
