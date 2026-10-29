// The in-game clan join date (lib/clanJoinDate).
//
// Run: node --experimental-strip-types --test tests/clan-join-date.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { joinDateChanged, joinDateFromDays } from '../src/lib/clanJoinDate.ts';

const now = new Date('2026-10-29T10:00:00Z');

test('days ago becomes a date; junk does not', () => {
  assert.equal(joinDateFromDays(0, now), '2026-10-29');
  assert.equal(joinDateFromDays(366, now), '2025-10-28');
  assert.equal(joinDateFromDays(-1, now), null);
  assert.equal(joinDateFromDays(1.5, now), null);
  assert.equal(joinDateFromDays(undefined, now), null);
});

test('a one-day wobble between reporters rewrites nothing; a real change does', () => {
  assert.equal(joinDateChanged('2025-10-28', '2025-10-29'), false);
  assert.equal(joinDateChanged('2025-10-28', '2025-10-31'), true);
  assert.equal(joinDateChanged(null, '2025-10-28'), true);
  assert.equal(joinDateChanged('2025-10-28', null), false);
});
