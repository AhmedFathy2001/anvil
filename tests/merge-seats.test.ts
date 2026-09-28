// A renamed player, seen twice.
//
// clan-sync matches by name, so an in-game rename lands as "OldName left, NewName joined": two seats,
// the history on the old one, the rank on the new one. Merging them must leave ONE seat carrying the
// name the roster still lists — whichever way round the admin picked source and target — or the next
// sync re-seats the new name as a stranger and the pair is back.
//
// Run: npx tsx --test tests/merge-seats.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('merge-seats');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let mergeSeats: typeof import('../src/lib/mergeSeats.ts')['mergeSeats'];
let clanId: number;

/** The old name: plugin-linked (so it carries the hash), history, now gone from the roster. */
async function renamePair(oldRsn: string, newRsn: string) {
  const [p1] = await db.insert(s.players).values({ displayName: oldRsn }).returning();
  const [oldAcct] = await db
    .insert(s.accounts)
    .values({ playerId: p1.id, rsn: oldRsn, rsnNormalized: oldRsn.toLowerCase(), accountHash: `hash-${oldRsn}`, claimedAt: '2026-01-01 00:00:00' })
    .returning();
  const [oldSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: oldAcct.id, kind: 'member', source: 'roster', rank: null, leftAt: '2026-09-27 10:00:00' })
    .returning();

  const [p2] = await db.insert(s.players).values({ displayName: newRsn }).returning();
  const [newAcct] = await db
    .insert(s.accounts)
    .values({ playerId: p2.id, rsn: newRsn, rsnNormalized: newRsn.toLowerCase() })
    .returning();
  const [newSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: newAcct.id, kind: 'member', source: 'roster', rank: 'general', lastSeenInClan: '2026-09-27 10:00:00' })
    .returning();
  return { oldSeat: oldSeat.id, newSeat: newSeat.id, oldAcct: oldAcct.id, newAcct: newAcct.id };
}

async function seatsOf(rsnLower: string) {
  return db.select().from(s.clanRoster).where(eq(s.clanRoster.rsnNormalized, rsnLower));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ mergeSeats } = await import('../src/lib/mergeSeats.ts'));
  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('old into new: one ranked seat under the new name, hash carried across', async () => {
  const { oldSeat, newSeat } = await renamePair('Old One', 'New One');
  const r = await mergeSeats({ clanId, sourceId: oldSeat, targetId: newSeat, actorUserId: null });
  assert.ok(r.ok, JSON.stringify(r));

  const [seat] = await seatsOf('new one');
  assert.equal(seat.id, newSeat);
  assert.equal(seat.rank, 'general');
  assert.equal(seat.leftAt, null);
  assert.equal(seat.accountHash, 'hash-Old One', 'the plugin link survives (used to trip the unique index)');
  assert.ok(seat.claimedAt);
  assert.deepEqual(JSON.parse(seat.previousRsns ?? '[]'), ['Old One']);
  assert.equal((await seatsOf('old one')).length, 0);
});

test('new into old (the "wrong" way round): the survivor still takes the new name and rank', async () => {
  const { oldSeat, newSeat } = await renamePair('Old Two', 'New Two');
  const r = await mergeSeats({ clanId, sourceId: newSeat, targetId: oldSeat, actorUserId: null });
  assert.ok(r.ok, JSON.stringify(r));

  const [seat] = await seatsOf('new two');
  assert.equal(seat.id, oldSeat, 'history stays on the chosen target');
  assert.equal(seat.rank, 'general');
  assert.equal(seat.leftAt, null);
  assert.equal(seat.kind, 'member');
  assert.equal(seat.accountHash, 'hash-Old Two');
  assert.deepEqual(JSON.parse(seat.previousRsns ?? '[]'), ['Old Two']);
  assert.equal((await seatsOf('old two')).length, 0);
});
