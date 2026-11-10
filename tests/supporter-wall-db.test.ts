// The public supporters wall (lib/supporterWall): on by default, off by choice, one public character
// per person, never a hidden one.
//
// Run: npx tsx --test tests/supporter-wall-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-wall');
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
async function supporter(name: string, opts: { months: number; shared?: boolean; wall?: boolean }) {
  const { db, schema: s } = await loadDb();
  n++;
  const [player] = await db.insert(s.players).values({}).returning();
  const [u] = await db.insert(s.users).values({ displayName: `Wall ${n}`, discordId: `wall-${n}`, playerId: player.id, supporterWall: opts.wall ?? true }).returning();
  await db.insert(s.accounts).values({
    playerId: player.id,
    rsn: name,
    rsnNormalized: name.toLowerCase(),
    shared: opts.shared ?? true,
    verifiedAt: new Date().toISOString(),
  });
  const start = new Date(Date.now() - opts.months * 31 * 86_400_000).toISOString();
  await db.insert(s.supporterSubscriptions).values({ userId: u.id, tier: 'supporter', status: 'active', startedAt: start, tenureStartedAt: start });
  return u;
}

test('every supporter is on the wall by default, longest first; opted-out and hidden characters are counted, never named', async () => {
  await supporter('Old Timer', { months: 40 });
  await supporter('Newbie', { months: 0 });
  await supporter('Hidden One', { months: 10, shared: false });
  const quiet = await supporter('Quiet One', { months: 20, wall: false });
  // Opted out on a SECOND login with no subscription of its own: still off the wall.
  const two = await supporter('Two Logins', { months: 5 });
  {
    const { db, schema: s } = await loadDb();
    await db.insert(s.users).values({ displayName: 'Two alt', discordId: 'wall-alt', playerId: two.playerId, supporterWall: false });
  }
  const { supporterWall } = await import('../src/lib/supporterWall.ts');
  const w = await supporterWall();
  assert.equal(w.total, 5);
  assert.deepEqual(w.entries.map((e) => e.name), ['Old Timer', 'Newbie']);
  assert.equal(w.entries[0].tenure?.id, 'legend');
  // Opting out is the users column; the wall is cached, so this only checks the column round-trips.
  const { db, schema: s } = await loadDb();
  const row = await db.query.users.findFirst({ where: eq(s.users.id, quiet.id), columns: { supporterWall: true } });
  assert.equal(row?.supporterWall, false);
});
