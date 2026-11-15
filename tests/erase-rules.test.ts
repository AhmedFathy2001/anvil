// The rules around deleting an account and exporting its data (src/lib/personData.ts): what blocks a
// deletion, what a ban keeps, what never leaves in an export, and the two checks on the request.
//
// Pure. Run: npm run test:erase

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ERASE_RECENT_SESSION_MS,
  activePaidPlan,
  confirmPhraseMatches,
  eraseBlockers,
  neverExported,
  redactRow,
  retainedBan,
  sessionIsRecent,
  type EraseFacts,
} from '../src/lib/personData.ts';

const clean: EraseFacts = { ownedClans: [], supporterRows: [], platformRole: 'none', otherLogins: 0 };

test('nothing in the way: no blockers', () => {
  assert.deepEqual(eraseBlockers(clean), []);
});

test('owning a clan or a creator space blocks, and names it', () => {
  const b = eraseBlockers({
    ...clean,
    ownedClans: [
      { id: 1, slug: 'afk', name: 'The AFK Spot', kind: 'clan' },
      { id: 2, slug: 'drenvox', name: 'Drenvox', kind: 'creator' },
    ],
  });
  assert.equal(b.length, 1);
  assert.equal(b[0].kind, 'owns-clan');
  assert.match(b[0].message, /The AFK Spot, Drenvox/);
  if (b[0].kind === 'owns-clan') assert.deepEqual(b[0].clans.map((c) => c.slug), ['afk', 'drenvox']);
});

test('a paid plan that still renews blocks; one already cancelled, ended, refunded or gifted does not', () => {
  assert.equal(activePaidPlan([{ status: 'active', gumroadSubscriptionId: 'sub_1' }]), 'sub_1');
  const b = eraseBlockers({ ...clean, supporterRows: [{ status: 'active', gumroadSubscriptionId: 'sub_1' }] });
  assert.equal(b.length, 1);
  assert.equal(b[0].kind, 'active-plan');
  if (b[0].kind === 'active-plan') assert.equal(b[0].subscriptionId, 'sub_1');
  assert.match(b[0].message, /Gumroad/);

  for (const status of ['cancelling', 'ended', 'refunded']) {
    assert.deepEqual(eraseBlockers({ ...clean, supporterRows: [{ status, gumroadSubscriptionId: 'sub_1' }] }), [], status);
  }
  // A gift or invite reward: in force, but there is no subscription at the provider to cancel.
  assert.deepEqual(eraseBlockers({ ...clean, supporterRows: [{ status: 'active', gumroadSubscriptionId: null }] }), []);
  assert.deepEqual(eraseBlockers({ ...clean, supporterRows: [{ status: 'granted', gumroadSubscriptionId: null }] }), []);
});

test('staff of the platform and a person with two logins are refused here', () => {
  assert.deepEqual(eraseBlockers({ ...clean, platformRole: 'support' }).map((b) => b.kind), ['platform-staff']);
  assert.deepEqual(eraseBlockers({ ...clean, otherLogins: 1 }).map((b) => b.kind), ['second-login']);
});

test('every blocker is reported at once', () => {
  const b = eraseBlockers({
    ownedClans: [{ id: 1, slug: 'afk', name: 'The AFK Spot', kind: 'clan' }],
    supporterRows: [{ status: 'active', gumroadSubscriptionId: 'sub_1' }],
    platformRole: 'root',
    otherLogins: 2,
  });
  assert.deepEqual(b.map((x) => x.kind), ['owns-clan', 'active-plan', 'platform-staff', 'second-login']);
});

// ── What a ban keeps ──────────────────────────────────────────────────────────────────────────────

const noBan = { discordId: '123456789012345678', userBanned: false, userBannedAt: null, playerBanned: false, playerBannedAt: null, liveClanBanIds: [] };

test('no ban: nothing is kept', () => {
  assert.equal(retainedBan(noBan), null);
});

test('a clan ban keeps the Discord id and the ban ids, and not one other thing about the person', () => {
  const kept = retainedBan({ ...noBan, liveClanBanIds: [7, 9] });
  assert.deepEqual(kept, {
    user: { discordId: '123456789012345678', displayName: '', banned: false, bannedAt: null },
    player: { displayName: null, banned: false, bannedAt: null },
    clanBanIds: [7, 9],
  });
  // The exact shape is the promise: adding a field here is keeping more about a deleted person.
  assert.deepEqual(Object.keys(kept!.user).sort(), ['banned', 'bannedAt', 'discordId', 'displayName']);
  assert.deepEqual(Object.keys(kept!.player).sort(), ['banned', 'bannedAt', 'displayName']);
});

