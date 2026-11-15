import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAudit, isAutomatic, pageOf } from '../src/lib/auditFilter.ts';

const row = (eventType: string, actorDisplayName: string | null = null, memberRsn: string | null = 'Zezima', notes: string | null = null) => ({
  eventType,
  actorDisplayName,
  memberRsn,
  notes,
});
const rows = [row('left'), row('joined'), row('settings_changed', 'Ahmed'), row('renamed', 'Ahmed'), row('feature_toggled')];

test('automatic means a roster change nobody made', () => {
  assert.equal(isAutomatic(row('left')), true);
  assert.equal(isAutomatic(row('left', 'Ahmed')), false);
  assert.equal(isAutomatic(row('feature_toggled')), false);
});

test('people scope hides sync rows, sync scope shows only them', () => {
  assert.deepEqual(filterAudit(rows, { scope: 'people' }).map((r) => r.eventType), ['settings_changed', 'renamed', 'feature_toggled']);
  assert.deepEqual(filterAudit(rows, { scope: 'sync' }).map((r) => r.eventType), ['left', 'joined']);
  assert.equal(filterAudit(rows, { scope: 'all' }).length, 5);
});

test('type and search narrow further', () => {
  assert.equal(filterAudit(rows, { scope: 'all', type: 'left' }).length, 1);
  assert.equal(filterAudit(rows, { scope: 'all', query: 'ahmed' }).length, 2);
  assert.equal(filterAudit(rows, { scope: 'all', query: 'feature toggled' }).length, 1);
});

test('paging clamps', () => {
  const list = Array.from({ length: 60 }, (_, i) => i);
  assert.deepEqual(pageOf(list, 1).rows.length, 25);
  assert.equal(pageOf(list, 3).rows.length, 10);
  assert.equal(pageOf(list, 99).page, 3);
  assert.equal(pageOf([], 1).pages, 1);
});
