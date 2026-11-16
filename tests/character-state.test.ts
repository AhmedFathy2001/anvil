import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterState, mayDisplace, mayJoinWith } from '../src/lib/characterState.ts';
import { checkInvite, inviteClosedMessage, inviteSignupWindow } from '../src/lib/teamInvites.ts';

const manualPending = { verifiedAt: null, provisional: 1, verificationMethod: 'manual' };
const xpPassed = { verifiedAt: '2026-11-16T10:00:00.000Z', provisional: 1, verificationMethod: 'stat_delta' };
const proven = { verifiedAt: '2026-11-16T10:00:00.000Z', provisional: 0, verificationMethod: 'plugin' };

test('states read from the existing columns', () => {
  assert.equal(characterState(manualPending), 'awaiting-manual');
  assert.equal(characterState(xpPassed), 'passed-awaiting-review');
  assert.equal(characterState(proven), 'verified');
  assert.equal(characterState({ verifiedAt: null, provisional: 0, verificationMethod: null }), null);
  assert.equal(characterState({ verifiedAt: null, provisional: 1, verificationMethod: 'plugin_first_use' }), null);
  assert.equal(mayJoinWith({}), false);
});

test('an unconfirmed claim never beats a proven one; the reverse never happens', () => {
  // proven (plugin, XP, staff) displaces a manual claim nobody confirmed
  assert.equal(mayDisplace(manualPending, { verified: true, method: 'plugin' }), true);
  assert.equal(mayDisplace(manualPending, { verified: true, method: 'stat_delta' }), true);
  // another manual claim, or an unproven incoming one, does not
  assert.equal(mayDisplace(manualPending, { verified: false, method: 'manual' }), false);
  assert.equal(mayDisplace(manualPending, { verified: true, method: 'manual' }), false);
  // nobody displaces a confirmed or XP-passed holder
  assert.equal(mayDisplace(proven, { verified: true, method: 'plugin' }), false);
  assert.equal(mayDisplace(xpPassed, { verified: true, method: 'plugin' }), false);
  assert.equal(mayDisplace(proven, { verified: false, method: 'manual' }), false);
});

test('an invite seats a late joiner on a running event, but not past the host switching it off or the end', () => {
  const running = { open: false, reason: 'event_started' as const };
  assert.deepEqual(inviteSignupWindow(running, false), { open: true, reason: null });
  assert.equal(inviteSignupWindow(running, true).open, false);
  assert.equal(inviteSignupWindow({ open: false, reason: 'off' }, false).open, false);
  assert.equal(inviteSignupWindow({ open: false, reason: 'closed' }, false).open, false);
  assert.equal(inviteSignupWindow({ open: false, reason: 'not_open_yet' }, false).open, false);
  assert.equal(inviteSignupWindow({ open: true, reason: null }, false).open, true);
});

test('invite limits still apply on a running event, and closed reasons are said plainly', () => {
  const base = { token: 't', teamId: 1, eventId: 7, maxUses: 2, uses: 0, expiresAt: null, revokedAt: null };
  const ctx = { now: Date.now(), eventId: 7, signupsOpen: true };
  assert.equal(checkInvite(base, ctx).ok, true);
  assert.equal(checkInvite({ ...base, uses: 2 }, ctx).refusal, 'exhausted');
  assert.equal(checkInvite({ ...base, revokedAt: '2026-01-01T00:00:00Z' }, ctx).refusal, 'revoked');
  assert.equal(checkInvite({ ...base, expiresAt: '2000-01-01T00:00:00Z' }, ctx).refusal, 'expired');
  assert.equal(checkInvite(base, { ...ctx, eventId: 8 }).refusal, 'wrong-event');
  assert.match(inviteClosedMessage('off', false), /by hand/);
  assert.match(inviteClosedMessage('closed', false), /deadline/);
  assert.match(inviteClosedMessage('event_started', true), /finished/);
  assert.equal(checkInvite(base, { ...ctx, signupsOpen: false, closedMessage: inviteClosedMessage('off', false) }).message, inviteClosedMessage('off', false));
});
