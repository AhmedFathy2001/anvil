// The stream overlay and `!join` against a real database: a key opens exactly one event's public
// view, the curtain and the reveal hold on stream, a reset kills the old URL, a suspended space's key
// opens nothing, and `!join` picks the open event a stranger can see.
//
// Run: npm run test:overlay   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('overlay');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let O: typeof import('../src/lib/overlay/overlayData.ts');
let B: typeof import('../src/lib/twitchBot/channels.ts');

let clanId: number;
let eventId: number;
let otherEventId: number;
let tileA: number;
let tileB: number;

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 86_400_000;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  O = await import('../src/lib/overlay/overlayData.ts');
  B = await import('../src/lib/twitchBot/channels.ts');

  const [c] = await db.insert(s.clans).values({ slug: 'streamer', name: 'Streamer', kind: 'creator', plan: 'creator_free', visibility: 'public' }).returning();
  clanId = c.id;
  const [e] = await db
    .insert(s.events)
    .values({ clanId, name: 'Stream Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  eventId = e.id;
  const [o] = await db
    .insert(s.events)
    .values({ clanId, name: 'Other', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(DAY), tilesRevealed: 1 })
    .returning();
  otherEventId = o.id;
  const [red, blue] = await db
    .insert(s.teams)
    .values([
      { eventId, name: 'Red', color: '#ff0000' },
      { eventId, name: 'Blue', color: '#0000ff' },
    ])
    .returning();
  const [ta, tb] = await db
    .insert(s.tiles)
    .values([
      { eventId, position: 0, label: 'Fire cape' },
      { eventId, position: 1, label: 'Twisted bow' },
    ])
    .returning();
  tileA = ta.id;
  tileB = tb.id;
  await db.insert(s.completions).values({ tileId: tileA, teamId: red.id, completedAt: iso(-3_600_000) });
  void blue;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('no key until the host makes one; a key opens its own event only', async () => {
  assert.equal(await O.overlayKeyFor(eventId), null);
  const key = await O.rotateOverlayKey(eventId);
  assert.equal(await O.overlayKeyFor(eventId), key);
  const ev = await O.overlayEventForKey(key);
  assert.equal(ev?.id, eventId);
  assert.equal(await O.overlayEventForKey('A'.repeat(32)), null);
  assert.equal(await O.overlayEventForKey('not a key'), null);
});

test('live: standings ranked, board marks the finished tile in the team colour', async () => {
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
  const st = await O.overlaySnapshot(ev, { view: 'standings', limit: 5 });
  assert.ok('rows' in st.body, JSON.stringify(st));
  assert.deepEqual(st.body.rows.map((r) => r.name), ['Red', 'Blue']);
  assert.equal(st.header.name, 'Stream Bingo');
  const bd = await O.overlaySnapshot(ev, { view: 'board', limit: 5 });
  assert.ok('cells' in bd.body, JSON.stringify(bd));
  assert.deepEqual(bd.body.cells.map((c) => c.done), [['#ff0000'], []]);
  const fd = await O.overlaySnapshot(ev, { view: 'feed', limit: 5 });
  assert.ok('items' in fd.body, JSON.stringify(fd));
  assert.equal(fd.body.items[0].text, 'Tile complete: Fire cape');
});

test('hidden standings stay hidden on stream: no ranks, no claims, no feed', async () => {
  await db.update(s.events).set({ rules: JSON.stringify({ standings: { visibility: 'at-end' } }) }).where(eq(s.events.id, eventId));
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
  // A fresh limit sidesteps the few-second memo of the previous test's snapshot.
  const st = await O.overlaySnapshot(ev, { view: 'standings', limit: 6 });
  assert.ok('notice' in st.body, JSON.stringify(st));
  assert.doesNotMatch(JSON.stringify(st), /Red|Blue/);
  const bd = await O.overlaySnapshot(ev, { view: 'board', limit: 6 });
  assert.ok('cells' in bd.body);
  assert.ok(bd.body.cells.every((c) => c.done.length === 0));
  const fd = await O.overlaySnapshot(ev, { view: 'feed', limit: 6 });
  assert.ok('notice' in fd.body);
  assert.doesNotMatch(JSON.stringify(fd), /Fire cape|Red/);
});

test('an unrevealed board shows no tiles on stream', async () => {
  await db.update(s.events).set({ tilesRevealed: 0, rules: null }).where(eq(s.events.id, eventId));
  const ev = (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!;
  const bd = await O.overlaySnapshot(ev, { view: 'board', limit: 7 });
  assert.deepEqual(bd.body, { notice: 'The board is not revealed yet' });
  const fd = await O.overlaySnapshot(ev, { view: 'feed', limit: 7 });
  assert.doesNotMatch(JSON.stringify(fd), /Fire cape|Twisted/);
  await db.update(s.events).set({ tilesRevealed: 1 }).where(eq(s.events.id, eventId));
  void tileB;
});

test('reset kills the old URL; turning it off kills every URL', async () => {
  const old = (await O.overlayKeyFor(eventId))!;
  const next = await O.rotateOverlayKey(eventId);
  assert.notEqual(old, next);
  assert.equal(await O.overlayEventForKey(old), null);
  assert.equal((await O.overlayEventForKey(next))?.id, eventId);
  await O.removeOverlayKey(eventId);
  assert.equal(await O.overlayEventForKey(next), null);
});

test('a suspended space\'s key opens nothing', async () => {
  const key = await O.rotateOverlayKey(eventId);
  await db.update(s.clans).set({ status: 'suspended' }).where(eq(s.clans.id, clanId));
  assert.equal(await O.overlayEventForKey(key), null);
  await db.update(s.clans).set({ status: 'active' }).where(eq(s.clans.id, clanId));
  assert.equal((await O.overlayEventForKey(key))?.id, eventId);
});

test('!join: the bot has no channels until a Twitch account is linked, even when switched on', async () => {
  await db.insert(s.settings).values({ clanId, key: 'creator_twitch_chat_join', value: 'on' });
  assert.equal(await B.chatJoinEnabled(clanId), true);
  // The typed Twitch link is NOT proof of a channel (linkedTwitchBroadcaster is the stub for linking).
  await db.insert(s.settings).values({ clanId, key: 'creator_twitch_url', value: 'https://twitch.tv/someoneelse' });
  assert.deepEqual(await B.chatBotChannels(), []);
  assert.equal(await B.joinReplyForBroadcaster('12345'), null);
});

test('!join points at the running event a stranger can see', async () => {
  const pick = await B.joinEventFor(clanId);
  // Both are running; the later start wins, ties to the newer event.
  assert.ok(pick);
  assert.ok([eventId, otherEventId].includes(pick.id));
  // A creator space's events live at /s/<slug>.
  assert.match(pick.url, /\/s\/streamer\/events\/\d+$/);
  // An invited-only event is never offered in a public chat.
  await db.update(s.events).set({ visibility: 'invited' }).where(eq(s.events.id, pick.id));
  const next = await B.joinEventFor(clanId);
  assert.ok(next && next.id !== pick.id);
  await db.update(s.events).set({ visibility: 'invited' }).where(eq(s.events.id, next.id));
  assert.equal(await B.joinEventFor(clanId), null);
});
