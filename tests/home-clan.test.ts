// Two in-game rosters listing one character (lib/homeClan): a sync never moves the membership, so
// the player picks — and platform staff withdrawing a disputed clan's badge releases what it synced.
//
// Run: npx tsx --test tests/home-clan.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('homeclan');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/homeClan.ts');

let squat: number;
let real: number;
let person: number;
let squatSeat: number;
let realSeat: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/homeClan.ts');

  squat = (await db.insert(s.clans).values({ slug: 'squat', name: 'Squatter' }).returning())[0].id;
  real = (await db.insert(s.clans).values({ slug: 'real', name: 'Real Clan' }).returning())[0].id;
  person = (await db.insert(s.players).values({ displayName: 'Player' }).returning())[0].id;
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Locked', rsnNormalized: 'locked', claimedAt: new Date().toISOString() })
    .returning();
  // The squatter synced first: member there. The real clan's roster could only seat a guest.
  squatSeat = (await db.insert(s.clanMemberships).values({ clanId: squat, accountId: a.id, kind: 'member', source: 'roster' }).returning())[0].id;
  realSeat = (await db.insert(s.clanMemberships).values({ clanId: real, accountId: a.id, kind: 'guest', source: 'roster' }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the conflict is the player’s to see', async () => {
  const c = await H.membershipConflicts(person);
  assert.equal(c.length, 1);
  assert.equal(c[0].member.clanId, squat);
  assert.equal(c[0].listedBy.seatId, realSeat);
});

test('choosing a home swaps member and guest, and only for their own character', async () => {
  const stranger = (await db.insert(s.players).values({ displayName: 'Stranger' }).returning())[0].id;
  assert.equal(await H.chooseHomeClan(stranger, realSeat, null), false, 'not theirs');
  assert.equal(await H.chooseHomeClan(person, squatSeat, null), false, 'not a conflict seat');

  assert.equal(await H.chooseHomeClan(person, realSeat, null), true);
  const r = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, realSeat) });
  const q = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, squatSeat) });
  assert.equal(r?.kind, 'member');
  assert.equal(q?.kind, 'guest');
  assert.deepEqual(await H.membershipConflicts(person), [], 'the squatter’s roster seat is a guest by the rule, not a conflict');
});

test('withdrawing a clan’s badge releases the memberships its roster made', async () => {
  const V = await import('../src/lib/clanVerification.ts');
  // Put it back the way the squatter left it, then have staff rule against them.
  await db.update(s.clanMemberships).set({ kind: 'guest' }).where(eq(s.clanMemberships.id, realSeat));
  await db.update(s.clanMemberships).set({ kind: 'member' }).where(eq(s.clanMemberships.id, squatSeat));
  await V.unverify(squat, 0 as unknown as number, 'not their clan');
  const q = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, squatSeat) });
  assert.equal(q?.kind, 'guest');
});
