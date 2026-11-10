// Weekly activity streaks, the database half (lib/activityStreaks): the active days come out of
// member_daily_stats, and only rows that count as played.
//
// Run: npx tsx --test tests/activity-streaks-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('activity-streaks');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test('a character’s streak comes from its played days; idle and tiny days are left out', async () => {
  const { db, schema: s } = await loadDb();
  const [player] = await db.insert(s.players).values({}).returning();
  const [acc] = await db.insert(s.accounts).values({ playerId: player.id, rsn: 'Streaker', rsnNormalized: 'streaker' }).returning();
  const rows: (typeof s.memberDailyStats.$inferInsert)[] = [];
  // Every day for the last 5 weeks: plenty of play.
  for (let n = 1; n <= 35; n++) rows.push({ accountId: acc.id, day: day(n), overallXp: 1_000_000, xpGained: 50_000 });
  // Today: only 200 XP, which doesn't count.
  rows.push({ accountId: acc.id, day: day(0), overallXp: 1_000_000, xpGained: 200 });
  await db.insert(s.memberDailyStats).values(rows);

  const { streakForAccount, streakForRsn } = await import('../src/lib/activityStreaks.ts');
  const st = await streakForAccount(acc.id);
  assert.ok(st.weeks >= 4, `expected a streak of 4+ weeks, got ${st.weeks}`);
  assert.equal(st.best >= st.weeks, true);
  assert.ok((await streakForRsn('STREAKER'))!.weeks === st.weeks, 'found by name, any case');
  assert.equal(await streakForRsn('nobody here'), null);
});
