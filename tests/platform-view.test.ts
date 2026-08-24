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

test('multiClanPeople runs — the query that could never parse', async () => {
  const rows = await V.multiClanPeople();
  assert.equal(rows.length, 1, 'one person holds a live seat in both clans');
  assert.equal(rows[0].playerId, personId);
  assert.equal(rows[0].clans, 2);
});
