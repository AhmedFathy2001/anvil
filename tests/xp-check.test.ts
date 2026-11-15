import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingXpCheck, xpCheckLine, type AttemptRow } from '../src/lib/xpCheck';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const row = (o: Partial<AttemptRow>): AttemptRow => ({ id: 1, rsn: 'Zezima', expiresAt: '2026-11-15T12:20:00.000Z', completedAt: null, minDelta: 1000, baselineSnapshot: '{"_target":"mining","attack":5}', ...o });

test('an open, unexpired attempt resumes with its skill and the minutes left', () => {
  const p = pendingXpCheck([row({})], NOW)!;
  assert.equal(p.targetSkill, 'mining');
  assert.equal(p.minutesLeft, 20);
  assert.equal(xpCheckLine(p), 'Your XP check for Zezima is running: 20 min left.');
});

test('expired and finished attempts do not resume', () => {
  assert.equal(pendingXpCheck([row({ expiresAt: '2026-11-15T11:59:00.000Z' })], NOW), null);
  assert.equal(pendingXpCheck([row({ completedAt: '2026-11-15T12:01:00.000Z' })], NOW), null);
});

test('the newest open attempt wins; the clock is rounded up and never 0', () => {
  const p = pendingXpCheck([row({ id: 1 }), row({ id: 2, rsn: 'Other', expiresAt: '2026-11-15T12:00:10.000Z' })], NOW)!;
  assert.equal(p.rsn, 'Other');
  assert.equal(p.minutesLeft, 1);
});

test('a space-format expiry is read as UTC too', () => {
  assert.equal(pendingXpCheck([row({ expiresAt: '2026-11-15 12:05:00' })], NOW)!.minutesLeft, 5);
});

test('an unreadable baseline still shows the running timer', () => {
  assert.equal(pendingXpCheck([row({ baselineSnapshot: 'nope' })], NOW)!.targetSkill, '');
});
