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
let eventForPluginRequest: typeof import('../src/lib/eventScope.ts')['eventForPluginRequest'];
let charlie: number;

let alpha: number;
let bravo: number;
let alphaEvent: number;
let bravoEvent: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ eventInClan, eventForPluginRequest } = await import('../src/lib/eventScope.ts'));

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

  // Bravo co-hosts Alpha's board; Charlie was invited and has not accepted.
  [{ id: charlie }] = await db.insert(s.clans).values({ slug: 'charlie', name: 'Charlie Clan' }).returning();
  await db.insert(s.eventCohosts).values([
    { eventId: alphaEvent, clanId: bravo, status: 'accepted' },
    { eventId: alphaEvent, clanId: charlie, status: 'pending' },
  ]);
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

// The plugin connects a co-host's members to THEIR clan, so its calls for the shared board arrive at
// the co-host's address. Those answer; nothing else widens.
const at = (slug: string) => new Request('https://example.test/api/plugin/board', { headers: { 'x-anvil-clan-slug': slug } });

test("the plugin reaches a co-hosted board from the co-host's address, marked as such", async () => {
  const own = await eventForPluginRequest(at('alpha'), alphaEvent);
  assert.deepEqual([own?.event.id, own?.viaCohost], [alphaEvent, false]);
  const cohost = await eventForPluginRequest(at('bravo'), alphaEvent);
  assert.deepEqual([cohost?.event.id, cohost?.viaCohost], [alphaEvent, true]);
});

test('an invitation not yet accepted reaches nothing, and the host cannot reach the co-host\'s own board', async () => {
  assert.equal(await eventForPluginRequest(at('charlie'), alphaEvent), null);
  assert.equal(await eventForPluginRequest(at('alpha'), bravoEvent), null);
  assert.equal(await eventForPluginRequest(at('charlie'), Number.NaN), null);
});
