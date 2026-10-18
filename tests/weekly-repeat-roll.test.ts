// Repeating weeklies against a real database: the roll makes exactly one successor, carries the
// rotation forward, and stops when repeat is switched off.
//
// Run: npm run test:weeklyroll

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-repeat-roll');
const DAY = 86_400_000;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let roll: typeof import('../src/lib/weeklyRepeat.ts');
let clanId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, schema: s, pool } = await loadDb());
  roll = await import('../src/lib/weeklyRepeat.ts');
  const [c] = await db.insert(s.clans).values({ slug: 'rolls', name: 'Rolls' }).returning();
  clanId = c.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a finished repeating week starts the next one in its rotation, once', async () => {
  const now = Date.now();
  const [w1] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId, type: 'skill', metric: 'agility', title: 'SOTW: Agility',
      startDate: new Date(now - 8 * DAY).toISOString(), endDate: new Date(now - DAY).toISOString(),
      status: 'completed', includeGuests: 0,
    })
    .returning();
  await roll.setWeeklyRepeat(clanId, w1.id, { rotation: ['agility', 'slayer'] });

  assert.equal(await roll.rollWeeklySeries(now), 1);
  assert.equal(await roll.rollWeeklySeries(now), 0, 'a second tick makes nothing');

  const all = await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.clanId, clanId));
  assert.equal(all.length, 2);
  const w2 = all.find((w) => w.id !== w1.id)!;
  assert.equal(w2.metric, 'slayer');
  assert.equal(w2.title, 'SOTW: Slayer');
  assert.equal(w2.status, 'active');
  assert.equal(w2.includeGuests, 0);
  assert.deepEqual(await roll.getWeeklyRepeat(clanId, w2.id), { rotation: ['agility', 'slayer'] });

  // Switched off on the running week: when it ends, nothing follows.
  await roll.setWeeklyRepeat(clanId, w2.id, null);
  await db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.id, w2.id));
  assert.equal(await roll.rollWeeklySeries(now + 7 * DAY), 0);
});
