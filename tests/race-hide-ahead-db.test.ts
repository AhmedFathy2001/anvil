// "Hide tiles past the next step" against a real database: the veil follows each team's own route,
// lifts when the race ends, a tile hidden from another team stays out of shared posts, and the
// public feed rows lose a hidden tile's name.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/race-hide-ahead-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('race-hide-ahead-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let hideDb: typeof import('../src/lib/raceHideAheadDb.ts');
let hide: typeof import('../src/lib/raceHideAhead.ts');
let feed: typeof import('../src/lib/pluginUi/feedLists.ts');

let eventId: number;
let red: number;
let blue: number;
const ids: Record<string, number> = {};

const event = async () => (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
const setRules = (rules: object | null) => db.update(s.events).set({ rules: rules ? JSON.stringify(rules) : null }).where(eq(s.events.id, eventId));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  hideDb = await import('../src/lib/raceHideAheadDb.ts');
  hide = await import('../src/lib/raceHideAhead.ts');
  feed = await import('../src/lib/pluginUi/feedLists.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'hide', name: 'Hide Test' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Race', boardSize: 4, format: 'tilerace', tilesRevealed: 1, startDate: new Date(Date.now() - 86_400_000).toISOString() })
    .returning();
  eventId = ev.id;
  red = (await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning())[0].id;
  blue = (await db.insert(s.teams).values({ eventId, name: 'Blue', color: '#0000ff' }).returning())[0].id;
  // A straight line: one -> two -> three -> four.
  for (const [i, k] of ['one', 'two', 'three', 'four'].entries()) {
    const [t] = await db.insert(s.tiles).values({ eventId, position: i, label: `Giant key ${k}` }).returning();
    ids[k] = t.id;
  }
  await db.insert(s.completions).values([{ teamId: red, tileId: ids.one }, { teamId: red, tileId: ids.two }]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('off by default: no veil, nothing hidden', async () => {
  assert.equal(hideDb.raceHideOn(await event()), false);
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids.three, red), false);
});

test('on: each team sees its own route; the leader’s next tile is hidden from the trailing team', async () => {
  await setRules({ raceHideAhead: 'players' });
  const veil = await hideDb.loadRaceVeilFresh(await event(), 'players');
  const redSeen = hide.raceSeenFor(veil, { teamIds: [red] })!;
  const blueSeen = hide.raceSeenFor(veil, { teamIds: [blue] })!;
  assert.deepEqual([...redSeen].sort(), [ids.one, ids.two, ids.three].sort());
  assert.deepEqual([...blueSeen], [ids.one]);
  // Red's post about tile three names a tile Blue can't see: it stays in Red's channel.
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids.three, red), true);
  // Tile one is everyone's.
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids.one, red), false);
});

test('the shared feed names only what every team can see; a team’s own feed names its own', async () => {
  const publicRows = await feed.boardCompletions(eventId);
  const two = publicRows.find((r) => r.tileId === ids.two)!;
  assert.equal(two.label, hide.HIDDEN_RACE_TILE_LABEL);
  const redRows = await feed.boardCompletions(eventId, [red]);
  assert.equal(redRows.find((r) => r.tileId === ids.two)!.label, 'Giant key two');
});

test('a public reply loses the hidden names', async () => {
  const rows = await hideDb.publicRaceLabels(await event(), [
    { tileId: ids.one, label: 'Giant key one' },
    { tileId: ids.two, label: 'Giant key two' },
  ]);
  assert.deepEqual(rows.map((r) => r.label), ['Giant key one', hide.HIDDEN_RACE_TILE_LABEL]);
});

test('once the race is over the veil lifts', async () => {
  await db.update(s.events).set({ forceEndedAt: new Date().toISOString() }).where(eq(s.events.id, eventId));
  assert.equal(hideDb.raceHideMode(await event()), 'off');
  assert.equal(await hideDb.raceTileHiddenFromOthers(eventId, ids.three, red), false);
  await db.update(s.events).set({ forceEndedAt: null }).where(eq(s.events.id, eventId));
});

test('owner-only switch: a plain admin may not change "Also hide from event staff"', async () => {
  const [u] = await db.insert(s.users).values({ discordId: 'hide-admin', displayName: 'admin' }).returning();
  assert.equal(await hideDb.mayChangeStaffHide({ userId: u.id, isOwner: false }), false);
  assert.equal(await hideDb.mayChangeStaffHide({ userId: u.id, isOwner: true }), true);
  // Seeing through: a board editor grant on this board.
  assert.equal(await hideDb.seesThroughStaffHide(eventId, { userId: u.id, isOwner: false }), false);
  await db.insert(s.eventEditors).values({ eventId, userId: u.id, role: 'editor' });
  assert.equal(await hideDb.seesThroughStaffHide(eventId, { userId: u.id, isOwner: false }), true);
  // A treasurer grant on the same board is not a tile grant.
  const [t] = await db.insert(s.users).values({ discordId: 'hide-treasurer', displayName: 'treasurer' }).returning();
  await db.insert(s.eventEditors).values({ eventId, userId: t.id, role: 'treasurer' });
  assert.equal(await hideDb.seesThroughStaffHide(eventId, { userId: t.id, isOwner: false }), false);
});

test('"Also hide from event staff": only the owner may give or take tile editing on the board', async () => {
  const [u] = await db.insert(s.users).values({ discordId: 'hide-granter', displayName: 'granter' }).returning();
  const admin = { userId: u.id, isOwner: false };
  await setRules({ raceHideAhead: 'players' });
  assert.equal(await hideDb.editorGrantBlocked([eventId], admin), false, 'players-only: admins grant as before');
  await setRules({ raceHideAhead: 'staff' });
  assert.equal(await hideDb.editorGrantBlocked([eventId], admin), true, 'an admin may not hand out a way through');
  assert.equal(await hideDb.editorGrantBlocked([eventId], { userId: u.id, isOwner: true }), false, 'the clan owner may');
  assert.equal(await hideDb.editorGrantBlocked([], admin), false, 'nothing changing, nothing blocked');
  // The platform owner (users.isOwner) may too.
  await db.update(s.users).set({ isOwner: true }).where(eq(s.users.id, u.id));
  assert.equal(await hideDb.editorGrantBlocked([eventId], admin), false);
  await setRules({ raceHideAhead: 'players' });
});
