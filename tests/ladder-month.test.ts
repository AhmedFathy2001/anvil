import test from 'node:test';
import assert from 'node:assert/strict';
import { monthKeyWindow, previousMonthKey } from '../src/lib/monthWindow.ts';
import { parseEventRules } from '../src/lib/eventRules.ts';

test('the month that just closed, including across a year boundary', () => {
  assert.equal(previousMonthKey(new Date('2026-09-04T10:00:00Z')), '2026-08');
  assert.equal(previousMonthKey(new Date('2026-01-01T00:00:01Z')), '2025-12');
  // The first instant of a month already belongs to it, so the previous one is what closed.
  assert.equal(previousMonthKey(new Date('2026-03-01T00:00:00Z')), '2026-02');
});

test('a month key becomes a half-open window over completedAt', () => {
  const august = monthKeyWindow('2026-08');
  assert.equal(august.start, '2026-08-01T00:00:00.000Z');
  assert.equal(august.end, '2026-09-01T00:00:00.000Z');
  // A completion at the last second of August is inside it; the first of September is not.
  assert.ok('2026-08-31T23:59:59.000Z' >= august.start && '2026-08-31T23:59:59.000Z' < august.end);
  assert.ok(!('2026-09-01T00:00:00.000Z' < august.end));
  // December rolls the year rather than producing month 13.
  assert.equal(monthKeyWindow('2026-12').end, '2027-01-01T00:00:00.000Z');
});

test('month-end config: absent means the month just rolls over, as it always did', () => {
  assert.equal(parseEventRules(null).monthlyAward, null);
  assert.equal(parseEventRules('{"revealPolicy":"all"}').monthlyAward, null);
});

test('month-end config: announcing is the default once it is turned on', () => {
  const on = parseEventRules('{"monthlyAward":{}}').monthlyAward;
  assert.equal(on?.announce, true);
  assert.equal(on?.roleId, null);
  const withRole = parseEventRules('{"monthlyAward":{"announce":false,"roleId":" 123 "}}').monthlyAward;
  assert.equal(withRole?.announce, false);
  assert.equal(withRole?.roleId, '123');
  // A blank role id is no role, not an empty-string role that Discord would 404 on.
  assert.equal(parseEventRules('{"monthlyAward":{"roleId":"  "}}').monthlyAward?.roleId, null);
});
