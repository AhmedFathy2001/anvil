// Supporter and streak news in the clan feed (lib/supporterMoments): gifts, tenure steps reached this
// week (never a backlog), deduped, public characters on member seats only.
//
// Run: npx tsx --test tests/supporter-moments-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-moments');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

let n = 0;
async function member(clanId: number, name: string, opts: { announce?: boolean } = {}) {
  const { db, schema: s } = await loadDb();
  n++;
  const [player] = await db.insert(s.players).values({}).returning();
  const [u] = await db.insert(s.users).values({ displayName: `M ${n}`, discordId: `mom-${n}`, playerId: player.id, announceSupporter: opts.announce ?? true }).returning();
  const [acc] = await db.insert(s.accounts).values({ playerId: player.id, rsn: name, rsnNormalized: name.toLowerCase(), shared: true, verifiedAt: new Date().toISOString() }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: acc.id, kind: 'member' }).returning();
  return { user: u, seat };
}

test('a gift posts once in the clan both share, under the buyer, naming the recipient', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'moments-clan', name: 'Moments Clan' }).returning();
  const buyer = await member(clan.id, 'Gift Buyer');
  const friend = await member(clan.id, 'Gift Friend');
  const { announceGift } = await import('../src/lib/supporterMoments.ts');
  await announceGift('sale-m1', buyer.user.id, friend.user.id, 3, 'Champion');
  await announceGift('sale-m1', buyer.user.id, friend.user.id, 3, 'Champion');
  const rows = await db.select().from(s.moments).where(eq(s.moments.clanMemberId, buyer.seat.id));
  assert.equal(rows.length, 1, 'deduped by sale');
  assert.equal(rows[0].kind, 'milestone');
  assert.equal(rows[0].sourceKind, 'gift');
  assert.equal(rows[0].itemName, 'gifted Gift Friend 3 months of Anvil Champion');
  const { milestoneSentence } = await import('../src/lib/milestoneMoments.ts');
  assert.equal(milestoneSentence(rows[0] as Parameters<typeof milestoneSentence>[0]), 'gifted Gift Friend 3 months of Anvil Champion');
});

test('tenure steps post when fresh, never as a backlog, and respect "announce me"', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'tenure-clan', name: 'Tenure Clan' }).returning();
  const fresh = await member(clan.id, 'Fresh Master');
  const old = await member(clan.id, 'Old Master');
  const quiet = await member(clan.id, 'Quiet Master', { announce: false });
  const ago = (months: number, days = 0) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - months);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString();
  };
  for (const [u, start] of [[fresh.user, ago(12, 2)], [old.user, ago(12, 60)], [quiet.user, ago(12, 2)]] as const) {
    await db.insert(s.supporterSubscriptions).values({ userId: u.id, tier: 'supporter', status: 'active', startedAt: start, tenureStartedAt: start });
  }
  const { sweepSupporterMoments } = await import('../src/lib/supporterMoments.ts');
  await sweepSupporterMoments();
  await sweepSupporterMoments();
  const of = async (seatId: number) => db.select().from(s.moments).where(eq(s.moments.clanMemberId, seatId));
  const f = await of(fresh.seat.id);
  assert.equal(f.length, 1, 'posted once');
  assert.equal(f[0].sourceKind, 'tenure');
  assert.match(f[0].itemName ?? '', /^reached Master: 1 year supporting Anvil$/);
  assert.equal((await of(old.seat.id)).length, 0, 'reached two months ago: not news');
  assert.equal((await of(quiet.seat.id)).length, 0, 'opted out of announcements');
});
