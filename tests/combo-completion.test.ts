import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

// Combo tiles against a real database (lib/comboCompletion): a part completes through its own engine
// — here the submission sync and the manual completions path — and its combo's completion follows
// under the rule. Also: a CAPPED counter part (lib/tileCaps) completes on the capped count only, and a
// 'mix' combo completes on partial progress across parts. Parts never become board completions that
// score: only the combo's row does.
//
// Run: npx tsx --test tests/combo-completion.test.ts

const DB = useTestDatabase('combo-completion');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let afterPartCompletion: typeof import('../src/lib/comboCompletion.ts')['afterPartCompletion'];
let syncDropTileCompletion: typeof import('../src/lib/submissions.ts')['syncDropTileCompletion'];

const TEAM = 11;
const ANN = 21;
const BO = 22;
const IMG = 'https://media.example/proof.png';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

async function done(tileId: number): Promise<boolean> {
  const { and, eq } = await import('drizzle-orm');
  const rows = await db.select().from(s.completions).where(and(eq(s.completions.teamId, TEAM), eq(s.completions.tileId, tileId)));
  return rows.length > 0;
}

async function tile(id: number) {
  const { eq } = await import('drizzle-orm');
  return (await db.select().from(s.tiles).where(eq(s.tiles.id, id)))[0]!;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, schema: s, pool } = await loadDb());
  ({ afterPartCompletion } = await import('../src/lib/comboCompletion.ts'));
  ({ syncDropTileCompletion } = await import('../src/lib/submissions.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'combo', name: 'Combo Clan' }).returning({ id: s.clans.id });
  await db.insert(s.events).values({
    id: 1, clanId: clan!.id, name: 'Combos', boardSize: 2, createdAt: hoursAgo(72), startDate: hoursAgo(48),
    endDate: new Date(Date.now() + 86_400_000).toISOString(), scoringMode: 'points', format: 'bingo', tilesRevealed: 1,
  });
  await db.insert(s.teams).values({ id: TEAM, eventId: 1, name: 'Alpha', color: '#d0553f' });
  await db.insert(s.eventParticipants).values([
    { id: ANN, eventId: 1, name: 'Ann', teamId: TEAM },
    { id: BO, eventId: 1, name: 'Bo', teamId: TEAM },
  ]);
  await db.insert(s.tiles).values([
    // A: any one of [manual screenshot part, 3 cow kills]
    { id: 100, eventId: 1, position: 0, label: 'A', tileType: 'combo', comboRule: '{"mode":"any"}', points: 10 },
    { id: 101, eventId: 1, position: 0, label: 'A1 manual', tileType: 'standard', parentTileId: 100, points: 0 },
    { id: 102, eventId: 1, position: 0, label: 'A2 cows', tileType: 'kill', targetNpcs: '["Cow"]', requiredAmount: 3, parentTileId: 100, points: 0 },
    // B: all of two manual parts
    { id: 200, eventId: 1, position: 1, label: 'B', tileType: 'combo', comboRule: '{"mode":"all"}', points: 20 },
    { id: 201, eventId: 1, position: 1, label: 'B1', tileType: 'standard', parentTileId: 200, points: 0 },
    { id: 202, eventId: 1, position: 1, label: 'B2', tileType: 'standard', parentTileId: 200, points: 0 },
    // C: mix of [200 gorilla kills, 2 zenyte shards]
    { id: 300, eventId: 1, position: 2, label: 'C', tileType: 'combo', comboRule: '{"mode":"mix"}', points: 30 },
    { id: 301, eventId: 1, position: 2, label: 'C1 gorillas', tileType: 'kill', targetNpcs: '["Demonic gorilla"]', requiredAmount: 200, parentTileId: 300, points: 0 },
    { id: 302, eventId: 1, position: 2, label: 'C2 zenytes', tileType: 'drop', trackedItemIds: '[19529]', requiredAmount: 2, parentTileId: 300, points: 0 },
    // D: any one of [100 searches with event energy, a manual part]
    { id: 400, eventId: 1, position: 3, label: 'D', tileType: 'combo', comboRule: '{"mode":"any"}', points: 5 },
    { id: 401, eventId: 1, position: 3, label: 'D1 searches', tileType: 'kill', targetNpcs: '["Guardians of the Rift searches"]', requiredAmount: 100, capBy: '["GOTR elemental energy","GOTR catalytic energy"]', parentTileId: 400, points: 0 },
    { id: 402, eventId: 1, position: 3, label: 'D2 manual', tileType: 'standard', parentTileId: 400, points: 0 },
    // E: any one of [2 new collection-log slots (any item), a manual part]
    { id: 500, eventId: 1, position: 4, label: 'E', tileType: 'combo', comboRule: '{"mode":"any"}', points: 1 },
    { id: 501, eventId: 1, position: 4, label: 'E1 clog slots', tileType: 'clog', countMode: 'slots', requiredAmount: 2, parentTileId: 500, points: 0 },
    { id: 502, eventId: 1, position: 4, label: 'E2 manual', tileType: 'standard', parentTileId: 500, points: 0 },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('any: a part completing completes the combo; undoing the part undoes it', async () => {
  await db.insert(s.completions).values({ teamId: TEAM, tileId: 101 });
  const res = await afterPartCompletion(await tile(101), TEAM, { change: 'added', silent: true });
  assert.equal(res?.inserted, true);
  assert.equal(await done(100), true);

  const { and, eq } = await import('drizzle-orm');
  await db.delete(s.completions).where(and(eq(s.completions.teamId, TEAM), eq(s.completions.tileId, 101)));
  await afterPartCompletion(await tile(101), TEAM, { change: 'removed', silent: true });
  assert.equal(await done(100), false);
});

test('any: the kill part completes through the submission sync (proof from its own rows)', async () => {
  // Three image-less pings reach the count, but the completion is held for a screenshot.
  await db.insert(s.submissions).values([
    { tileId: 102, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 2 },
    { tileId: 102, teamId: TEAM, playerId: BO, creditPlayerId: BO, amount: 1 },
  ]);
  await syncDropTileCompletion(102, TEAM, { silent: true });
  assert.equal(await done(102), false);
  assert.equal(await done(100), false);
  await db.insert(s.submissions).values({ tileId: 102, teamId: TEAM, playerId: BO, creditPlayerId: BO, amount: 1, imageUrl: IMG });
  await syncDropTileCompletion(102, TEAM, { silent: true });
  assert.equal(await done(102), true);
  assert.equal(await done(100), true);
});

test('all: one part is progress, both complete it', async () => {
  await db.insert(s.completions).values({ teamId: TEAM, tileId: 201 });
  await afterPartCompletion(await tile(201), TEAM, { change: 'added', silent: true });
  assert.equal(await done(200), false);
  await db.insert(s.completions).values({ teamId: TEAM, tileId: 202 });
  await afterPartCompletion(await tile(202), TEAM, { change: 'added', silent: true });
  assert.equal(await done(200), true);
});

test('mix: half the kills and half the zenytes complete it, neither part being done', async () => {
  await db.insert(s.submissions).values({ tileId: 301, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 10, imageUrl: IMG });
  await db.insert(s.submissions).values({ tileId: 302, teamId: TEAM, playerId: BO, creditPlayerId: BO, amount: 1, itemId: 19529, imageUrl: IMG });
  await syncDropTileCompletion(302, TEAM, { silent: true });
  assert.equal(await done(300), false); // 5% + 50%
  await db.insert(s.submissions).values({ tileId: 301, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 90, imageUrl: IMG });
  await syncDropTileCompletion(301, TEAM, { silent: true });
  assert.equal(await done(301), false);
  assert.equal(await done(302), false);
  assert.equal(await done(300), true); // 50% + 50%
});

test('capped counter: searches only count up to the energy earned', async () => {
  await db.insert(s.submissions).values([
    { tileId: 401, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 100, imageUrl: IMG },
    { tileId: 401, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 60, goal: 'cap:0' },
    { tileId: 401, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 80, goal: 'cap:1' },
  ]);
  await syncDropTileCompletion(401, TEAM, { silent: true });
  assert.equal(await done(401), false); // min(100, 60, 80) = 60
  assert.equal(await done(400), false);
  // Bo's energy can't pay for Ann's searches.
  await db.insert(s.submissions).values({ tileId: 401, teamId: TEAM, playerId: BO, creditPlayerId: BO, amount: 500, goal: 'cap:0' });
  await syncDropTileCompletion(401, TEAM, { silent: true });
  assert.equal(await done(401), false);
  // Ann attunes 40 more elemental (and has catalytic to spare): 100 counted.
  await db.insert(s.submissions).values([
    { tileId: 401, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 40, goal: 'cap:0' },
    { tileId: 401, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 20, goal: 'cap:1' },
  ]);
  await syncDropTileCompletion(401, TEAM, { silent: true });
  assert.equal(await done(401), true);
  assert.equal(await done(400), true);
});

test('a collection-log part: new slots are distinct per member, and complete the combo', async () => {
  await db.insert(s.submissions).values([
    { tileId: 501, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 1, itemId: 4708, imageUrl: IMG },
    { tileId: 501, teamId: TEAM, playerId: ANN, creditPlayerId: ANN, amount: 1, itemId: 4708, imageUrl: IMG }, // a repeat
  ]);
  await syncDropTileCompletion(501, TEAM, { silent: true });
  assert.equal(await done(501), false);
  assert.equal(await done(500), false);
  // Bo's first copy of the same item is a new slot for HIM.
  await db.insert(s.submissions).values({ tileId: 501, teamId: TEAM, playerId: BO, creditPlayerId: BO, amount: 1, itemId: 4708, imageUrl: IMG });
  await syncDropTileCompletion(501, TEAM, { silent: true });
  assert.equal(await done(501), true);
  assert.equal(await done(500), true);
});

test('only combos score: the board is the five combos, their parts never count', async () => {
  const { getTeamStandings } = await import('../src/lib/statStandings.ts');
  const [row] = await getTeamStandings(1, 'points');
  assert.equal(row.total, 66);
  assert.equal(row.score, 10 + 20 + 30 + 5 + 1);
});
