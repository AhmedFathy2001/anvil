// Branching tile races against a real database: the completion gate refuses tiles off the team's
// route (the guard every insert path runs), banked early finishes land when the route reaches them,
// and "Choose and lock in" picks are final.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/race-routes-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('race-routes-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let gateFn: typeof import('../src/lib/completionGate.ts')['evaluateCompletionGate'];
let raceDb: typeof import('../src/lib/raceRoutesDb.ts');

let eventId: number;
let teamId: number;
const ids: Record<string, number> = {};

const event = async () => (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
const tile = async (k: string) => (await db.query.tiles.findFirst({ where: eq(s.tiles.id, ids[k]) }))!;
const gate = async (k: string) => gateFn({ event: await event(), tile: await tile(k), teamId });
const complete = (k: string) => db.insert(s.completions).values({ teamId, tileId: ids[k] });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ evaluateCompletionGate: gateFn } = await import('../src/lib/completionGate.ts'));
  raceDb = await import('../src/lib/raceRoutesDb.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'race', name: 'Race Test' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Race', boardSize: 4, format: 'tilerace', startDate: new Date(Date.now() - 86_400_000).toISOString() })
    .returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  teamId = team.id;
  // start -> (a | b) -> end
  for (const [i, k] of ['start', 'a', 'b', 'end'].entries()) {
    const [t] = await db.insert(s.tiles).values({ eventId, position: i, label: k }).returning();
    ids[k] = t.id;
  }
  const set = (k: string, step: number, next: string[]) =>
    db.update(s.tiles).set({ raceStep: step, raceNext: next.map((n) => ids[n]) }).where(eq(s.tiles.id, ids[k]));
  await set('start', 0, ['a', 'b']);
  await set('a', 1, ['end']);
  await set('b', 1, ['end']);
  await set('end', 2, []);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the gate refuses a tile that is not open on the route', async () => {
  const g = await gate('a');
  assert.equal(g.allowed, false);
  assert.equal(g.raceLocked, true);
  assert.equal((await gate('start')).allowed, true);
});

test('finishing a tile at a fork closes the other option', async () => {
  await complete('start');
  assert.equal((await gate('a')).allowed, true);
  assert.equal((await gate('b')).allowed, true);
  await complete('b');
  assert.equal((await gate('a')).allowed, false);
  assert.equal((await gate('end')).allowed, true);
});

test('a banked early finish lands when the route reaches it (rule on)', async () => {
  // Reset the team: only the start is done.
  await db.delete(s.completions).where(eq(s.completions.teamId, teamId));
  await db.update(s.events).set({ rules: JSON.stringify({ raceBank: true }) }).where(eq(s.events.id, eventId));
  // 'end' is ahead (reachable later): it banks.
  assert.equal(await raceDb.bankRaceCredit(await event(), ids.end, teamId, null), true);
  await complete('start');
  await complete('a');
  const released = await raceDb.releaseBankedRaceCredits(eventId, teamId);
  assert.equal(released, 1);
  const done = await db.select().from(s.completions).where(eq(s.completions.teamId, teamId));
  assert.ok(done.some((c) => c.tileId === ids.end));
  assert.equal((await db.select().from(s.raceBankedCredits)).length, 0);
});

test('with the rule off nothing banks', async () => {
  await db.update(s.events).set({ rules: null }).where(eq(s.events.id, eventId));
  await db.delete(s.completions).where(eq(s.completions.teamId, teamId));
  assert.equal(await raceDb.bankRaceCredit(await event(), ids.end, teamId, null), false);
});

test('choose and lock in: nothing at a fork counts until the pick, and the pick is final', async () => {
  await db.update(s.events).set({ rules: JSON.stringify({ raceRoad: 'choose' }) }).where(eq(s.events.id, eventId));
  await complete('start');
  assert.equal((await gate('a')).allowed, false);
  assert.deepEqual(await raceDb.pickRaceRoad(await event(), teamId, ids.a, null), { ok: true });
  assert.equal((await gate('a')).allowed, true);
  assert.equal((await gate('b')).allowed, false);
  const again = await raceDb.pickRaceRoad(await event(), teamId, ids.b, null);
  assert.equal(again.ok, false);
  assert.equal(await raceDb.clearRaceRoadPick(teamId, 1), true);
  assert.deepEqual(await raceDb.pickRaceRoad(await event(), teamId, ids.b, null), { ok: true });
});
