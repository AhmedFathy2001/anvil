// In-game clan join dates from the roster sync, stored on seats (lib/rosterJoinDates).
//
// Run: npx tsx --test tests/roster-join-dates.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('roster-join-dates');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let record: typeof import('../src/lib/rosterJoinDates.ts').recordJoinDates;
let clanId: number;
let aliceSeat: number;
let bobSeat: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ recordJoinDates: record } = await import('../src/lib/rosterJoinDates.ts'));
  [{ id: clanId }] = await db.insert(s.clans).values({ slug: 'jd', name: 'JD' }).returning();
  const seat = async (rsn: string) => {
    const [pl] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
    return m.id;
  };
  aliceSeat = await seat('Alice');
  bobSeat = await seat('Bob');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const joinedOf = async (id: number) =>
  (await db.select({ d: s.clanMemberships.ingameJoinedOn }).from(s.clanMemberships).where(eq(s.clanMemberships.id, id)))[0].d;

test('a sync stores each member’s join date; a one-day wobble writes nothing; a real move does', async () => {
  assert.equal(await record(clanId, [{ rsn: 'Alice', joinedDays: 400 }, { rsn: 'Bob' }], '2026-10-29T10:00:00Z'), 1);
  assert.equal(await joinedOf(aliceSeat), '2025-09-24');
  assert.equal(await joinedOf(bobSeat), null);

  assert.equal(await record(clanId, [{ rsn: 'Alice', joinedDays: 401 }], '2026-10-29T10:00:00Z'), 0);
  assert.equal(await record(clanId, [{ rsn: 'Alice', joinedDays: 3 }, { rsn: 'bob', joinedDays: 10 }], '2026-10-29T10:00:00Z'), 2);
  assert.equal(await joinedOf(aliceSeat), '2026-10-26');
  assert.equal(await joinedOf(bobSeat), '2026-10-19');
});

test('without a synced date, the character’s own report stands in — only for the clan’s verified in-game name', async () => {
  const { ingameJoinDates } = await import('../src/lib/memberProfile.ts');
  const now = '2026-10-29T10:00:00Z';
  const [{ id: verified }] = await db
    .insert(s.clans)
    .values({ slug: 'fe', name: 'Iron Foundry site', inGameName: 'Iron  Foundry', ingameNameVerifiedAt: now })
    .returning();
  const [{ id: unverified }] = await db.insert(s.clans).values({ slug: 'uv', name: 'UV', inGameName: 'Other Clan' }).returning();
  const [{ id: foundry }] = await db.insert(s.gameClans).values({ nameKey: 'iron foundry', name: 'Iron Foundry', firstSeenAt: now, lastSeenAt: now }).returning();
  const [{ id: other }] = await db.insert(s.gameClans).values({ nameKey: 'other clan', name: 'Other Clan', firstSeenAt: now, lastSeenAt: now }).returning();

  const seat = async (clan: number, rsn: string, game: number, joinedOn: string, hidden = false) => {
    const [pl] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    await db.insert(s.accountGameClans).values({ accountId: a.id, gameClanId: game, joinedOn, observedAt: now, hidden });
    const [m] = await db.insert(s.clanMemberships).values({ clanId: clan, accountId: a.id, kind: 'member' }).returning();
    return m.id;
  };
  const reported = await seat(verified, 'Carol', foundry, '2023-05-01');
  const elsewhere = await seat(verified, 'Dave', other, '2022-01-01');
  const hidden = await seat(verified, 'Erin', foundry, '2021-01-01', true);
  const unchecked = await seat(unverified, 'Finn', other, '2020-01-01');
  const synced = await seat(verified, 'Gail', foundry, '2019-01-01');
  await db.update(s.clanMemberships).set({ ingameJoinedOn: '2024-02-02' }).where(eq(s.clanMemberships.id, synced));

  const dates = await ingameJoinDates([reported, elsewhere, hidden, unchecked, synced]);
  assert.equal(dates.get(reported), '2023-05-01');
  assert.equal(dates.has(elsewhere), false, 'reported a different clan');
  assert.equal(dates.has(hidden), false, 'hid their in-game clan');
  assert.equal(dates.has(unchecked), false, 'clan never verified its in-game name');
  assert.equal(dates.get(synced), '2024-02-02', 'the roster sync wins');
});
