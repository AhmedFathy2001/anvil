// Making a clan, now that it is an INSERT rather than a provisioning pipeline.
//
// Two properties carry the weight:
//
//   1. A clan and its owner exist together or not at all. A clan created without an owner grant is
//      the ownerless deadlock — the transfer flow needs a current owner to move ownership, so
//      nobody inside the clan could ever fix it. theafkspot reached that state by another route,
//      which is how we know it is not hypothetical.
//   2. Reserved names stay reserved. Some collide with real infrastructure; the ones that matter
//      more let a clan sit at a host that looks like the platform's, which is a phishing surface
//      rather than a routing clash.
//
// Run: npm run test:clancreate

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
// Pure naming rules — no database import, so this one is safe at the top level. Anything reaching
// lib/clanCreate has to wait for the dynamic import in before(), since @/db reads DATABASE_URL at
// module load.
import { RESERVED_SLUGS, SLUG_RE } from '../src/lib/clanNames.ts';

const DB = useTestDatabase('clan-create');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let createClan: typeof import('../src/lib/clanCreate.ts')['createClan'];
let checkSlug: typeof import('../src/lib/clanCreate.ts')['checkSlug'];
let owner: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ createClan, checkSlug } = await import('../src/lib/clanCreate.ts'));
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Founder', discordId: '970000000000000001' })
    .returning();
  owner = u.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The name ──────────────────────────────────────────────────────────────────────────────────

test('the slug format is enforced', () => {
  assert.ok(SLUG_RE.test('afkspot'));
  assert.ok(SLUG_RE.test('the-afk-spot'));
  assert.ok(SLUG_RE.test('a1'));
  assert.equal(SLUG_RE.test('a'), false, 'too short');
  assert.equal(SLUG_RE.test('A-Clan'), false, 'no uppercase — hosts are case-insensitive');
  assert.equal(SLUG_RE.test('my clan'), false, 'no spaces');
  assert.equal(SLUG_RE.test('clan.sub'), false, 'a dot would be a second label, not a clan');
  assert.equal(SLUG_RE.test('x'.repeat(33)), false, 'too long');
});

test('platform surfaces are reserved, not merely unused', async () => {
  // The important half of the list. A clan at staff.<apex> or api.<apex> reads as ours.
  for (const name of ['staff', 'api', 'admin', 'login', 'www', 'portal', 'pricing']) {
    assert.ok(RESERVED_SLUGS.has(name), `${name} must be reserved`);
    const r = await checkSlug(name);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'reserved');
  }
});

test('infrastructure names are reserved too', async () => {
  for (const name of ['mail', 'ns1', 'mx', 'smtp', 'cdn']) {
    assert.equal((await checkSlug(name)).reason, 'reserved');
  }
});

// ── Creating ──────────────────────────────────────────────────────────────────────────────────

test('a new clan is free, active, and owned by its creator', async () => {
  const { db, schema: s } = await loadDb();
  const r = await createClan({ slug: 'newclan', name: 'New Clan', inGameName: 'New Clan CC', ownerUserId: owner });
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const clan = await db.query.clans.findFirst({ where: eq(s.clans.id, r.clanId) });
  assert.equal(clan?.plan, 'free');
  assert.equal(clan?.status, 'active', 'live immediately — there is nothing to provision');
  assert.equal(clan?.memberCap, 50);

  const grant = await db.query.clanStaff.findFirst({
    where: and(eq(s.clanStaff.clanId, r.clanId), eq(s.clanStaff.userId, owner)),
  });
  assert.equal(grant?.role, 'owner');
});

test('creation is logged in the clan\'s own history', async () => {
  const { db, schema: s } = await loadDb();
  const r = await createClan({ slug: 'loggedclan', name: 'Logged Clan', inGameName: 'Logged CC', ownerUserId: owner });
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const entries = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, r.clanId));
  assert.ok(entries.some((e) => e.eventType === 'clan_created'));
});

test('a taken slug is refused, and refused as "taken"', async () => {
  await createClan({ slug: 'takenclan', name: 'Taken', inGameName: 'Taken CC', ownerUserId: owner });
  const again = await createClan({ slug: 'takenclan', name: 'Taken Again', inGameName: 'Taken CC', ownerUserId: owner });
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.match(again.error, /taken/i);
});

test('a reserved slug is refused even though nothing occupies it', async () => {
  const r = await createClan({ slug: 'admin', name: 'Sneaky', inGameName: 'Sneaky CC', ownerUserId: owner });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /reserved/i);
});

test('a blank IN-GAME name is refused before anything is written', async () => {
  // Which name is the required one flipped when roster sync became the point: the in-game name is
  // what a pushed roster is matched against, so a clan without one can never receive members.
  const { db, schema: s } = await loadDb();
  const before = (await db.select().from(s.clans)).length;
  const r = await createClan({ slug: 'nonameclan', name: 'Has A Display Name', inGameName: '  ', ownerUserId: owner });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /in-game clan name/i);
  assert.equal((await db.select().from(s.clans)).length, before, 'nothing half-created');
});

test('a blank display name falls back to the in-game one rather than being refused', async () => {
  const { db, schema: s } = await loadDb();
  const r = await createClan({ slug: 'fallbackclan', name: '   ', inGameName: 'Fallback CC', ownerUserId: owner });
  assert.equal(r.ok, true, 'the display name is optional now');
  if (!r.ok) return;
  const clan = await db.query.clans.findFirst({ where: eq(s.clans.id, r.clanId) });
  assert.equal(clan?.name, 'Fallback CC');
});

test('no clan is ever created without an owner', async () => {
  // The invariant, checked over everything this suite made rather than over one case: a clan with
  // no owner cannot be repaired from inside, because the transfer flow needs an owner to call it.
  const { db, schema: s } = await loadDb();
  const clans = await db.select().from(s.clans);
  assert.ok(clans.length > 0, 'the check is meaningless with no clans');

  for (const c of clans) {
    const owners = await db
      .select()
      .from(s.clanStaff)
      .where(and(eq(s.clanStaff.clanId, c.id), eq(s.clanStaff.role, 'owner')));
    assert.equal(owners.length, 1, `${c.slug} has exactly one owner`);
  }
});

test('the slug is normalised, so Casing and spaces cannot smuggle a duplicate', async () => {
  const r = await createClan({ slug: '  MixedCase  ', name: 'Mixed', inGameName: 'Mixed CC', ownerUserId: owner });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.slug, 'mixedcase');

  const dupe = await createClan({ slug: 'MIXEDCASE', name: 'Dupe', inGameName: 'Dupe CC', ownerUserId: owner });
  assert.equal(dupe.ok, false, 'the same host, so the same clan');
});
