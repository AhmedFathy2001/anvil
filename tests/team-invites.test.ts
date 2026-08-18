// Team invite links (lib/teamInvites) — whether a link may still be used, and what it says when it
// can't.
//
// Run: node --experimental-strip-types --test tests/team-invites.test.ts
// (lib/teamInvites imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TOKEN_LENGTH,
  checkInvite,
  describeInvite,
  generateInviteToken,
  invitePath,
  isWellFormedToken,
  type InviteRecord,
} from '../src/lib/teamInvites.ts';

const NOW = Date.parse('2026-08-17T12:00:00.000Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 86_400_000).toISOString();

const invite = (over: Partial<InviteRecord> = {}): InviteRecord => ({
  token: 'abcdefghijkmnpqr',
  teamId: 7,
  eventId: 3,
  maxUses: null,
  uses: 0,
  expiresAt: null,
  revokedAt: null,
  ...over,
});

const ctx = (over: Partial<{ now: number; eventId: number; signupsOpen: boolean }> = {}) => ({
  now: NOW,
  eventId: 3,
  signupsOpen: true,
  ...over,
});

/* ── the happy path ─────────────────────────────────────────────────────── */

test('a live invite with no limits is usable', () => {
  const c = checkInvite(invite(), ctx());
  assert.equal(c.ok, true);
  assert.equal(c.refusal, undefined);
  assert.equal(c.seatsLeft, null, 'no limit means no seat count');
});

test('a capped invite reports the seats left', () => {
  const c = checkInvite(invite({ maxUses: 10, uses: 4 }), ctx());
  assert.equal(c.ok, true);
  assert.equal(c.seatsLeft, 6);
});

/* ── refusals ───────────────────────────────────────────────────────────── */

test('an unknown token is refused without saying whether it ever existed', () => {
  const c = checkInvite(null, ctx());
  assert.equal(c.ok, false);
  // Deliberately the same shape of answer as a revoked link: probing must not distinguish them.
  assert.match(c.message, /not valid/);
});

test('a revoked invite is refused and says who can fix it', () => {
  const c = checkInvite(invite({ revokedAt: iso(-1) }), ctx());
  assert.equal(c.refusal, 'revoked');
  assert.match(c.message, /turned off/);
  assert.match(c.message, /new link/);
});

test('an expired invite is refused', () => {
  const c = checkInvite(invite({ expiresAt: iso(-1) }), ctx());
  assert.equal(c.refusal, 'expired');
});

test('expiry is exclusive of the exact moment it lapses', () => {
  assert.equal(checkInvite(invite({ expiresAt: new Date(NOW).toISOString() }), ctx()).refusal, 'expired');
  assert.equal(checkInvite(invite({ expiresAt: iso(1) }), ctx()).ok, true);
});

test('a full invite is refused and reports no seats', () => {
  const c = checkInvite(invite({ maxUses: 5, uses: 5 }), ctx());
  assert.equal(c.refusal, 'exhausted');
  assert.equal(c.seatsLeft, 0);
  assert.match(c.message, /full/);
});

test('over-use cannot make seats go negative', () => {
  // Two people submitting at once could push uses past the cap; the reader must never see "-1".
  const c = checkInvite(invite({ maxUses: 5, uses: 7 }), ctx());
  assert.equal(c.refusal, 'exhausted');
  assert.equal(c.seatsLeft, 0);
});

test('a link pasted from another board is refused as the wrong event', () => {
  const c = checkInvite(invite({ eventId: 3 }), ctx({ eventId: 99 }));
  assert.equal(c.refusal, 'wrong-event');
});

test('closed sign-ups refuse the link without implying it is broken', () => {
  const c = checkInvite(invite(), ctx({ signupsOpen: false }));
  assert.equal(c.refusal, 'closed');
  assert.doesNotMatch(c.message, /new link/, 'nobody needs to re-mint it — it just is not open yet');
});

/* ── precedence, because the reader gets one answer ─────────────────────── */

test('revoked outranks expired — that is the one the host will be asked about', () => {
  const c = checkInvite(invite({ revokedAt: iso(-1), expiresAt: iso(-2) }), ctx());
  assert.equal(c.refusal, 'revoked');
});

test('the wrong event outranks everything, since nothing else is even relevant', () => {
  const c = checkInvite(
    invite({ eventId: 3, revokedAt: iso(-1), expiresAt: iso(-1), maxUses: 1, uses: 9 }),
    ctx({ eventId: 4, signupsOpen: false }),
  );
  assert.equal(c.refusal, 'wrong-event');
});

test('being full outranks closed sign-ups', () => {
  const c = checkInvite(invite({ maxUses: 2, uses: 2 }), ctx({ signupsOpen: false }));
  assert.equal(c.refusal, 'exhausted');
});

/* ── tokens ─────────────────────────────────────────────────────────────── */

test('a minted token is the right length and drawn only from the safe alphabet', () => {
  const token = generateInviteToken((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
  assert.equal(token.length, TOKEN_LENGTH);
  assert.equal(isWellFormedToken(token), true);
});

test('every byte value maps into the alphabet, so no minted token is ever malformed', () => {
  // Masking to 5 bits over a 32-character alphabet is uniform and total — worth pinning, because a
  // gap here would mint links that the shape check then rejects.
  for (let base = 0; base < 256; base += 16) {
    const token = generateInviteToken((n) => Uint8Array.from({ length: n }, (_, i) => (base + i) % 256));
    assert.equal(isWellFormedToken(token), true, `byte base ${base} produced ${token}`);
  }
});

test('lookalike characters are excluded so a link survives being read aloud', () => {
  const token = generateInviteToken((n) => Uint8Array.from({ length: n }, () => 0));
  for (const ch of ['l', '1', '0', 'o']) {
    assert.equal(token.includes(ch), false, `${ch} is too easy to mistype`);
  }
});

test('a malformed token is rejected before it can become a query', () => {
  for (const bad of [null, undefined, '', 'short', 'ABCDEFGHIJKMNPQR', 'abcdefghijkmnpq!', 'abcdefghijkmnpqrs']) {
    assert.equal(isWellFormedToken(bad), false, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test('the invite path is relative, so it works on whatever domain the clan runs on', () => {
  assert.equal(invitePath(3, 'abcdefghijkmnpqr'), '/events/3/join/abcdefghijkmnpqr');
});

/* ── what the host reads in the panel ───────────────────────────────────── */

test('the panel line says how much of the invite is left', () => {
  assert.equal(describeInvite(invite({ uses: 4, maxUses: 10 }), NOW), '4 joined · 6 of 10 seats left');
  assert.equal(describeInvite(invite({ uses: 3, maxUses: null }), NOW), '3 joined · no limit');
  assert.equal(describeInvite(invite({ uses: 5, maxUses: 5 }), NOW), '5 joined · full');
  assert.equal(describeInvite(invite({ revokedAt: iso(-1) }), NOW), 'Turned off');
  assert.equal(describeInvite(invite({ expiresAt: iso(-1) }), NOW), 'Expired');
});

test('a revoked invite reads as turned off even when it also expired', () => {
  assert.equal(describeInvite(invite({ revokedAt: iso(-1), expiresAt: iso(-2) }), NOW), 'Turned off');
});
