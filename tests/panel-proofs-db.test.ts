// A tile's proofs from the plugin's side panel against a real database (lib/tileProofs): a member
// sees their own team's, staff every team's, and a removal is checked here — whatever the panel drew
// — then goes through the web's own removal, so the tile's completion is worked out again.
//
// Run: TEST_DATABASE_URL=… npm run test:panelproofs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('panel-proofs');
process.env.S3_PUBLIC_BASE_URL = 'https://media.example';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let P: typeof import('../src/lib/tileProofs.ts');
let event: { id: number; clanId: number; startDate: string | null; endDate: string | null; forceEndedAt: string | null; editUnlockedAt: string | null };
let red: number;
let blue: number;
let tile: number;
let alice: number; // plays on Red
let bob: number; // captain of Red, plays on Red
let mod: number; // host-clan moderator, no seat
let aliceP: number;
let bobP: number;
let carolP: number; // Blue

const sub = async (teamId: number, playerId: number, amount = 1, imageUrl: string | null = 'https://media.example/c/c/p.webp') =>
  (await db.insert(s.submissions).values({ tileId: tile, teamId, playerId, amount, imageUrl }).returning())[0].id;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  P = await import('../src/lib/tileProofs.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'c', name: 'C' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Bingo', boardSize: 5, tilesRevealed: 1, startDate: new Date(Date.now() - 864e5).toISOString() })
    .returning();
  event = ev;
  [{ id: alice }, { id: bob }, { id: mod }] = await db
    .insert(s.users)
    .values([{ displayName: 'Alice' }, { displayName: 'Bob' }, { displayName: 'Mod' }])
    .returning();
  [{ id: red }, { id: blue }] = await db
    .insert(s.teams)
    .values([{ eventId: ev.id, name: 'Red', color: '#f00', captainUserId: bob }, { eventId: ev.id, name: 'Blue', color: '#00f' }])
    .returning();
  [{ id: tile }] = await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Vorkath KC', tileType: 'kill', requiredAmount: 3 }).returning();
  [{ id: aliceP }, { id: bobP }, { id: carolP }] = await db
    .insert(s.eventParticipants)
    .values([
      { eventId: ev.id, teamId: red, name: 'AliceRSN' },
      { eventId: ev.id, teamId: red, name: 'BobRSN' },
      { eventId: ev.id, teamId: blue, name: 'CarolRSN' },
    ])
    .returning();
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: mod, role: 'moderator' });
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

const asAlice = () => ({ userId: alice, playerId: aliceP, teamId: red });
const asBob = () => ({ userId: bob, playerId: bobP, teamId: red });

test('a member sees their own team’s proofs, newest first, paged; staff see every team’s', async () => {
  const ids = [];
  for (let i = 0; i < 7; i++) ids.push(await sub(red, i % 2 ? bobP : aliceP));
  await sub(blue, carolP);
  const page = await P.listTileProofs(event, tile, asAlice(), 6);
  assert.equal(page.proofs.length, 6);
  assert.equal(page.more, true);
  assert.equal(page.allTeams, false);
  assert.deepEqual(page.proofs.map((p) => p.id), ids.slice(1).reverse());
  assert.ok(page.proofs.every((p) => p.teamId === red), 'never Blue’s');
  assert.equal(page.proofs[0].imageUrl, 'https://media.example/c/c/p.webp');
  const rest = await P.listTileProofs(event, tile, asAlice(), 12);
  assert.equal(rest.proofs.length, 7);
  assert.equal(rest.more, false);

  const staff = await P.listTileProofs(event, tile, { userId: mod, playerId: null, teamId: null }, 20);
  assert.equal(staff.allTeams, true);
  assert.equal(staff.proofs.length, 8);
  assert.ok(staff.proofs.every((p) => p.canDelete));
  const spectator = await P.listTileProofs(event, tile, { userId: null, playerId: null, teamId: null }, 20);
  assert.deepEqual(spectator.proofs, []);
});

test('who may delete: your own as a player, your team’s as its captain', async () => {
  const list = await P.listTileProofs(event, tile, asAlice(), 20);
  for (const p of list.proofs) assert.equal(p.canDelete, p.who === 'AliceRSN', `${p.who}`);
  const bobs = await P.listTileProofs(event, tile, asBob(), 20);
  assert.ok(bobs.proofs.every((p) => p.canDelete), 'the captain removes any of Red’s');
});

test('the server refuses what the viewer may not delete, whatever id the client sends', async () => {
  const [bobsProof] = await db.select().from(s.submissions).where(eq(s.submissions.playerId, bobP)).limit(1);
  assert.equal(await P.deleteTileProof(event, bobsProof.id, asAlice(), 'nope'), 'You can only remove your own proofs.');
  const [carols] = await db.select().from(s.submissions).where(eq(s.submissions.teamId, blue));
  assert.equal(await P.deleteTileProof(event, carols.id, asBob(), 'nope'), 'You can only remove your own proofs.', 'a captain of another team');
  assert.ok(await db.query.submissions.findFirst({ where: eq(s.submissions.id, carols.id) }), 'still there');
  assert.equal(await P.deleteTileProof(event, 999_999, asAlice(), 'x'), 'That proof is already gone.');
});

test('removing proofs recomputes the tile: a finished tile reopens when it drops below the goal', async () => {
  // Red sits at 7 KC of 3; make the tile complete first.
  const { syncDropTileCompletion } = await import('../src/lib/submissions.ts');
  await syncDropTileCompletion(tile, red, { silent: true });
  const done = () => db.query.completions.findFirst({ where: and(eq(s.completions.teamId, red), eq(s.completions.tileId, tile)) });
  assert.ok(await done(), 'complete at 7/3');

  const reds = await db.select().from(s.submissions).where(eq(s.submissions.teamId, red));
  for (const r of reds.slice(0, 5)) assert.equal(await P.deleteTileProof(event, r.id, asBob(), 'bad screenshot'), null);
  assert.equal((await db.select().from(s.submissions).where(eq(s.submissions.teamId, red))).length, 2);
  assert.equal(await done(), undefined, 'back to open at 2/3');

  const [aliceLeft] = await db.select().from(s.submissions).where(and(eq(s.submissions.teamId, red), eq(s.submissions.playerId, aliceP)));
  if (aliceLeft) assert.equal(await P.deleteTileProof(event, aliceLeft.id, asAlice(), ''), null, 'the submitter removes their own');
});

test('a finished event is read-only: nothing to delete, and the server refuses', async () => {
  const over = { ...event, endDate: new Date(Date.now() - 1000).toISOString() };
  const list = await P.listTileProofs(over, tile, asBob(), 20);
  assert.ok(list.proofs.length > 0 && list.proofs.every((p) => !p.canDelete));
  assert.match((await P.deleteTileProof(over, list.proofs[0].id, asBob(), '')) ?? '', /finished/);
});
