// Ghost clans against a real database (lib/gameClans): recording sightings, the once-a-day write
// throttle, the owner's hide surviving a clan change, and handing over to a verified Anvil clan.
//
// Run: npx tsx --test tests/game-clans-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('game-clans');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let G: typeof import('../src/lib/gameClans.ts');

let alice: number;
let bob: number;
let carol: number;

const T0 = '2026-10-20T12:00:00.000Z';
const T1 = '2026-10-20T18:00:00.000Z'; // same day
const T2 = '2026-10-22T12:00:00.000Z'; // two days on

async function account(rsn: string, shared = true): Promise<number> {
  const [pl] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase(), shared })
    .returning();
  return a.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  G = await import('../src/lib/gameClans.ts');
  alice = await account('Alice');
  bob = await account('Bob');
  carol = await account('Carol', false);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a sighting creates the ghost clan and the character row', async () => {
  const r = await G.recordGameClan(alice, { name: 'Iron Foundry', rank: 100, title: 'Dragonstone', joinedOn: '2025-03-14' }, T0);
  assert.equal(r.stored, true);
  const [gc] = await db.select().from(s.gameClans);
  assert.equal(gc.nameKey, 'iron foundry');
  assert.equal(gc.name, 'Iron Foundry');
});

test('the same sighting the same day writes nothing; a day later re-stamps', async () => {
  const same = { name: 'Iron Foundry', rank: 100, title: 'Dragonstone', joinedOn: '2025-03-14' };
  assert.equal((await G.recordGameClan(alice, same, T1)).stored, false);
  assert.equal((await G.recordGameClan(alice, same, T2)).stored, true);
});

test('another spelling of the same name lands on the same clan', async () => {
  await G.recordGameClan(bob, { name: 'iron_foundry', rank: 10, title: 'Recruit', joinedOn: null }, T2);
  await G.recordGameClan(carol, { name: 'Iron Foundry', rank: 0, title: 'Bronze', joinedOn: null }, T2);
  assert.equal((await db.select().from(s.gameClans)).length, 1);
});

test('the ghost page lists shared, unhidden characters by rank — never an unshared one', async () => {
  const page = await G.ghostClanPage('Iron Foundry');
  assert.equal(page?.kind, 'ghost');
  if (page?.kind !== 'ghost') return;
  assert.deepEqual(page.members.map((m) => m.rsn), ['Alice', 'Bob']);
  assert.equal(page.members[0].title, 'Dragonstone');
});

test('hiding leaves the page, and survives leaving and rejoining a clan', async () => {
  await G.setGameClanHidden(bob, true);
  const page = await G.ghostClanPage('iron foundry');
  assert.deepEqual(page?.kind === 'ghost' && page.members.map((m) => m.rsn), ['Alice']);

  await G.recordGameClan(bob, null, T2);
  await G.recordGameClan(bob, { name: 'Other Clan', rank: 1, title: null, joinedOn: null }, T2);
  const [row] = await db.select().from(s.accountGameClans).where(eq(s.accountGameClans.accountId, bob));
  assert.equal(row.hidden, true);
  assert.equal(await G.ghostClanPage('Other Clan'), null, 'only a hidden member: nothing to show');
});

test('the profile reads the clan, and stops once the sighting goes stale', async () => {
  const mine = await G.gameClanForAccount(alice);
  assert.equal(mine?.name, 'Iron Foundry');
  assert.equal(mine?.anvilClan, null);
  await db.update(s.accountGameClans).set({ observedAt: '2020-01-01T00:00:00.000Z' }).where(eq(s.accountGameClans.accountId, alice));
  assert.equal(await G.gameClanForAccount(alice), null);
  await G.recordGameClan(alice, { name: 'Iron Foundry', rank: 100, title: 'Dragonstone', joinedOn: '2025-03-14' });
});

test('leads count every fresh member, hidden too, and drop clans already on Anvil', async () => {
  const leads = await G.ghostClanLeads();
  assert.deepEqual(leads.map((l) => [l.name, l.members]), [['Iron Foundry', 2], ['Other Clan', 1]]);
});

test('a VERIFIED Anvil clan with that name takes over — listed redirects, private shows nothing', async () => {
  const [typed] = await db.insert(s.clans).values({ slug: 'typed', name: 'Typed', inGameName: 'Iron  Foundry' }).returning();
  assert.equal((await G.ghostClanPage('Iron Foundry'))?.kind, 'ghost', 'a typed, unverified name proves nothing');
  await db.update(s.clans).set({ ingameNameVerifiedAt: T0 }).where(eq(s.clans.id, typed.id));

  assert.deepEqual(await G.ghostClanPage('Iron Foundry'), { kind: 'anvil', slug: 'typed' });
  const mine = await G.gameClanForAccount(alice);
  assert.equal(mine?.anvilClan?.slug, 'typed');
  assert.deepEqual((await G.ghostClanLeads()).map((l) => l.name), ['Other Clan']);

  await db.update(s.clans).set({ visibility: 'private' }).where(eq(s.clans.id, typed.id));
  assert.equal(await G.ghostClanPage('Iron Foundry'), null);
  const priv = await G.gameClanForAccount(alice);
  assert.equal(priv?.anvilClan, null);
  assert.equal(priv?.anvilClanUnlisted, true);
});
