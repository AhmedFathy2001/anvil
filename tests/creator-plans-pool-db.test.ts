// The host room lock on a tiny connection pool: no stall, and the cap still holds.
//
// withEventRoom / withLiveEventSlot hold the host's advisory lock inside a transaction. If anything
// they guard ran on the global db instead of that transaction, every lock holder would need a SECOND
// connection while the waiters sit on the rest — on a small pool, nobody finishes. With
// DATABASE_POOL_MAX=2 and many writers at once, this only passes when every guarded write (and every
// count behind the verdict) runs on the locking transaction.
//
// Run: npx tsx --test tests/creator-plans-pool-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

process.env.DATABASE_POOL_MAX = '2';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('creator-plans-pool');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let P: typeof import('../src/lib/creatorPlansDb.ts');
let EN: typeof import('../src/lib/enroll.ts');
let spaceId: number;
let a: number;
let b: number;

const day = (d: number) => new Date(Date.UTC(2027, 0, d)).toISOString();

async function seats(count: number, tag: string): Promise<number[]> {
  const pls = await db.insert(s.players).values(Array.from({ length: count }, (_, i) => ({ displayName: `${tag}${i}` }))).returning();
  const accs = await db
    .insert(s.accounts)
    .values(pls.map((p, i) => ({ playerId: p.id, rsn: `${tag}${i}`, rsnNormalized: `${tag}${i}`.toLowerCase(), verifiedAt: new Date().toISOString() })))
    .returning();
  const rows = await db.insert(s.clanMemberships).values(accs.map((x) => ({ clanId: spaceId, accountId: x.id, kind: 'guest', source: 'web' }))).returning();
  return rows.map((r) => r.id);
}

async function fill(eventId: number, count: number, tag: string): Promise<void> {
  const ids = await seats(count, tag);
  await db.insert(s.eventSignups).values(ids.map((clanMemberId) => ({ eventId, clanMemberId, status: 'pending' })));
}

/** Rejects if `p` hasn't settled in `ms` — a stalled pool fails the test instead of hanging it. */
function within<T>(ms: number, p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`stalled: nothing settled in ${ms} ms`)), ms))]);
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  P = await import('../src/lib/creatorPlansDb.ts');
  EN = await import('../src/lib/enroll.ts');
  assert.equal(pool.options.max, 2, 'the pool really is tiny');
  const [clan] = await db.insert(s.clans).values({ slug: 'pool-space', name: 'Pool Space', kind: 'creator', plan: 'creator_free' }).returning();
  spaceId = clan.id;
  [{ id: a }] = await db.insert(s.events).values({ clanId: spaceId, name: 'Pool A', boardSize: 5, startDate: day(7), endDate: day(10) }).returning();
  [{ id: b }] = await db.insert(s.events).values({ clanId: spaceId, name: 'Pool B', boardSize: 5, startDate: day(8), endDate: day(11) }).returning();
  await fill(a, 30, 'pa');
  await fill(b, 19, 'pb'); // 49 at once: one place left
});

after(async () => {
  delete process.env.FREEMIUM_ENFORCED;
  await pool.end();
  await dropDatabase(DB);
});

test('eight writers at cap−1 across two overlapping events on a 2-connection pool: no stall, exactly one gets in', async () => {
  process.env.FREEMIUM_ENFORCED = 'true';
  const fresh = await seats(8, 'race');
  const join = (eventId: number, seat: number) =>
    P.withEventRoom({ eventId }, (tx) => tx.insert(s.eventSignups).values({ eventId, clanMemberId: seat, status: 'pending' }).returning());
  const writers = [
    join(a, fresh[0]),
    join(b, fresh[1]),
    join(a, fresh[2]),
    join(b, fresh[3]),
    EN.backfillApprovedSignups(a, [fresh[4]]),
    EN.backfillApprovedSignups(b, [fresh[5]]),
    join(a, fresh[6]),
    // A date change on the same host lock, racing them (moves B apart: always allowed).
    P.withLiveEventSlot(
      { clanId: spaceId, clanPlan: null, dates: { eventId: b, roomPlan: 'creator_free', after: { startDate: day(8), endDate: day(11), forceEndedAt: null } } },
      (tx) => tx.update(s.events).set({ name: 'Pool B' }).where(eq(s.events.id, b)),
    ),
  ];
  const results = await within(30_000, Promise.allSettled(writers));
  const joins = results.slice(0, 7);
  assert.equal(joins.filter((r) => r.status === 'fulfilled').length, 1, JSON.stringify(results.map((r) => r.status)));
  for (const r of joins) if (r.status === 'rejected') assert.ok(r.reason instanceof P.PlanLimitError, String(r.reason));
  assert.equal(results[7].status, 'fulfilled', 'the date change went through too');
  assert.equal((await P.eventPlayerCount(a)) + (await P.eventPlayerCount(b)), 50);
});
