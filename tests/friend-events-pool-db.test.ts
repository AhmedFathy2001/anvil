// Friends events' locked gate on a TINY pool (lib/friendEvents guardFriendsSeats): every guarded write
// runs on the transaction holding the host's lock, never on a second pooled connection. With two
// connections and many guarded writes at once, a gate that held a lock and waited for another
// connection would stall until the pool's 10s connection timeout; this one finishes promptly, and the
// cap still holds exactly.
//
// Run: TEST_DATABASE_URL=postgres://… npx tsx --test tests/friend-events-pool-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('friend-events-pool');
// Set before src/db is imported: the app's pool reads it once.
process.env.DATABASE_POOL_MAX = '2';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let F: typeof import('../src/lib/friendEvents.ts');
let P: typeof import('../src/lib/creatorPlansDb.ts');

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  F = await import('../src/lib/friendEvents.ts');
  P = await import('../src/lib/creatorPlansDb.ts');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a pool of 2, twelve guarded sign-ups at once: no stall, and exactly the cap gets in', async () => {
  assert.equal(pool.options.max, 2);
  const [pl] = await db.insert(s.players).values({ displayName: 'Pool Owner' }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: 'Pool Owner', discordId: '99600000000000001' }).returning();
  await db.insert(s.supporterSubscriptions).values({ userId: u.id, tier: 'supporter', status: 'active', startedAt: '2026-01-01 00:00:00' });
  const r = await F.ensureFriendsHost(u.id);
  assert.ok(r.ok);
  if (!r.ok) return;
  const host = (await db.query.clans.findFirst({ where: eq(s.clans.id, r.host.id) }))!;
  const ev = await F.withHostEventSlot(host, { clanId: host.id, clanPlan: null }, async (tx) => {
    const [row] = await tx
      .insert(s.events)
      .values({ clanId: host.id, name: 'Pool Bingo', boardSize: 5, visibility: 'invited', startDate: new Date(Date.now() - 3600_000).toISOString(), endDate: new Date(Date.now() + 86_400_000).toISOString() })
      .returning();
    return row;
  });

  // Twelve friends with event seats; all sign up at once through the gate. Supporter cap: 10.
  const seats: number[] = [];
  for (let i = 0; i < 12; i++) {
    const [p] = await db.insert(s.players).values({ displayName: `Pooler${i}` }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: `Pooler${i}`, rsnNormalized: `pooler${i}`, verifiedAt: new Date().toISOString() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId: host.id, accountId: a.id, kind: 'event', eventId: ev.id, source: 'web' }).returning();
    seats.push(m.id);
  }
  const started = Date.now();
  const results = await Promise.allSettled(
    seats.map((seat) =>
      F.guardFriendsSeats(ev.id, (tx) => tx.insert(s.eventSignups).values({ eventId: ev.id, clanMemberId: seat, status: 'pending' }).returning()),
    ),
  );
  const took = Date.now() - started;
  const won = results.filter((x) => x.status === 'fulfilled').length;
  const full = results.filter((x) => x.status === 'rejected' && x.reason instanceof P.PlanLimitError).length;
  const other = results.filter((x) => x.status === 'rejected' && !(x.reason instanceof P.PlanLimitError));
  assert.deepEqual(other.map((x) => String((x as PromiseRejectedResult).reason)), [], 'no timeouts or other errors');
  assert.equal(won, 10);
  assert.equal(full, 2);
  assert.equal(await P.eventPlayerCount(ev.id), 10);
  assert.ok(took < 8000, `finished in ${took}ms — well under the pool's 10s connection timeout`);
});
