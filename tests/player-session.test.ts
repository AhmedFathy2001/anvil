// The player-link session is re-checked against the participant row on every use (lib/playerSession),
// and a submission accepts whichever of the request's credentials fits the team (lib/submissionAccess).
//
// Run: npx tsx --test tests/player-session.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYER_SESSION_MAX_AGE_MS,
  parsePlayerSessionPayload,
  playerSessionMatchesRow,
  playerTokenHash,
} from '../src/lib/playerSession.ts';
import { decideDeleteAccess, decideSubmitAccess, teamCredentialCovers } from '../src/lib/submissionAccess.ts';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const TOKEN = 'link-token-abc';

function payload(over: Record<string, unknown> = {}) {
  return { role: 'player', playerId: 7, teamId: 3, tk: playerTokenHash(TOKEN), iat: NOW - DAY, ...over };
}

/** The whole verifyPlayer decision past the signature: claims, then the row. */
function check(data: unknown, row: { teamId: number | null; playerToken: string | null } | null) {
  const s = parsePlayerSessionPayload(data, NOW);
  return !!s && playerSessionMatchesRow(s, row);
}

test('token hash is short hex, stable, and differs per token', () => {
  const h = playerTokenHash(TOKEN);
  assert.match(h, /^[0-9a-f]{32}$/);
  assert.equal(h, playerTokenHash(TOKEN));
  assert.notEqual(h, playerTokenHash('other-token'));
});

test('a valid session on an unchanged row passes', () => {
  assert.equal(check(payload(), { teamId: 3, playerToken: TOKEN }), true);
  assert.deepEqual(parsePlayerSessionPayload(payload(), NOW), { playerId: 7, teamId: 3, tk: playerTokenHash(TOKEN) });
});

test('a player moved to another team is refused', () => {
  assert.equal(check(payload(), { teamId: 4, playerToken: TOKEN }), false);
  assert.equal(check(payload(), { teamId: null, playerToken: TOKEN }), false);
});

test('a player removed from the event is refused', () => {
  assert.equal(check(payload(), null), false);
});

test('a re-tokened player is refused', () => {
  assert.equal(check(payload(), { teamId: 3, playerToken: 'regenerated' }), false);
  assert.equal(check(payload(), { teamId: 3, playerToken: null }), false);
});

test('an 8-day-old session is refused even though the shared window is 30 days', () => {
  assert.equal(PLAYER_SESSION_MAX_AGE_MS, 7 * DAY);
  assert.equal(check(payload({ iat: NOW - 8 * DAY }), { teamId: 3, playerToken: TOKEN }), false);
  assert.equal(check(payload({ iat: NOW - 7 * DAY + 1000 }), { teamId: 3, playerToken: TOKEN }), true);
});

test('a session from the future (beyond clock skew) is refused', () => {
  assert.equal(check(payload({ iat: NOW + 10 * 60 * 1000 }), { teamId: 3, playerToken: TOKEN }), false);
});

test('a session with no token hash (minted before this check) is refused', () => {
  const old: Record<string, unknown> = payload();
  delete old.tk;
  assert.equal(check(old, { teamId: 3, playerToken: TOKEN }), false);
  assert.equal(check(payload({ tk: '' }), { teamId: 3, playerToken: TOKEN }), false);
});

test('malformed payloads are refused', () => {
  for (const bad of [null, 'x', payload({ role: 'captain' }), payload({ playerId: '7' }), payload({ teamId: undefined }), payload({ iat: 'yesterday' })]) {
    assert.equal(parsePlayerSessionPayload(bad, NOW), null);
  }
});

// --- submissions: combining credentials ---------------------------------------------------------

const member = { userId: 1, isCaptain: true, playerId: 50 };

test('captain (web seat) with a stale player cookie for another team is allowed, and the cookie is dropped', () => {
  const d = decideSubmitAccess(5, { captain: null, player: { playerId: 7, teamId: 3 }, pluginAuth: null, membership: member });
  assert.equal(d.ok, true);
  if (d.ok) {
    assert.equal(d.player, null);
    assert.equal(d.membership, member);
  }
});

test('captain cookie for this team with a stale player cookie for another is allowed', () => {
  const d = decideSubmitAccess(5, { captain: { teamId: 5 }, player: { playerId: 7, teamId: 3 }, pluginAuth: null, membership: null });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.player, null);
});

test('a player cookie for team A cannot file for team B', () => {
  const d = decideSubmitAccess(5, { captain: null, player: { playerId: 7, teamId: 3 }, pluginAuth: null, membership: null });
  assert.deepEqual(d, { ok: false, status: 403, error: 'Cannot submit for another team' });
});

test('no credential at all is a 401', () => {
  const d = decideSubmitAccess(5, { captain: null, player: null, pluginAuth: null, membership: null });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.status, 401);
});

test('a fitting player cookie passes', () => {
  const d = decideSubmitAccess(3, { captain: null, player: { playerId: 7, teamId: 3 }, pluginAuth: null, membership: null });
  assert.equal(d.ok, true);
  if (d.ok) assert.deepEqual(d.player, { playerId: 7, teamId: 3 });
});

test('the web-session lookup is skipped only when a credential already covers the team', () => {
  assert.equal(teamCredentialCovers(5, null, { teamId: 3 }), false);
  assert.equal(teamCredentialCovers(5, { teamId: 5 }, null), true);
});

test('delete: managing web seat with a stale player cookie for another team may remove any of the team', () => {
  assert.equal(
    decideDeleteAccess({ teamId: 5, playerId: 99 }, { captain: null, player: { playerId: 7, teamId: 3 }, membership: { canManage: true, playerId: null } }),
    'manage',
  );
});

test('delete: member removes their own; a player cookie for another team grants nothing there', () => {
  const stale = { playerId: 7, teamId: 3 };
  assert.equal(decideDeleteAccess({ teamId: 5, playerId: 50 }, { captain: null, player: stale, membership: { canManage: false, playerId: 50 } }), 'own');
  assert.equal(decideDeleteAccess({ teamId: 5, playerId: 7 }, { captain: null, player: stale, membership: null }), 'denied');
  assert.equal(decideDeleteAccess({ teamId: 3, playerId: 7 }, { captain: null, player: stale, membership: { canManage: false, playerId: 60 } }), 'own');
  assert.equal(decideDeleteAccess({ teamId: 5, playerId: 99 }, { captain: { teamId: 3 }, player: null, membership: null }), 'denied');
  assert.equal(decideDeleteAccess({ teamId: 5, playerId: null }, { captain: null, player: null, membership: { canManage: false, playerId: 50 } }), 'denied');
});
