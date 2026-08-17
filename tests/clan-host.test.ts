// Host -> clan resolution: the closed-set property, and the shapes that must NOT resolve.
//
// This is the security boundary of the whole multi-clan conversion. lib/request-origin deliberately
// refuses to read the Host header, because a header value flowing into a URL or a decision is
// host-header injection. Resolution is safe only while the header is a LOOKUP KEY against the clans
// table and nothing else: match a row and you named a real clan, match nothing and you get null.
//
// So what is pinned here is mostly the negative space — the hosts that must resolve to nothing —
// because a fallback of any kind (first clan, wildcard, apex-as-clan) is what would turn this from a
// lookup into a vulnerability.
//
// Run: npm run test:clan

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

process.env.ANVIL_APEX_DOMAIN = 'anvilosrs.com';

const DB = useTestDatabase('clan-host');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let slugFromHost: typeof import('../src/lib/clanContext.ts')['slugFromHost'];
let resolveClanByHost: typeof import('../src/lib/clanContext.ts')['resolveClanByHost'];

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ slugFromHost, resolveClanByHost } = await import('../src/lib/clanContext.ts'));

  await db.insert(s.clans).values([
    { slug: 'theafkspot', name: 'The AFK Spot', inGameName: 'AFK Spot' },
    { slug: 'secondclan', name: 'Second Clan', customDomain: 'myclan.com' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The label, before any database is involved ────────────────────────────────────────────────
test('a single label under the apex is a clan address', () => {
  assert.equal(slugFromHost('theafkspot.anvilosrs.com'), 'theafkspot');
  assert.equal(slugFromHost('THEAFKSPOT.ANVILOSRS.COM'), 'theafkspot', 'hosts are case-insensitive');
  assert.equal(slugFromHost('theafkspot.anvilosrs.com:3000'), 'theafkspot', 'the port is not part of the host');
});

test('the apex itself is not a clan', () => {
  assert.equal(slugFromHost('anvilosrs.com'), null);
  assert.equal(slugFromHost('www.anvilosrs.com'), null, 'www must not be registrable as a clan');
});

test('nothing but a single label under the apex yields a slug', () => {
  // A nested label is not the clan named by its leftmost part.
  assert.equal(slugFromHost('a.b.anvilosrs.com'), null);
  // A different domain that merely ENDS with our apex text is not under our apex.
  assert.equal(slugFromHost('evil-anvilosrs.com'), null);
  assert.equal(slugFromHost('theafkspot.anvilosrs.com.evil.test'), null);
  // Junk of various shapes.
  assert.equal(slugFromHost(''), null);
  assert.equal(slugFromHost(null), null);
  assert.equal(slugFromHost(undefined), null);
  assert.equal(slugFromHost('   '), null);
});

// ── The lookup ────────────────────────────────────────────────────────────────────────────────
test('a known subdomain resolves to its clan', async () => {
  const clan = await resolveClanByHost('theafkspot.anvilosrs.com');
  assert.equal(clan?.slug, 'theafkspot');
  assert.equal(clan?.name, 'The AFK Spot');
  assert.equal(clan?.inGameName, 'AFK Spot');
  assert.equal(clan?.host, 'theafkspot.anvilosrs.com', 'canonical host comes from the row');
});

test('a custom domain resolves to its clan, and reports itself as the canonical host', async () => {
  const clan = await resolveClanByHost('myclan.com');
  assert.equal(clan?.slug, 'secondclan');
  assert.equal(clan?.host, 'myclan.com', 'a custom domain outranks the subdomain for URL building');
});

// ── The negative space: what must never resolve ───────────────────────────────────────────────
test('an unknown host resolves to nothing, with no fallback', async () => {
  for (const host of [
    'nosuchclan.anvilosrs.com',   // well-formed but not registered
    'anvilosrs.com',              // the apex is clanless
    'www.anvilosrs.com',
    'evil.test',                  // unrelated domain
    'evil-anvilosrs.com',         // suffix lookalike
    'a.b.anvilosrs.com',          // nested label
    'localhost',
    '127.0.0.1',
    '',
  ]) {
    assert.equal(await resolveClanByHost(host), null, `${host || '(empty)'} must not resolve`);
  }
});

test('a spoofed Host cannot reach a clan it did not name', async () => {
  // The attack this guards: pointing Host at something that is not a clan and getting one anyway.
  // There is no "first clan" fallback, so an unregistered host is simply nothing — even though two
  // perfectly good clans exist in the table.
  assert.equal(await resolveClanByHost('attacker.example.com'), null);
  assert.equal(await resolveClanByHost('theafkspot.attacker.example.com'), null);
  // And a clan's own slug on the WRONG apex is not that clan.
  assert.equal(await resolveClanByHost('theafkspot.evil.test'), null);
});
