// An event id names one clan's event, and only that clan may read it.
//
// Event ids are global and arrive from the URL, so `/events/2` on one clan's host found another
// clan's event and then did all its work — tiles, teams, submissions — correctly keyed to it. Every
// query downstream was right; the one nobody asked was whose event it was. `theafkspot/events/2`
// rendered Second Clan's board, and the submissions and plugin-board endpoints leaked the same way.
//
// Run: npm run test:eventscope

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-scope');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let eventInClan: typeof import('../src/lib/eventScope.ts')['eventInClan'];

let alpha: number;
let bravo: number;
let alphaEvent: number;
let bravoEvent: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ eventInClan } = await import('../src/lib/eventScope.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha Clan' },
      { slug: 'bravo', name: 'Bravo Clan' },
    ])
    .returning();
  alpha = clans.find((c) => c.slug === 'alpha')!.id;
  bravo = clans.find((c) => c.slug === 'bravo')!.id;

  const events = await db
    .insert(s.events)
    .values([
      { clanId: alpha, name: "Alpha's Board", boardSize: 5 },
      { clanId: bravo, name: "Bravo's Board", boardSize: 5 },
    ])
    .returning();
  alphaEvent = events.find((e) => e.clanId === alpha)!.id;
  bravoEvent = events.find((e) => e.clanId === bravo)!.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a clan can read its own event', async () => {
  const found = await eventInClan(alpha, alphaEvent);
  assert.equal(found?.name, "Alpha's Board");
});

test("a clan cannot read another clan's event, however real the id", async () => {
  assert.equal(await eventInClan(alpha, bravoEvent), null);
  assert.equal(await eventInClan(bravo, alphaEvent), null);
});

test('a missing event and another clan\'s event are indistinguishable', async () => {
  // Both null on purpose. If "not yours" answered differently from "no such thing", the response
  // would be a probe for which ids exist in other clans.
  const missing = await eventInClan(alpha, 999_999);
  const foreign = await eventInClan(alpha, bravoEvent);
  assert.equal(missing, foreign);
});

test('a nonsense id is refused rather than queried', async () => {
  assert.equal(await eventInClan(alpha, Number.NaN), null);
});
