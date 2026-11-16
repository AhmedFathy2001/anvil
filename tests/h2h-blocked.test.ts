import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockedPeople, DELETED_ACCOUNT } from '../src/lib/h2hBlocked';

const c = (playerId: number, rsn: string, isPrimary = 0, verifiedAt: string | null = '2026-01-01', provisional = 0) => ({ playerId, rsn, verifiedAt, provisional, isPrimary });

test('names the main verified character', () => {
  const out = blockedPeople([5], [c(5, 'Alt One'), c(5, 'Zed Main', 1), c(5, 'Unverified', 1, null)]);
  assert.deepEqual(out, [{ playerId: 5, name: 'Zed Main' }]);
});
test('a person with no verified character, or no row, is a deleted account', () => {
  const out = blockedPeople([6, 7], [c(6, 'Prov', 0, '2026-01-01', 1)]);
  assert.deepEqual(out.map((p) => p.name), [DELETED_ACCOUNT, DELETED_ACCOUNT]);
});
test('keeps the stored order', () => {
  assert.deepEqual(blockedPeople([2, 1], [c(1, 'A'), c(2, 'B')]).map((p) => p.playerId), [2, 1]);
});
