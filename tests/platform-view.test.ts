// Every read behind /staff, actually executed.
//
// WHY THIS EXISTS. `/staff` threw `missing FROM-clause entry for table "accounts"` the first time
// anybody opened it — a query that selected `from event_participants` and then joined on `accounts`,
// which was never in the FROM. Malformed SQL: it could never have worked, for anyone, once.
//
// It survived because NOTHING IN THE APP LINKED TO /staff. The page existed, the gate was right, and
// no route led there — so it was never rendered, and a broken query sat in a shipped build. Adding
// the link is what found it, about an hour later.
//
// So these assert almost nothing about the answers. They RUN each query, which is the whole point:
// the failure mode for a page nobody opens is not a wrong number, it is SQL that does not parse.
// Type-checking cannot see it — Drizzle builds the statement at runtime — and neither can lint.
//
// Run: npx tsx --test tests/platform-view.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('platform-view');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let V: typeof import('../src/lib/platformView.ts');

let personId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  V = await import('../src/lib/platformView.ts');

  // Two clans and one person seated in BOTH, so multiClanPeople has something to return. Its
  // `having count(distinct clan_id) > 1` means a single-clan fixture would return [] and pass on
  // SQL that never ran a row.
  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'one', name: 'Clan One' },
      { slug: 'two', name: 'Clan Two' },
    ])
    .returning();

  const [person] = await db.insert(s.players).values({ displayName: 'Two Clans' }).returning();
  personId = person.id;

  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Two Clans', discordId: '8810000001', playerId: person.id })
    .returning();
  await db.insert(s.clanStaff).values({ clanId: clans[0].id, userId: u.id, role: 'admin' });

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: person.id, rsn: 'Main Here', rsnNormalized: 'main here' },
      { playerId: person.id, rsn: 'Alt There', rsnNormalized: 'alt there' },
    ])
    .returning();

  await db.insert(s.clanMemberships).values([
    { clanId: clans[0].id, accountId: accts[0].id, kind: 'member', source: 'roster' },
    { clanId: clans[1].id, accountId: accts[1].id, kind: 'guest', source: 'roster' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('platformTotals runs', async () => {
  const t = await V.platformTotals();
  assert.equal(t.clans, 2);
  assert.equal(t.people, 1);
  assert.equal(t.accounts, 2);
});

test('allClans runs', async () => {
  const rows = await V.allClans();
  assert.equal(rows.length, 2);
});

test('findPeople runs', async () => {
  const hits = await V.findPeople('Main');
  assert.ok(hits.length >= 1, 'searching by an RSN they own finds the person');
});

test('personDetail runs', async () => {
  const hit = await V.personDetail(personId);
  assert.ok(hit);
});

test('personDetail on a missing id is null, not a crash', async () => {
  assert.equal(await V.personDetail(999_999), null);
});

test('platformActions runs, and finds the entries no clan page can show', async () => {
  const { db, schema: sc } = await loadDb();

  const [clan] = await db.select({ id: sc.clans.id }).from(sc.clans).limit(1);

  await db.insert(sc.clanAuditLog).values([
    // Belongs to NO clan — invisible on every clan's own history, so this page is its only home.
    {
      clanId: null,
      eventType: 'platform_banned',
      newValue: JSON.stringify({ reason: 'testing' }),
      notes: 'no clan owns this',
    },
    {
      clanId: null,
      eventType: 'platform_role_changed',
      oldValue: JSON.stringify({ platformRole: 'none' }),
      newValue: JSON.stringify({ platformRole: 'staff' }),
    },
    // Taken AGAINST a clan, but with platform authority — belongs here as well as there.
    { clanId: clan.id, eventType: 'platform_clan_updated', newValue: JSON.stringify({ status: 'suspended' }) },
    // An ordinary clan action. Must NOT appear: this is the operator log, not a clan's history.
    { clanId: clan.id, eventType: 'member_renamed', newValue: JSON.stringify({ rsn: 'Whoever' }) },
  ]);

  const rows = await V.platformActions();
  const types = rows.map((r) => r.eventType);

  assert.ok(types.includes('platform_banned'), 'a clanless entry is visible nowhere else');
  assert.ok(types.includes('platform_role_changed'));
  assert.ok(types.includes('platform_clan_updated'), 'and platform actions against a clan');
  assert.ok(!types.includes('member_renamed'), "a clan's own history is not the operator log");

  const withClan = rows.find((r) => r.eventType === 'platform_clan_updated');
  assert.equal(withClan?.clan?.id, clan.id, 'the clan it was done to is resolved for the link');
});

// ── Disputed names ────────────────────────────────────────────────────────────────────────────

test('no collision when every clan claims a different name', async () => {
  const { db, schema: sc } = await loadDb();
  const all = await db.select({ id: sc.clans.id }).from(sc.clans);
  await db.update(sc.clans).set({ inGameName: 'Alone A' }).where(eq(sc.clans.id, all[0].id));
  await db.update(sc.clans).set({ inGameName: 'Alone B' }).where(eq(sc.clans.id, all[1].id));

  assert.deepEqual(await V.nameCollisions(), []);
});

test('two clans on one name is a dispute, matched case-insensitively', async () => {
  const { db, schema: sc } = await loadDb();
  const all = await db.select({ id: sc.clans.id }).from(sc.clans);

  // The holder, and an impersonator differing only in case — which is exactly the case a
  // case-sensitive grouping would show as two tidy unrelated rows.
  await db
    .update(sc.clans)
    .set({ inGameName: 'The AFK Spot', ingameNameVerifiedAt: new Date().toISOString() })
    .where(eq(sc.clans.id, all[0].id));
  await db.update(sc.clans).set({ inGameName: 'the afk spot' }).where(eq(sc.clans.id, all[1].id));

  const collisions = await V.nameCollisions();
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].inGameName, 'The AFK Spot', 'spelled as the holder spells it');
  assert.equal(collisions[0].clans.length, 2);
  assert.equal(collisions[0].clans[0].verified, true, 'the holder is listed first');
  assert.equal(collisions[0].clans[1].verified, false);
});

test('refused claims are counted against the clan that made them', async () => {
  const { db, schema: sc } = await loadDb();
  const all = await db.select({ id: sc.clans.id }).from(sc.clans);

  await db.insert(sc.clanAuditLog).values([
    { clanId: all[1].id, eventType: 'ingame_name_claim_refused', newValue: '{}' },
    { clanId: all[1].id, eventType: 'ingame_name_claim_refused', newValue: '{}' },
  ]);

  const collisions = await V.nameCollisions();
  const impersonator = collisions[0].clans.find((c) => !c.verified);
  assert.equal(
    impersonator?.refusedAttempts,
    2,
    'so an operator can tell a rename from somebody trying repeatedly',
  );

  // Leave the fixture as it was for the queries below.
  await db.update(sc.clans).set({ inGameName: null, ingameNameVerifiedAt: null });
});

test('multiClanPeople runs — the query that could never parse', async () => {
  const rows = await V.multiClanPeople();
  assert.equal(rows.length, 1, 'one person holds a live seat in both clans');
  assert.equal(rows[0].playerId, personId);
  assert.equal(rows[0].clans, 2);
});
