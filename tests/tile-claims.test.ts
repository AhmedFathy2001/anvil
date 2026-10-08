// Team-private tile claims (lib/tileClaims): what a team plans stays inside the team, hidden tiles
// stay hidden, and a finished tile stops showing who was going for it.
//
// Run: npm run test:tileclaims

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('tile-claims');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/tileClaims.ts');
let eventId: number;
let red: number;
let blue: number;
let tileA: number;
let tileB: number;
let alice: number;
let bob: number;
let aliceP: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/tileClaims.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'c', name: 'C' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Bingo', boardSize: 5, tilesRevealed: 1, startDate: new Date(Date.now() - 864e5).toISOString() })
    .returning();
  eventId = ev.id;
  [{ id: red }, { id: blue }] = await db
    .insert(s.teams)
    .values([{ eventId, name: 'Red', color: '#f00' }, { eventId, name: 'Blue', color: '#00f' }])
    .returning();
  [{ id: tileA }, { id: tileB }] = await db
    .insert(s.tiles)
    .values([
      { eventId, position: 0, label: 'Zulrah pet', tileType: 'drop' },
      { eventId, position: 1, label: 'Fire cape', tileType: 'drop' },
    ])
    .returning();
  [{ id: alice }, { id: bob }] = await db
    .insert(s.users)
    .values([{ displayName: 'Alice' }, { displayName: 'Bob' }])
    .returning();
  [{ id: aliceP }] = await db.insert(s.eventParticipants).values({ eventId, teamId: red, name: 'AliceRSN' }).returning();
});

after(async () => {
  await pool?.end();
  await dropDatabase(DB);
});

test('a claim shows to its own team under the enrolled name, and never to another team', async () => {
  const r = await C.claimTile({ eventId, teamId: red, tileId: tileA, userId: alice, participantId: aliceP, note: ' tonight  ' });
  assert.deepEqual(r, { ok: true });
  const mine = await C.listTeamClaims(eventId, red, alice);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].name, 'AliceRSN');
  assert.equal(mine[0].mine, true);
  assert.deepEqual(await C.listTeamClaims(eventId, blue, bob), [], 'Blue sees nothing of Red’s plan');
});

test('claiming again updates the note rather than adding a second claim', async () => {
  await C.claimTile({ eventId, teamId: red, tileId: tileA, userId: alice, participantId: aliceP, note: C.cleanNote('  after work ') });
  const claims = await C.listTeamClaims(eventId, red, bob);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].note, 'after work');
  assert.equal(claims[0].mine, false, 'Bob sees it as Alice’s');
});

test('hidden tiles can’t be claimed, and existing claims vanish while the board is hidden', async () => {
  await db.update(s.events).set({ tilesRevealed: 0 }).where(eq(s.events.id, eventId));
  const r = await C.claimTile({ eventId, teamId: red, tileId: tileB, userId: alice, participantId: aliceP, note: null });
  assert.equal(r.ok, false);
  assert.deepEqual(await C.listTeamClaims(eventId, red, alice), []);
  await db.update(s.events).set({ tilesRevealed: 1 }).where(eq(s.events.id, eventId));
  assert.equal((await C.listTeamClaims(eventId, red, alice)).length, 1, 'back once revealed');
});

test('a tile from another event can’t be claimed', async () => {
  const r = await C.claimTile({ eventId, teamId: red, tileId: 999_999, userId: alice, participantId: aliceP, note: null });
  assert.equal(r.ok, false);
});

test('once the team completes the tile, the claim stops showing and it can’t be claimed', async () => {
  await db.insert(s.completions).values({ teamId: red, tileId: tileA });
  assert.deepEqual(await C.listTeamClaims(eventId, red, alice), []);
  const r = await C.claimTile({ eventId, teamId: red, tileId: tileA, userId: bob, participantId: null, note: null });
  assert.equal(r.ok, false);
  // Another team's completion changes nothing for Red.
  await C.claimTile({ eventId, teamId: red, tileId: tileB, userId: alice, participantId: aliceP, note: null });
  await db.insert(s.completions).values({ teamId: blue, tileId: tileB });
  assert.equal((await C.listTeamClaims(eventId, red, alice)).length, 1);
});

test('unclaim only removes the named person’s claim', async () => {
  await C.claimTile({ eventId, teamId: red, tileId: tileB, userId: bob, participantId: null, note: null });
  await C.unclaimTile(red, tileB, bob);
  const left = await C.listTeamClaims(eventId, red, alice);
  assert.deepEqual(left.map((c) => c.userId), [alice]);
});

test('claims are wired into the team page only — never a public board or the anonymous pulse', async () => {
  const { execFileSync } = await import('node:child_process');
  const hits = execFileSync('git', ['grep', '-l', '-E', 'claimedBy=|useTeamClaims|/claims`|listTeamClaims', '--', 'src/app'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();
  assert.deepEqual(hits, [
    'src/app/api/team/[teamId]/claims/route.ts',
    'src/app/team/[teamId]/MyTeamClient.tsx',
    'src/app/team/[teamId]/TeamClaims.tsx',
  ]);
});
