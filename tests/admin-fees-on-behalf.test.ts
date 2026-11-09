// The admin fee ledger lists fees on sign-ups that have no login (added on someone's behalf).
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/admin-fees-on-behalf.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('admin-fees-on-behalf');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let listClanFees: typeof import('../src/lib/adminFees.ts')['listClanFees'];

let clanId: number;
let otherClanId: number;

async function signup(clan: number, eventId: number, rsn: string, withLogin: boolean) {
  const [person] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [user] = withLogin ? await db.insert(s.users).values({ displayName: `${rsn} login`, discordId: `d-${rsn}`, playerId: person.id }).returning() : [null];
  const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan, accountId: acct.id, kind: 'member' }).returning();
  const [su] = await db.insert(s.eventSignups).values({ eventId, userId: user?.id ?? null, clanMemberId: seat.id, status: 'approved' }).returning();
  await db.insert(s.signupFees).values({ signupId: su.id, amount: 1_000_000, status: 'pending' });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ listClanFees } = await import('../src/lib/adminFees.ts'));
  const [c] = await db.insert(s.clans).values({ slug: 'fees-a', name: 'A' }).returning();
  const [o] = await db.insert(s.clans).values({ slug: 'fees-b', name: 'B' }).returning();
  clanId = c.id;
  otherClanId = o.id;
  const [ev] = await db.insert(s.events).values({ clanId: c.id, name: 'Bingo', boardSize: 25, signupFee: 1_000_000 }).returning();
  const [ev2] = await db.insert(s.events).values({ clanId: o.id, name: 'Other', boardSize: 25, signupFee: 1_000_000 }).returning();
  await signup(c.id, ev.id, 'Has Login', true);
  await signup(c.id, ev.id, 'On Behalf', false);
  await signup(o.id, ev2.id, 'Foreign Guest', false);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('an on-behalf sign-up fee appears, named by its roster character, and stays clan-scoped', async () => {
  const { fees } = await listClanFees(clanId, null, null);
  const names = fees.map((f) => f.player.displayName).sort();
  assert.deepEqual(names, ['Has Login login', 'On Behalf']);
  const guest = fees.find((f) => f.account.rsn === 'On Behalf')!;
  assert.equal(guest.player.id, null);
  const other = await listClanFees(otherClanId, null, null);
  assert.deepEqual(other.fees.map((f) => f.player.displayName), ['Foreign Guest']);
});
