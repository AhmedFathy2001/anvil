// A clan's tile library is that clan's. Task ids arrive straight from a request body, so the update
// and delete helpers must refuse an id that belongs to another clan's library — they used to edit or
// delete whatever id they were handed.
//
// Run: npm run test:tilelibrary

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('tile-library-scope');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/tileLibrary.ts');
let mine: number;
let theirs: number;
let theirTask: number;
let myTask: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/tileLibrary.ts');
  [{ id: mine }] = await db.insert(s.clans).values({ slug: 'mine', name: 'Mine' }).returning();
  [{ id: theirs }] = await db.insert(s.clans).values({ slug: 'theirs', name: 'Theirs' }).returning();
  [{ id: myTask }] = await db
    .insert(s.tileLibrary)
    .values({ clanId: mine, label: 'Mine', points: 1, config: '{}' })
    .returning();
  [{ id: theirTask }] = await db
    .insert(s.tileLibrary)
    .values({ clanId: theirs, label: 'Theirs', points: 1, config: '{}' })
    .returning();
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

test('another clan’s task can’t be edited by id', async () => {
  await L.updateTask(mine, theirTask, { label: 'Hijacked' });
  const row = await db.query.tileLibrary.findFirst({ where: eq(s.tileLibrary.id, theirTask) });
  assert.equal(row?.label, 'Theirs');
  await L.updateTask(mine, myTask, { label: 'Renamed' });
  assert.equal((await db.query.tileLibrary.findFirst({ where: eq(s.tileLibrary.id, myTask) }))?.label, 'Renamed');
});

test('another clan’s task can’t be deleted by id', async () => {
  assert.equal(await L.deleteTasks(mine, [theirTask]), 0);
  assert.ok(await db.query.tileLibrary.findFirst({ where: eq(s.tileLibrary.id, theirTask) }));
  assert.equal(await L.deleteTasks(mine, [myTask, theirTask]), 1, 'only the clan’s own id goes');
  assert.ok(await db.query.tileLibrary.findFirst({ where: eq(s.tileLibrary.id, theirTask) }));
});