test('a platform ban carries over at the level it was set, with its date and no reason', () => {
  const kept = retainedBan({ ...noBan, playerBanned: true, playerBannedAt: '2026-03-01 10:00:00' });
  assert.deepEqual(kept?.player, { displayName: null, banned: true, bannedAt: '2026-03-01 10:00:00' });
  assert.equal(kept?.user.banned, false);
  assert.ok(!('bannedReason' in kept!.player) && !('bannedReason' in kept!.user));
  const login = retainedBan({ ...noBan, userBanned: true, userBannedAt: '2026-04-01 10:00:00' });
  assert.deepEqual(login?.user, { discordId: '123456789012345678', displayName: '', banned: true, bannedAt: '2026-04-01 10:00:00' });
});

test('with no Discord id there is nothing to recognise them by, so nothing is kept', () => {
  assert.equal(retainedBan({ ...noBan, discordId: null, liveClanBanIds: [7] }), null);
  assert.equal(retainedBan({ ...noBan, discordId: '', playerBanned: true }), null);
});

// ── Export redaction ──────────────────────────────────────────────────────────────────────────────

test('only listed columns leave, and a secret never does even when listed', () => {
  const row = {
    id: 4,
    created_at: '2026-01-01',
    last_used_at: null,
    revoked_at: null,
    token: 'plain-token',
    token_hash: 'abc123',
    user_id: 9,
  };
  assert.deepEqual(redactRow('plugin_links', ['id', 'created_at', 'last_used_at', 'revoked_at'], row), {
    id: 4,
    created_at: '2026-01-01',
    last_used_at: null,
    revoked_at: null,
  });
  // A mistake in a list is still not a leak.
  assert.deepEqual(redactRow('plugin_links', ['id', 'token', 'token_hash'], row), { id: 4 });
});

test('secrets, hashes and staff notes are never exportable', () => {
  for (const c of [
    'plugin_token', 'plugin_token_hash', 'token', 'token_hash', 'access_token', 'refresh_token', 'password_hash', 'account_hash',
    'device_code_hash', 'player_token', 'session_version', 'admin_notes', 'staff_note', 'review_note', 'decision_note', 'decided_note',
    'flagged_reason', 'banned_reason', 'net_hash',
  ]) {
    assert.equal(neverExported('any_table', c), true, c);
  }
  // A personal webhook URL is a credential; a proof link is the person's own upload.
  assert.equal(neverExported('user_webhooks', 'url'), true);
  assert.equal(neverExported('proof_uploads', 'url'), false);
  assert.equal(neverExported('submission_attachments', 'url'), false);
  for (const c of ['rsn', 'email', 'display_name', 'image_url', 'created_at', 'status']) assert.equal(neverExported('any_table', c), false, c);
});

// ── The request ───────────────────────────────────────────────────────────────────────────────────

test('they type DELETE exactly, or their own display name', () => {
  assert.equal(confirmPhraseMatches('DELETE', 'Zezima'), true);
  assert.equal(confirmPhraseMatches('  DELETE ', 'Zezima'), true);
  assert.equal(confirmPhraseMatches('delete', 'Zezima'), false);
  assert.equal(confirmPhraseMatches('zezima', 'Zezima'), true);
  assert.equal(confirmPhraseMatches('Zezim', 'Zezima'), false);
  assert.equal(confirmPhraseMatches('', ''), false);
  assert.equal(confirmPhraseMatches('   ', '   '), false);
  assert.equal(confirmPhraseMatches(undefined, 'Zezima'), false);
  assert.equal(confirmPhraseMatches({ toString: () => 'DELETE' }, 'Zezima'), false);
});

test('only a session signed in a short while ago may delete', () => {
  const now = 1_800_000_000_000;
  assert.equal(sessionIsRecent(now - 60_000, now), true);
  assert.equal(sessionIsRecent(now - ERASE_RECENT_SESSION_MS, now), true);
  assert.equal(sessionIsRecent(now - ERASE_RECENT_SESSION_MS - 1, now), false);
  assert.equal(sessionIsRecent(now - 29 * 24 * 60 * 60 * 1000, now), false);
  assert.equal(sessionIsRecent(now + 60 * 60 * 1000, now), false);
  assert.equal(sessionIsRecent(null, now), false);
  assert.equal(sessionIsRecent(Number.NaN, now), false);
});
