// Trips away from the site that have to land the person back where they were.
//
//   - joining a clan's Discord from an event's Discord step (the Discord sign-in, with the join scope)
//   - linking Twitch or YouTube for a creator event's gate (a signed state carries the path)
//   - account deletion's "sign out and sign in again" (back to Settings > Account)
//
// None of these can complete locally, so what is pinned here is the part the site owns: the path it
// asks to come back to, that the path survives the checks at both ends, and that a tampered one
// does not.
//
// Run: npm run test:roundtrips

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { safeReturnPath } from '../src/lib/safe-redirect.ts';
import { firstLoginDestination } from '../src/lib/firstLogin.ts';
import { signState, verifyState, STATE_TTL_MS } from '../src/lib/twitch.ts';

test('the event Discord step comes back to that step, clan prefix and all', () => {
  // What DiscordJoinClient asks for: `${clan prefix}/events/<id>/discord?auto=1`.
  for (const path of ['/c/ironforge/events/19/discord?auto=1', '/s/lcl-creator/events/4/discord?auto=1']) {
    const start = new URL(`https://x.test/api/auth/discord/start?join=1&return=${encodeURIComponent(path)}`);
    // Checked when the trip starts (stored in a cookie beside the state) and again at the callback.
    assert.equal(safeReturnPath(start.searchParams.get('return')), path);
    assert.equal(safeReturnPath(safeReturnPath(start.searchParams.get('return'))), path);
    // And a sign-in that happens to be the person's first is not diverted to the chooser.
    assert.equal(firstLoginDestination(path, false), path);
  }
});

test('a Twitch or YouTube gate link carries the event page in its signed state, and only an untampered one comes back', () => {
  const key = 'k'.repeat(32);
  const path = '/s/lcl-creator/events/4';
  const state = { u: 7, m: 'viewer' as const, c: null, r: safeReturnPath(path), h: null, n: 'nonce-of-sixteen-chars', e: Date.now() + STATE_TTL_MS };
  const token = signState(state, key);
  const back = verifyState(token, key);
  assert.equal(back?.r, path);
  assert.equal(back?.u, 7);
  assert.equal(safeReturnPath(back?.r), path, 'the callback checks the path again');

  // Swapping the path for another site breaks the signature.
  const [body, mac] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...state, r: 'https://evil.example/' })).toString('base64url');
  assert.equal(verifyState(`${forged}.${mac}`, key), null);
  assert.equal(verifyState(`${body}.${mac}x`, key), null);
  assert.equal(verifyState(token, 'another-key'), null);
  // An expired one is no good either.
  assert.equal(verifyState(signState({ ...state, e: Date.now() - 1 }, key), key), null);
});

test('even a correctly signed state cannot send anybody off the site', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '']) {
    assert.equal(safeReturnPath(bad), '/');
  }
});

test('deleting an account: "sign out and sign in again" comes back to Settings > Account', () => {
  // The link DeleteAccountClient builds: out first, then straight into the Discord sign-in.
  const href = `/api/auth/logout?return=${encodeURIComponent(`/api/auth/discord/start?return=${encodeURIComponent('/settings/account#your-data')}`)}`;
  const logout = new URL(href, 'https://x.test');
  const afterLogout = safeReturnPath(logout.searchParams.get('return'));
  assert.equal(afterLogout, '/api/auth/discord/start?return=%2Fsettings%2Faccount%23your-data', 'sign-out hands straight on to the sign-in');
  const start = new URL(afterLogout, 'https://x.test');
  assert.equal(safeReturnPath(start.searchParams.get('return')), '/settings/account#your-data');
});
