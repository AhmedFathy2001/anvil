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

// ── Settings are per clan, and the accessor must actually say so ──────────────────────────────
// This is a regression test for a bug that shipped past typecheck, lint and 25 green suites:
// getSetting/getSettingText took a clanId and then filtered on `key` alone, so every clan read the
// first clan's configuration — names, invite links, webhook URLs. Nothing errored. Two clans simply
// had the same settings, and only a live two-host request showed it.
//
// The lesson these assertions encode: a scoped accessor is not scoped because it ACCEPTS a clanId.
test('settings are isolated per clan', async () => {
  const { getSetting, getSettingText, getSettingMap, setSetting, deleteSetting } =
    await import('../src/lib/settings.ts');
  const { db, schema } = await loadDb();

  const [a] = await db.insert(schema.clans).values({ slug: 'settings-a', name: 'A' })
    .returning({ id: schema.clans.id });
  const [b] = await db.insert(schema.clans).values({ slug: 'settings-b', name: 'B' })
    .returning({ id: schema.clans.id });

  // The SAME key, different values. This is the shape the bug made impossible to tell apart.
  await setSetting(a!.id, 'clan_name', 'Clan A');
  await setSetting(b!.id, 'clan_name', 'Clan B');

  assert.equal(await getSetting(a!.id, 'clan_name'), 'Clan A');
  assert.equal(await getSetting(b!.id, 'clan_name'), 'Clan B', 'B must not read A\'s value');
  assert.equal(await getSettingText(a!.id, 'clan_name'), 'Clan A');
  assert.equal(await getSettingText(b!.id, 'clan_name'), 'Clan B', 'the trimmed reader needs scoping too');

  const mapB = await getSettingMap(b!.id, ['clan_name']);
  assert.equal(mapB.get('clan_name'), 'Clan B');

  // A key only one clan has must not leak to the other.
  await setSetting(a!.id, 'discord_invite_url', 'https://discord.gg/a');
  assert.equal(await getSetting(b!.id, 'discord_invite_url'), null, 'absent for B, set for A');

  // Deleting is scoped as well — one clan clearing a key must not clear anyone else's.
  await deleteSetting(b!.id, 'clan_name');
  assert.equal(await getSetting(b!.id, 'clan_name'), null);
  assert.equal(await getSetting(a!.id, 'clan_name'), 'Clan A', "A's value survives B's delete");
});

// ── One RSN, two rosters ──────────────────────────────────────────────────────────────────────
// The property the clan-sync bug violated. That handler pre-fetched EVERY clan's members to diff
// against one clan's reported roster, and its soft-delete was unscoped too — so a single clan
// syncing would have marked every other clan's members as having left. Data loss across tenants,
// from a missing WHERE.
//
// The same person legitimately plays in several clans, so "this RSN is already a member" is only
// ever a question about ONE clan.
test('the same RSN is a separate member row in each clan', async () => {
  const { findOrCreateClanMember } = await import('../src/lib/clan.ts');
  const { db, schema } = await loadDb();
  const { eq, and } = await import('drizzle-orm');

  const [a] = await db.insert(schema.clans).values({ slug: 'roster-a', name: 'Roster A' })
    .returning({ id: schema.clans.id });
  const [b] = await db.insert(schema.clans).values({ slug: 'roster-b', name: 'Roster B' })
    .returning({ id: schema.clans.id });

  const inA = await findOrCreateClanMember(a!.id, 'Zezima');
  const inB = await findOrCreateClanMember(b!.id, 'Zezima');
  assert.notEqual(inA, inB, "one clan must not adopt another clan's member row");

  // Asking again returns each clan's OWN row, rather than whichever existed first.
  assert.equal(await findOrCreateClanMember(a!.id, 'Zezima'), inA);
  assert.equal(await findOrCreateClanMember(b!.id, 'Zezima'), inB);

  // And each clan sees exactly one Zezima — one ACCOUNT, seated once in each clan.
  for (const [clanId, expected] of [[a!.id, inA], [b!.id, inB]] as const) {
    const rows = await db.select().from(schema.clanRoster)
      .where(and(eq(schema.clanRoster.clanId, clanId), eq(schema.clanRoster.rsnNormalized, 'zezima')));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, expected);
  }

  // The same person, not two coincidentally-named strangers. Before the identity split this was
  // unrepresentable: two clans holding one RSN meant two unrelated rows.
  const zezimaAccounts = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.rsnNormalized, 'zezima'));
  assert.equal(zezimaAccounts.length, 1, 'one RSN is one account, however many clans list it');

  // A soft-delete sweep scoped to A must leave B's roster untouched — the clan-sync failure mode.
  await db.update(schema.clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(schema.clanMemberships.clanId, a!.id));
  const [bRow] = await db.select().from(schema.clanRoster).where(eq(schema.clanRoster.id, inB));
  assert.equal(bRow?.leftAt, null, "B's members must survive A's roster sync");

  // And leaving one clan is not leaving the game: the account, and everything hanging off it, is
  // untouched by a roster sweep in a clan it also happens to play in.
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, zezimaAccounts[0]!.id));
  assert.equal(account.status, 'active');
});

