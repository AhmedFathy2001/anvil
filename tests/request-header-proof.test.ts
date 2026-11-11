// The headers middleware forwards inward, and everything that decides from them.
//
// Run: npx tsx --test tests/request-header-proof.test.ts (pure — no database).
//
// The bug these cover: middleware's matcher skipped any path ending in .png/.txt/…, but those still
// route to real pages (`/admin/events/5.png` → admin/events/[eventId], parseInt → 5). With middleware
// skipped, nobody stripped the caller's x-anvil-* headers, and the admin layout fell back to
// `/admin/dashboard` — which every moderator may open — and rendered the event admin for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

import {
  clanHeaderProof,
  pathHeaderProof,
  provenClanSlug,
  provenPath,
} from '../src/lib/requestHeaderProof.ts';
import { adminGateTarget, type AdminAccess } from '../src/lib/adminAccess.ts';
import { intParam } from '../src/lib/routeIds.ts';
import { config } from '../src/middleware.ts';

const SECRET = process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret';
const nodeHmac = (msg: string) => createHmac('sha256', SECRET).update(msg).digest('hex');
const bag = (h: Record<string, string>) => new Headers(h);

// ── The proof ────────────────────────────────────────────────────────────────────────────────

test('clan proof is byte-for-byte what middleware signed before (blue/green safe)', async () => {
  assert.equal(await clanHeaderProof('alpha'), nodeHmac('anvil-clan-header:alpha'));
});

test('path proof covers the path and the query, kept apart by a newline', async () => {
  assert.equal(await pathHeaderProof('/admin/events', '?x=1'), nodeHmac('anvil-path-header:/admin/events\n?x=1'));
});

test('a proven slug reads back; tampered, wrong-length and missing proofs do not', async () => {
  const proof = await clanHeaderProof('alpha');
  assert.equal(await provenClanSlug(bag({ 'x-anvil-clan-slug': 'alpha', 'x-anvil-clan-proof': proof })), 'alpha');
  assert.equal(await provenClanSlug(bag({ 'x-anvil-clan-slug': 'bravo', 'x-anvil-clan-proof': proof })), null, 'proof for another slug');
  const flipped = (proof[0] === 'a' ? 'b' : 'a') + proof.slice(1);
  assert.equal(await provenClanSlug(bag({ 'x-anvil-clan-slug': 'alpha', 'x-anvil-clan-proof': flipped })), null, 'tampered');
  assert.equal(await provenClanSlug(bag({ 'x-anvil-clan-slug': 'alpha', 'x-anvil-clan-proof': proof.slice(0, 10) })), null, 'wrong length');
  assert.equal(await provenClanSlug(bag({ 'x-anvil-clan-slug': 'alpha' })), null, 'missing — the bare header a caller can send');
});

test('a proven path reads back; a changed query or a forged path does not', async () => {
  const proof = await pathHeaderProof('/admin/events', '?a=1');
  const ok = bag({ 'x-anvil-pathname': '/admin/events', 'x-anvil-search': '?a=1', 'x-anvil-path-proof': proof });
  assert.deepEqual(await provenPath(ok), { pathname: '/admin/events', search: '?a=1' });
  assert.equal(await provenPath(bag({ 'x-anvil-pathname': '/admin/events', 'x-anvil-search': '?a=2', 'x-anvil-path-proof': proof })), null, 'search changed');
  assert.equal(await provenPath(bag({ 'x-anvil-pathname': '/admin/dashboard', 'x-anvil-search': '?a=1', 'x-anvil-path-proof': proof })), null, 'path changed');
  assert.equal(await provenPath(bag({ 'x-anvil-pathname': '/admin/events' })), null, 'no proof at all');
  assert.equal(await provenPath(bag({})), null, 'middleware never ran');
});

// ── The admin layout's gate ─────────────────────────────────────────────────────────────────

const access = (over: Partial<AdminAccess>): AdminAccess => ({
  role: 'member',
  canEditTiles: false,
  editorScope: 'all',
  canEditGuides: false,
  treasurerScope: 'all',
  ...over,
} as AdminAccess);

test('unknown path + moderator goes to the dashboard instead of rendering', () => {
  assert.equal(adminGateTarget(null, access({ role: 'moderator' })), '/admin/dashboard');
});

test('unknown path + admin proceeds (they may open every admin page anyway)', () => {
  assert.equal(adminGateTarget(null, access({ role: 'admin' })), null);
  assert.equal(adminGateTarget(null, access({ role: 'owner' })), null);
});

test('unknown path + board treasurer goes to /admin/events', () => {
  assert.equal(adminGateTarget(null, access({ role: 'treasurer', treasurerScope: 'assigned' })), '/admin/events');
});

test('a proven path keeps the existing redirectFor answer', () => {
  assert.equal(adminGateTarget('/admin/dashboard', access({ role: 'moderator' })), null);
  assert.equal(adminGateTarget('/admin/dashboard', access({ role: 'admin' })), null);
});

// ── Ids out of the URL ──────────────────────────────────────────────────────────────────────

test('intParam takes plain positive integers only', () => {
  for (const bad of ['123.png', '12abc', '0', '012', '1e3', '', '-1', ' 1', '12345678901234567']) {
    assert.equal(intParam(bad), null, JSON.stringify(bad));
  }
  assert.equal(intParam('1'), 1);
  assert.equal(intParam('123'), 123);
  assert.equal(intParam(undefined), null);
});

// ── The matcher ─────────────────────────────────────────────────────────────────────────────

test('middleware now runs on the extension-shaped app routes it used to skip', () => {
  const runs = (url: string) => unstable_doesMiddlewareMatch({ config, url });
  for (const url of [
    '/admin/events/5.png',
    '/admin/events/5/teams/7.png',
    '/staff/guides.txt',
    '/team/3.png',
    '/captain/x.xml',
    '/player/dashboard.png',
    '/events/33.png',
    '/c/alpha/events/5.png',
    '/api/plugin/config.txt',
  ]) {
    assert.equal(runs(url), true, url);
  }
  // Still skipped: Next's own assets and the cached game art.
  assert.equal(runs('/_next/static/chunk.js'), false);
  assert.equal(runs('/img/item/4151.png'), false);
  assert.equal(runs('/robots.txt'), false);
});
