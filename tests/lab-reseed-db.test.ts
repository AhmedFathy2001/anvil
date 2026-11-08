// "Use real tiles" on a lab session (lib/lab reseedLabTiles), against a real database.
//
// What must hold:
//   - a lab race holding placeholder tiles ("Step 1"…) and progress comes back with the real lab
//     tile labels, laid out on the route with one start and one finish, and no progress rows left;
//   - an event outside the lab clan is refused and left untouched.
//
// Run: npx tsx --test tests/lab-reseed-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('lab-reseed');
const RSN = 'Lab Rat';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/lab.ts');
let P: typeof import('../src/lib/labPlan.ts');
let userId: number;
let accountId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/lab.ts');
  P = await import('../src/lib/labPlan.ts');
  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db.insert(s.users).values({ displayName: RSN, discordId: 'disc-reseed', playerId: person.id }).returning();
  [{ id: accountId }] = await db.insert(s.accounts).values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() }).returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const tilesOf = (eventId: number) => db.select().from(s.tiles).where(eq(s.tiles.eventId, eventId)).orderBy(s.tiles.position);

test('reseeding a placeholder lab race gives real tiles on a route and wipes progress', async () => {
  const id = await L.createLabSession(userId, { name: 'Race', hours: 1, boardSize: 10, accounts: [{ accountId, name: RSN }], format: 'race' });
  // Make it look like an old session: placeholder tiles, braided, with progress on them.
  await db.delete(s.tiles).where(eq(s.tiles.eventId, id));
  const old = await db
    .insert(s.tiles)
    .values(Array.from({ length: 10 }, (_, i) => ({ eventId: id, position: i, label: `Step ${i + 1}`, points: 1 })))
    .returning();
  const [team] = await db.select().from(s.teams).where(eq(s.teams.eventId, id));
  await db.insert(s.completions).values({ teamId: team.id, tileId: old[0].id });

  assert.equal(await L.reseedLabTiles(id, { route: 'diamond' }), true);

  const ev = (await L.labEvent(id))!;
  const fresh = await tilesOf(id);
  const want = P.labTileSeeds(P.labFormat('race'), ev.boardSize, Date.parse(ev.startDate!)).map((t) => t.label);
  assert.deepEqual(fresh.map((t) => t.label), want);
  assert.ok(!fresh.some((t) => /^Step \d+$/.test(t.label)));
  if (L.LAB_RACE_ROUTES) {
    const steps = fresh.map((t) => (t as unknown as { raceStep: number | null }).raceStep);
    assert.ok(steps.every((n) => n != null));
    const last = Math.max(...(steps as number[]));
    assert.equal(steps.filter((n) => n === 0).length, 1, 'one start');
    assert.equal(steps.filter((n) => n === last).length, 1, 'one finish');
  }
  const teamIds = (await db.select().from(s.teams).where(eq(s.teams.eventId, id))).map((t) => t.id);
  assert.equal((await db.select().from(s.completions).where(inArray(s.completions.teamId, teamIds))).length, 0);
  assert.equal((await db.select().from(s.submissions).where(inArray(s.submissions.teamId, teamIds))).length, 0);
});

test('a non-lab event is refused', async () => {
  const [clan] = await db.insert(s.clans).values({ name: 'Real clan', slug: 'real-clan' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Real race', boardSize: 3, format: 'tilerace' }).returning();
  await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Step 1', points: 1 });
  assert.equal(await L.reseedLabTiles(ev.id), false);
  assert.deepEqual((await tilesOf(ev.id)).map((t) => t.label), ['Step 1']);
});
