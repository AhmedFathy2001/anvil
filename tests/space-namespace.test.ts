// Creator spaces at /s/<slug>, clans at /c/<slug>: one slug, two possible tenants.
//
// A slug is unique per namespace (drizzle/0260), so `/c/drenvox` and `/s/drenvox` can be different
// tenants. Everything that reads or writes an address has to keep the kind, or a link quietly lands
// on the other one. These pin the pure halves: building, parsing, and the beacon/typed-input shapes.
//
// Run: npx tsx --test tests/space-namespace.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clanBasePath,
  clanHrefFor,
  clanPathOf,
  isPlatformPath,
  parseClanPrefix,
  stripClanPrefix,
  withClanPrefix,
} from '../src/lib/clanScopedPaths.ts';
import { clanSlugOf, routePattern, tenantOfBeacon } from '../src/lib/analyticsPattern.ts';
import { normalizePath } from '../src/lib/errorFingerprint.ts';
import { spaceSlugOf } from '../src/lib/firstLogin.ts';
import { parseTypedSlug } from '../src/lib/clanSlugLookup.ts';

test('a space is addressed at /s/, everything else at /c/', () => {
  assert.equal(clanBasePath({ slug: 'drenvox', kind: 'creator' }), '/s/drenvox');
  assert.equal(clanBasePath({ slug: 'drenvox', kind: 'clan' }), '/c/drenvox');
  // Friends hosts share the clan namespace; a row without a kind is a clan.
  assert.equal(clanBasePath({ slug: 'pals', kind: 'friends' }), '/c/pals');
  assert.equal(clanBasePath({ slug: 'afk' }), '/c/afk');
  assert.equal(clanPathOf({ slug: 'drenvox', kind: 'creator' }, '/events/5'), '/s/drenvox/events/5');
  assert.equal(clanPathOf({ slug: 'drenvox', kind: 'creator' }, '/'), '/s/drenvox');
  assert.equal(clanHrefFor({ slug: 'drenvox', kind: 'creator' }, '/events/5'), '/s/drenvox/events/5');
  assert.equal(clanHrefFor('afk', '/events/5'), '/c/afk/events/5');
});

test('both prefixes parse, and keep which one they were', () => {
  assert.deepEqual(parseClanPrefix('/s/drenvox/events/5'), { kind: 'creator', slug: 'drenvox', prefix: '/s/drenvox' });
  assert.deepEqual(parseClanPrefix('/c/drenvox'), { kind: 'clan', slug: 'drenvox', prefix: '/c/drenvox' });
  assert.equal(parseClanPrefix('/staff'), null);
  // `/s` alone or a slug that breaks the rules is not an address.
  assert.equal(parseClanPrefix('/s/'), null);
  assert.equal(parseClanPrefix('/settings'), null);
  assert.equal(stripClanPrefix('/s/drenvox/admin/dashboard'), '/admin/dashboard');
  assert.equal(stripClanPrefix('/s/drenvox'), '/');
});

test('a space prefix prefixes clan paths, and /s/ is never itself prefixed', () => {
  assert.equal(withClanPrefix('/s/drenvox', '/events/5'), '/s/drenvox/events/5');
  assert.equal(withClanPrefix('/s/drenvox', '/admin/dashboard'), '/s/drenvox/admin/dashboard');
  assert.equal(isPlatformPath('/s/other'), true);
  assert.equal(withClanPrefix('/c/afk', '/s/drenvox/events'), '/s/drenvox/events');
  // `/s/` must not swallow `/staff` or `/settings`: neither is an address.
  assert.equal(parseClanPrefix('/staff/clans'), null);
  assert.equal(parseClanPrefix('/settings/boosts'), null);
});

test('the analytics beacon names the namespace, and a bare slug (older pages) is a clan', () => {
  assert.equal(clanSlugOf('/s/drenvox/events'), 's/drenvox');
  assert.equal(clanSlugOf('/c/afk/events'), 'afk');
  assert.deepEqual(tenantOfBeacon('s/drenvox'), { slug: 'drenvox', kind: 'creator' });
  assert.deepEqual(tenantOfBeacon('afk'), { slug: 'afk', kind: 'clan' });
  assert.equal(tenantOfBeacon('x/afk'), null);
  assert.equal(routePattern('/s/drenvox/events/5', { eventId: '5' }), '/s/[clan]/events/[eventId]');
});

test('error fingerprints fold either prefix', () => {
  assert.equal(normalizePath('/s/drenvox/events/12'), '/s/<clan>/events/<n>');
  assert.equal(normalizePath('/c/afk/events/12'), '/c/<clan>/events/<n>');
});

test('a login return path keeps its namespace', () => {
  assert.deepEqual(spaceSlugOf('/s/Cool-Streamer/events/5'), { slug: 'cool-streamer', kind: 'creator' });
  assert.deepEqual(spaceSlugOf('/c/afk/events/5'), { slug: 'afk', kind: 'clan' });
  assert.equal(spaceSlugOf('/events/5'), null);
});

test('a typed slug accepts every shape people paste, and says when it named no kind', () => {
  assert.deepEqual(parseTypedSlug('Drenvox'), { slug: 'drenvox', kind: null });
  assert.deepEqual(parseTypedSlug('/s/drenvox'), { slug: 'drenvox', kind: 'creator' });
  assert.deepEqual(parseTypedSlug('c/afk'), { slug: 'afk', kind: 'clan' });
  assert.deepEqual(parseTypedSlug('https://anvilosrs.com/s/drenvox/events/4'), { slug: 'drenvox', kind: 'creator' });
  assert.equal(parseTypedSlug('two words'), null);
  assert.equal(parseTypedSlug(''), null);
});

test('the header proof covers the kind, and a clan proof keeps its pre-/s/ format', async () => {
  // A proof over the slug alone would let a caller keep a valid /c/x proof and add a kind header to
  // reach /s/x. A creator proof signs a different message; a clan's is byte-for-byte the old one, so
  // a blue/green swap between versions keeps every /c/ request's clan.
  process.env.ADMIN_SESSION_SECRET = 'test-secret';
  const P = await import('../src/lib/requestHeaderProof.ts');
  const h = new Headers();
  await P.setProvenClan(h, 'drenvox', 'creator');
  assert.equal(h.get('x-anvil-clan-prefix'), '/s/drenvox');
  assert.deepEqual(await P.provenClan(h), { slug: 'drenvox', kind: 'creator' });

  // Drop the kind header and the same proof no longer checks out.
  h.delete('x-anvil-clan-kind');
  assert.equal(await P.provenClan(h), null);

  const c = new Headers();
  await P.setProvenClan(c, 'drenvox');
  assert.equal(c.get('x-anvil-clan-prefix'), '/c/drenvox');
  assert.equal(c.get('x-anvil-clan-proof'), await P.clanHeaderProof('drenvox'));
  c.set('x-anvil-clan-kind', 'creator');
  assert.equal(await P.provenClan(c), null, 'a kind header added beside a clan proof is refused');

  const src = readFileSync(join(import.meta.dirname, '../src/middleware.ts'), 'utf8');
  assert.match(src, /downstream\.delete\(CLAN_KIND_HEADER\)/);
  assert.match(src, /\/\^\\\/\(\[cs\]\)\\\//);
});
