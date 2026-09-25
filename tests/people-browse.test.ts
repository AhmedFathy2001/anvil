// The staff People list and both halves of its merge picker use these queries. Search, filters and
// sort must compose: an operator making an identity decision cannot be shown rows that escaped the
// filter merely because their match came from an RSN instead of a Discord name.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('people-browse');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let V: typeof import('../src/lib/platformView.ts');
let rosterOnlyId: number;
let loginOnlyId: number;
let bannedRosterId: number;
let connectedId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: databasePool, schema: s } = await loadDb();
  pool = databasePool;
  V = await import('../src/lib/platformView.ts');

  const [rosterOnly] = await db.insert(s.players).values({ displayName: 'Alpha Merge' }).returning();
  rosterOnlyId = rosterOnly.id;
  await db.insert(s.accounts).values({
    playerId: rosterOnly.id,
    rsn: 'Merge Needle',
    rsnNormalized: 'merge needle',
  });

  const [loginOnly] = await db.insert(s.players).values({ displayName: 'Zulu Merge' }).returning();
  loginOnlyId = loginOnly.id;
  await db.insert(s.users).values({
    playerId: loginOnly.id,
    displayName: 'Merge Needle Login',
    discordUsername: 'merge.needle',
    discordId: '8810000002',
  });

  const [bannedRoster] = await db
    .insert(s.players)
    .values({ displayName: 'Middle Merge', banned: true })
    .returning();
  bannedRosterId = bannedRoster.id;
  await db.insert(s.accounts).values({
    playerId: bannedRoster.id,
    rsn: 'Merge Needle Alt',
    rsnNormalized: 'merge needle alt',
  });

  const [connected] = await db.insert(s.players).values({ displayName: 'Connected Merge' }).returning();
  connectedId = connected.id;
  await db.insert(s.accounts).values([
    { playerId: connected.id, rsn: 'Connected One', rsnNormalized: 'connected one' },
    { playerId: connected.id, rsn: 'Connected Two', rsnNormalized: 'connected two' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('search predicates cannot escape the active filters', async () => {
  // Before the search ORs were parenthesized, the account-name match on the left skipped every
  // login/character/ban predicate appended to the right.
  const rosterWithoutLogin = await V.browsePeople({
    q: 'merge needle',
    login: 'no',
    accounts: 'yes',
    banned: 'no',
  });
  assert.deepEqual(rosterWithoutLogin.rows.map((row) => row.playerId), [rosterOnlyId]);

  const loginWithoutCharacters = await V.browsePeople({ q: 'merge needle', login: 'yes', accounts: 'no' });
  assert.deepEqual(loginWithoutCharacters.rows.map((row) => row.playerId), [loginOnlyId]);

  const banned = await V.browsePeople({ q: 'merge needle', banned: 'yes' });
  assert.deepEqual(banned.rows.map((row) => row.playerId), [bannedRosterId]);
});

test('both staff searches accept an exact printed person id', async () => {
  const browse = await V.browsePeople({ q: `#${loginOnlyId}` });
  assert.deepEqual(browse.rows.map((row) => row.playerId), [loginOnlyId]);

  const picker = await V.findPeople(`#${rosterOnlyId}`);
  assert.deepEqual(picker.map((row) => row.playerId), [rosterOnlyId]);
});

test('all offered sort orders execute and order the expected edge rows', async () => {
  const ascending = await V.browsePeople({ sort: 'name_asc' });
  const descending = await V.browsePeople({ sort: 'name_desc' });
  assert.equal(ascending.rows[0].playerId, rosterOnlyId, 'A–Z uses the person display name');
  assert.equal(descending.rows[0].playerId, loginOnlyId, 'Z–A reverses it');

  const byCharacters = await V.browsePeople({ sort: 'accounts_desc' });
  assert.equal(byCharacters.rows[0].playerId, connectedId, 'the two-character person sorts first');

  // Exercise the remaining SQL branches; malformed dynamic order expressions only fail at runtime.
  for (const sort of ['connected', 'newest', 'oldest', 'clans_desc'] as const) {
    const page = await V.browsePeople({ sort });
    assert.equal(page.total, 4);
  }
});
