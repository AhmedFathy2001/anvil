import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from '../src/lib/clockFormat.ts';

test('a clock shows minutes and seconds under an hour, hours under a day, days beyond', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(3599), '59:59');
  assert.equal(formatClock(953 * 60 + 12), '15h 53m');
  assert.equal(formatClock(3600), '1h 00m');
  assert.equal(formatClock(86400 + 3 * 3600 + 59), '1d 3h');
  assert.equal(formatClock(-5), '0:00');
});
