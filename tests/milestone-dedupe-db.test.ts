// A milestone is stored once per account, kind, metric and threshold — including the account-wide
// kinds (total XP, EHP, EHB) whose metric is NULL, which the old unique index let through twice.
// A repeat detection inserts nothing, so it can never be announced twice.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/milestone-dedupe-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { useTestDatabase, resetDatabase, migrateRest, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('milestonededupe');
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
// Nothing here talks to the outside: any Discord post would be answered with a 404 and counted.
const realFetch = globalThis.fetch;
let outbound = 0;
globalThis.fetch = (async () => {
  outbound++;
  return new Response('{}', { status: 404 });
}) as typeof fetch;

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let accountId = 0;

const snap = (skills: Record<string, number>) =>
  ({ skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp, level: 99 }])), bosses: {} }) as never;

before(async () => {
  // Stop before 0249 so the duplicates the old index allowed can be seeded, then migrate on.
  await resetDatabase(DB, '0248_owner_money');
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const person = (await db.insert(s.players).values({ displayName: 'Veyyr' }).returning())[0].id;
  accountId = (await db.insert(s.accounts).values({ playerId: person, rsn: 'Veyyr', rsnNormalized: 'veyyr' }).returning())[0].id;
  await db.insert(s.memberMilestones).values([
    { accountId, kind: 'totalxp', metric: null, threshold: 100 },
    { accountId, kind: 'totalxp', metric: null, threshold: 100 },
    { accountId, kind: 'xp', metric: 'woodcutting', threshold: 5_000_000 },
  ]);
  migrateRest(DB);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool?.end();
  await dropDatabase(DB);
});

async function rows() {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  return db.select().from(s.memberMilestones).where(eq(s.memberMilestones.accountId, accountId));
}

test('0249 removes duplicate null-metric rows the old index allowed', async () => {
  const r = await rows();
  assert.equal(r.filter((m) => m.kind === 'totalxp' && m.threshold === 100).length, 1);
  assert.equal(r.length, 2);
});

test('a historic crossing is recorded once and a repeat inserts nothing', async () => {
  const { recordMilestones } = await import('../src/lib/statHistory.ts');
  const found = [
    { kind: 'xp' as const, metric: 'woodcutting', threshold: 10_000_000 },
    { kind: 'ehp' as const, metric: null, threshold: 500 },
  ];
  const samples = {
    before: snap({ woodcutting: 9_000_000 }),
    after: snap({ woodcutting: 10_500_000 }),
    previousAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), // a month-old sample
  };
  assert.equal(await recordMilestones(accountId, found, samples), 2, 'stored as seen');
  assert.equal(await recordMilestones(accountId, found, samples), 0, 'the same steps again are no-ops');
  // The null-metric kind dedupes too now.
  const { db, schema: s } = await loadDb();
  await db.insert(s.memberMilestones).values({ accountId, kind: 'ehp', metric: null, threshold: 500 }).onConflictDoNothing();
  const r = await rows();
  assert.equal(r.filter((m) => m.kind === 'ehp' && m.threshold === 500).length, 1);
  assert.equal(outbound, 0, 'nothing was posted');
});
