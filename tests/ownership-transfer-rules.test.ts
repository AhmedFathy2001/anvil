// The rules of a clan ownership transfer request (lib/ownershipTransferRules) — pure, no database.
//
// What must hold: the hold is exactly 72h; only the owner who asked cancels, only the target
// declines, only platform staff block or let through; nothing acts on a request that is no longer
// pending; a request is due only when pending and past completes_at; at the end of the hold it moves
// only if the asker is still owner and the target is still an admin with a verified login.
//
// Run: npx tsx --test tests/ownership-transfer-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOLD_MS,
  checkTransferAction,
  completionDecision,
  isDue,
  transferCompletesAt,
} from '../src/lib/ownershipTransferRules.ts';

const now = Date.parse('2026-11-08T12:00:00.000Z');
const pending = { status: 'pending', fromUserId: 1, toUserId: 2, completesAt: transferCompletesAt(now), staffClearedAt: null };
const owner = { userId: 1, isPlatformStaff: false };
const target = { userId: 2, isPlatformStaff: false };
const otherAdmin = { userId: 3, isPlatformStaff: false };
const staff = { userId: 9, isPlatformStaff: true };

test('the hold is 72 hours from the request', () => {
  assert.equal(HOLD_MS, 72 * 3_600_000);
  assert.equal(transferCompletesAt(now), '2026-11-11T12:00:00.000Z');
  assert.equal(transferCompletesAt('2026-11-08T12:00:00.000Z'), '2026-11-11T12:00:00.000Z');
});

test('due only when pending and the hold has run out', () => {
  assert.equal(isDue(pending, now), false);
  assert.equal(isDue(pending, now + HOLD_MS - 1), false);
  assert.equal(isDue(pending, now + HOLD_MS), true);
  assert.equal(isDue({ ...pending, status: 'cancelled' }, now + HOLD_MS * 2), false);
  assert.equal(isDue({ ...pending, status: 'completed' }, now + HOLD_MS * 2), false);
});

test('only the owner who asked can cancel', () => {
  assert.deepEqual(checkTransferAction(pending, owner, 'cancel'), { ok: true, next: 'cancelled' });
  for (const who of [target, otherAdmin, staff]) {
    const r = checkTransferAction(pending, who, 'cancel');
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.code, 403);
  }
});

test('only the target can decline', () => {
  assert.deepEqual(checkTransferAction(pending, target, 'decline'), { ok: true, next: 'declined' });
  for (const who of [owner, otherAdmin, staff]) assert.equal(checkTransferAction(pending, who, 'decline').ok, false);
});

test('only platform staff can block or let through', () => {
  assert.deepEqual(checkTransferAction(pending, staff, 'block'), { ok: true, next: 'blocked' });
  // Letting it through keeps it pending: the hold still runs.
  assert.deepEqual(checkTransferAction(pending, staff, 'clear'), { ok: true, next: 'pending' });
  for (const who of [owner, target, otherAdmin]) {
    assert.equal(checkTransferAction(pending, who, 'block').ok, false);
    assert.equal(checkTransferAction(pending, who, 'clear').ok, false);
  }
  const cleared = checkTransferAction({ ...pending, staffClearedAt: '2026-11-09T00:00:00.000Z' }, staff, 'clear');
  assert.equal(!cleared.ok && cleared.code, 409);
  // A transfer staff let through can still be blocked later.
  assert.equal(checkTransferAction({ ...pending, staffClearedAt: '2026-11-09T00:00:00.000Z' }, staff, 'block').ok, true);
});

test('nothing acts on a request that is no longer pending', () => {
  for (const status of ['cancelled', 'declined', 'blocked', 'completed']) {
    for (const [who, action] of [[owner, 'cancel'], [target, 'decline'], [staff, 'block'], [staff, 'clear']] as const) {
      const r = checkTransferAction({ ...pending, status }, who, action);
      assert.equal(r.ok, false, `${action} on ${status}`);
      assert.equal(!r.ok && r.code, 409);
    }
  }
});

test('a request past its hold can still be cancelled until the tick completes it', () => {
  assert.equal(checkTransferAction({ ...pending, completesAt: new Date(now - 1).toISOString() }, owner, 'cancel').ok, true);
});

test('completion: only when the asker is still owner and the target still a verified admin', () => {
  assert.deepEqual(completionDecision({ fromRole: 'owner', targetRole: 'admin', targetVerified: true }), { complete: true });
  const cases = [
    { fromRole: 'admin', targetRole: 'admin', targetVerified: true },
    { fromRole: null, targetRole: 'admin', targetVerified: true },
    { fromRole: 'owner', targetRole: null, targetVerified: true },
    { fromRole: 'owner', targetRole: 'moderator', targetVerified: true },
    { fromRole: 'owner', targetRole: 'member', targetVerified: true },
    { fromRole: 'owner', targetRole: 'admin', targetVerified: false },
  ];
  for (const c of cases) {
    const d = completionDecision(c);
    assert.equal(d.complete, false, JSON.stringify(c));
    assert.ok(!d.complete && d.reason.length > 0);
  }
});