// ── Apex-hosted login ─────────────────────────────────────────────────────────────────────────
// One deployment means one Discord app with one registered redirect URI, so the OAuth round trip has
// to run on the apex and hand back to the clan. Two things make that safe, and both are pinned here
// because getting either wrong is a security bug rather than a broken feature.
test('the session cookie is scoped to the apex, so clans beneath it share a login', async () => {
  const { sessionCookieDomain } = await import('../src/lib/clanContext.ts');
  // A leading dot: readable by every clan under the apex, and by nothing outside it. Sibling hosts
  // would have forced a cookie on the whole registrable domain, which other deployments could read.
  assert.equal(sessionCookieDomain(), '.anvilosrs.com');
});

test('the post-login redirect can only name a real clan', async () => {
  const { resolveReturnHost } = await import('../src/lib/clanContext.ts');

  // A known clan comes back as its CANONICAL host — from the row, not from the input.
  assert.equal(await resolveReturnHost('theafkspot.anvilosrs.com'), 'theafkspot.anvilosrs.com');
  // A clan reachable by custom domain returns that, because it is what its row says.
  assert.equal(await resolveReturnHost('myclan.com'), 'myclan.com');

  // Everything else is null and the caller falls back to the apex. Without this the login flow is an
  // open redirect: the host arrives as a query parameter, so an attacker could hand a half-finished
  // login to any origin they liked.
  for (const hostile of [
    'attacker.example.com',
    'theafkspot.attacker.example.com',
    'evil-anvilosrs.com',
    'nosuchclan.anvilosrs.com',
    '//attacker.example.com',
    'anvilosrs.com.attacker.test',
    '',
    null,
  ]) {
    assert.equal(
      await resolveReturnHost(hostile),
      null,
      `${hostile || '(empty)'} must not be a redirect target`,
    );
  }
});


// ── One account, one history, however many clans it plays in ──────────────────────────────────
// What Jagex tracks belongs to the account, so what we record about it does too. Keyed to the roster
// SEAT — which is what these tables used before the conversion — a person in two clans would
// accumulate two daily series, two sets of personal bests and two collection logs from the same
// account, none of them agreeing.
//
// The unique index is the thing being pinned: it is the reason a second clan's sweep updates the
// existing row rather than starting a rival one.
test('a second clan does not start a second history for the same account', async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');

  const [person] = await db.insert(s.players).values({ displayName: 'Nomad' }).returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Nomad', rsnNormalized: 'nomad' })
    .returning();

  const clans = await db.select().from(s.clans);
  const [a, b] = clans;
  assert.ok(a && b, 'two clans are already seeded above');

  // The same account, seated on both rosters — which is the whole point of accounts being global.
  await db.insert(s.clanMemberships).values([
    { clanId: a.id, accountId: account.id, kind: 'member', source: 'roster' },
    { clanId: b.id, accountId: account.id, kind: 'guest', source: 'application' },
  ]);

  // Two clans, two sweeps, one day.
  await db.insert(s.memberDailyStats).values({ accountId: account.id, day: '2026-08-19', overallXp: 1000 });
  await db
    .insert(s.memberDailyStats)
    .values({ accountId: account.id, day: '2026-08-19', overallXp: 1200 })
    .onConflictDoUpdate({
      target: [s.memberDailyStats.accountId, s.memberDailyStats.day],
      set: { overallXp: 1200 },
    });

  const days = await db.select().from(s.memberDailyStats).where(eq(s.memberDailyStats.accountId, account.id));
  assert.equal(days.length, 1, 'one row for the day, not one per clan that watched it');
  assert.equal(days[0]!.overallXp, 1200, 'and it carries the later reading');

  // Two seats, one account: the seats are what differ, and they are the only thing that should.
  const seats = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, account.id));
  assert.equal(seats.length, 2);
  assert.equal(new Set(seats.map((x) => x.clanId)).size, 2);
});
