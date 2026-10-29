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
