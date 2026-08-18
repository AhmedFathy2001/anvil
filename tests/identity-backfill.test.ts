// The identity backfill: what migration 0006 makes of the rosters that came before it.
//
// This is the migration the whole remodel turns on, and it runs exactly once per database, at
// migration time — so the only way to test it is to stop the chain at 0005, seed rows in the old
// single-clan shape, and then let 0006 transform them.
//
// The case it exists for is the one the old schema could not express at all: the SAME person, on
// TWO clans' rosters, playing a main and an alt. Before this migration that was four unrelated
// clan_members rows with no way to know they were one human. Every assertion below is a fact that
// was previously unrepresentable.
//
// Run: npm run test:identity

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, migrateRest, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('identity-backfill');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

/** Everything about one person, read back the way the app will read it. */
async function person(displayName: string) {
  const [p] = await db.select().from(s.players).where(eq(s.players.displayName, displayName));
  if (!p) return null;
  const accounts = await db.select().from(s.accounts).where(eq(s.accounts.playerId, p.id));
  const memberships = [];
  for (const a of accounts) {
    const rows = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, a.id));
    memberships.push(...rows.map((m) => ({ ...m, rsn: a.rsn })));
  }
  return { player: p, accounts, memberships };
}

before(async () => {
  // Stop before the identity migration, so the database is in the shape 0006 has to transform.
  await resetDatabase(DB, '0005_clan_staff');
  ({ db, pool, schema: s } = await loadDb());

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha Clan' },
      { slug: 'bravo', name: 'Bravo Clan' },
    ])
    .returning();
  const alpha = clans.find((c) => c.slug === 'alpha')!.id;
  const bravo = clans.find((c) => c.slug === 'bravo')!.id;

  const users = await db
    .insert(s.users)
    .values([
      { displayName: 'Ahmed', discordId: '111' },
      { displayName: 'Woox', discordId: '222' },
    ])
    .returning();
  const ahmed = users.find((u) => u.discordId === '111')!.id;
  const woox = users.find((u) => u.discordId === '222')!.id;

  await db.insert(s.clanMembers).values([
    // One person, a main and an alt, on BOTH rosters. Four rows that must become one human.
    { clanId: alpha, rsn: 'AhmedMain', rsnNormalized: 'ahmedmain', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: alpha, rsn: 'AhmedAlt', rsnNormalized: 'ahmedalt', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: bravo, rsn: 'AhmedMain', rsnNormalized: 'ahmedmain', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: bravo, rsn: 'AhmedAlt', rsnNormalized: 'ahmedalt', userId: ahmed, isGuest: 1, source: 'manual' },
    // Never logged in: a roster entry that is still a person.
    { clanId: alpha, rsn: 'Zezima', rsnNormalized: 'zezima', userId: null, isGuest: 0, source: 'plugin-roster' },
    // Unclaimed on one roster, claimed on the other — ownership must find the real person.
    { clanId: alpha, rsn: 'Woox', rsnNormalized: 'woox', userId: null, isGuest: 1, source: 'plugin-self' },
    { clanId: bravo, rsn: 'Woox', rsnNormalized: 'woox', userId: woox, isGuest: 0, source: 'plugin-roster' },
  ]);

  migrateRest(DB); // 0006 runs here
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a main and an alt across two clans collapse to one person', async () => {
  const ahmed = await person('Ahmed');
  assert.ok(ahmed);
  assert.equal(ahmed.accounts.length, 2, 'two OSRS accounts');
  assert.deepEqual(ahmed.accounts.map((a) => a.rsn).sort(), ['AhmedAlt', 'AhmedMain']);
  assert.equal(ahmed.memberships.length, 4, 'four roster rows');
  assert.equal(new Set(ahmed.memberships.map((m) => m.clanId)).size, 2, 'across two clans');
});

test('the same RSN on two rosters is ONE account, not two', async () => {
  const rows = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));
  assert.equal(rows.length, 1);
  const memberships = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, rows[0].id));
  assert.equal(memberships.length, 2, 'one account, two clan rosters');
});

test('ownership prefers the claimed roster row over the unclaimed one', async () => {
  // Woox is unclaimed on alpha and claimed on bravo. The account must land on the real person, and
  // must not mint a second, ownerless "Woox" alongside them.
  const people = await db.select().from(s.players).where(eq(s.players.displayName, 'Woox'));
  assert.equal(people.length, 1, 'exactly one Woox');
  const [account] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));
  assert.equal(account.playerId, people[0].id);
});

test('a roster entry that never logged in still becomes a person', async () => {
  const zezima = await person('Zezima');
  assert.ok(zezima, 'unclaimed accounts have an owner from the moment they are seen');
  assert.equal(zezima.accounts.length, 1);
  assert.equal(zezima.memberships.length, 1);
});

test('membership kind carries the granted/guest distinction', async () => {
  const ahmed = await person('Ahmed');
  const byKind = ahmed!.memberships.map((m) => `${m.rsn}:${m.kind}:${m.source}`).sort();
  assert.deepEqual(byKind, [
    'AhmedAlt:guest:admin', // added by hand on bravo — a guest, not a member
    'AhmedAlt:member:roster',
    'AhmedMain:member:roster',
    'AhmedMain:member:roster',
  ]);
});

test('every account has an owner, and no person is left owning nothing', async () => {
  const accounts = await db.select().from(s.accounts);
  assert.ok(accounts.length > 0);
  assert.equal(accounts.filter((a) => a.playerId == null).length, 0, 'no ownerless accounts');

  // A person with no accounts is a ghost in the directory — the shape produced by minting a person
  // per unclaimed ROSTER ROW instead of per unclaimed ACCOUNT.
  const people = await db.select().from(s.players);
  const owned = new Set(accounts.map((a) => a.playerId));
  assert.deepEqual(
    people.filter((p) => !owned.has(p.id)).map((p) => p.displayName),
    [],
    'no people without accounts',
  );
});

test('no roster row is lost in translation', async () => {
  const before = await db.select().from(s.clanMembers);
  const after = await db.select().from(s.clanMemberships);
  assert.equal(after.length, before.length);
});
