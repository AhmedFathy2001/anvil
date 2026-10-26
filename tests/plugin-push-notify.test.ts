// The plugin's live push end to end: migration 0149's triggers announce writes on NOTIFY
// 'anvil_push', and push/server.ts turns them into messages on a ticketed WebSocket.
//
// Run: npx tsx --test tests/plugin-push-notify.test.ts   (needs the test Postgres, see helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import WebSocket from 'ws';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { signTicket, ticketKey } from '../src/lib/push/ticket.ts';

const DB = useTestDatabase('plugin-push-notify');
const PORT = 31_000 + Math.floor(Math.random() * 1_000);

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let listener: pg.Client;
let server: ChildProcess;
const heard: { k: string; e: number; t: number | null; i: number | null }[] = [];
let ids: { event: number; red: number; blue: number; tile: number; seat: number };

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  listener.on('notification', (n) => heard.push(JSON.parse(n.payload!)));
  await listener.query('LISTEN anvil_push');

  const [clan] = await db.insert(s.clans).values({ slug: 'push', name: 'Push Clan', inGameName: 'Push' }).returning();
  const [event] = await db.insert(s.events).values({ clanId: clan.id, name: 'Live Bingo', boardSize: 3 }).returning();
  const [red] = await db.insert(s.teams).values({ eventId: event.id, name: 'Red', color: '#f00' }).returning();
  const [blue] = await db.insert(s.teams).values({ eventId: event.id, name: 'Blue', color: '#00f' }).returning();
  const [tile] = await db.insert(s.tiles).values({ eventId: event.id, position: 0, label: 'Zulrah' }).returning();
  const [seat] = await db.insert(s.eventParticipants).values({ eventId: event.id, teamId: red.id, name: 'Redman' }).returning();
  ids = { event: event.id, red: red.id, blue: blue.id, tile: tile.id, seat: seat.id };

  server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'push/server.ts'], {
    env: { ...process.env, PUSH_PORT: String(PORT), PLAYER_SESSION_SECRET: 'test-secret', PUSH_MIN_GAP_MS: '200', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve) => server.stdout!.on('data', (d) => String(d).includes('push.db-listening') && resolve()));
});

after(async () => {
  server?.kill('SIGTERM');
  await listener?.end();
  await pool.end();
  await dropDatabase(DB);
});

/** Wait for the listener to catch up, then take what it heard. */
async function drain(): Promise<typeof heard> {
  await new Promise((r) => setTimeout(r, 100));
  return heard.splice(0);
}

test('a submission announces its event, team and tile', async () => {
  await drain();
  await db.insert(s.submissions).values({ tileId: ids.tile, teamId: ids.red, amount: 1 });
  assert.deepEqual(await drain(), [{ k: 'submissions', e: ids.event, t: ids.red, i: ids.tile }]);
});

test('a tile edit is event-wide; an update that changes nothing is silent', async () => {
  await drain();
  await db.update(s.tiles).set({ label: 'Zulrah uniques' }).where(eq(s.tiles.id, ids.tile));
  await db.update(s.tiles).set({ label: 'Zulrah uniques' }).where(eq(s.tiles.id, ids.tile));
  assert.deepEqual(await drain(), [{ k: 'tiles', e: ids.event, t: null, i: null }]);
});

test("a participant's stats refresh speaks to their team only; bookkeeping columns stay quiet", async () => {
  await drain();
  await db.update(s.eventParticipants).set({ cachedStats: '{"zulrah":5}' }).where(eq(s.eventParticipants.id, ids.seat));
  await db.update(s.eventParticipants).set({ lastStatsFetch: new Date().toISOString() }).where(eq(s.eventParticipants.id, ids.seat));
  assert.deepEqual(await drain(), [{ k: 'event_participants', e: ids.event, t: ids.red, i: null }]);
  await db.update(s.eventParticipants).set({ teamId: ids.blue }).where(eq(s.eventParticipants.id, ids.seat));
  assert.deepEqual(await drain(), [{ k: 'event_participants', e: ids.event, t: null, i: null }], 'a team move is event-wide');
});

test('the push server tells a ticketed plugin what to refetch, and refuses one without a ticket', async () => {
  const url = `ws://127.0.0.1:${PORT}/api/plugin/push/ws`;
  const refused = await new Promise<number>((resolve) => {
    const ws = new WebSocket(url);
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    ws.on('open', () => resolve(101));
  });
  assert.equal(refused, 401);

  const { ticket } = signTicket({ userId: 1, eventIds: [ids.event], teamId: ids.blue }, ticketKey('test-secret'), Date.now());
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${ticket}` } });
  const got: unknown[] = [];
  ws.on('message', (m) => got.push(JSON.parse(String(m))));
  await new Promise((r) => ws.on('open', r));
  await waitFor(() => got.length >= 1);
  assert.deepEqual(got[0], { t: 'hello' });

  await db.insert(s.submissions).values({ tileId: ids.tile, teamId: ids.blue, amount: 1 });
  await waitFor(() => got.length >= 2);
  assert.deepEqual(got[1], { t: 'changed', config: true, board: true, tiles: [ids.tile] });

  // Another team's drop: the board moves, my config doesn't.
  await db.insert(s.submissions).values({ tileId: ids.tile, teamId: ids.red, amount: 1 });
  await waitFor(() => got.length >= 3);
  assert.deepEqual(got[2], { t: 'changed', board: true, tiles: [ids.tile] });
  ws.close();
});

async function waitFor(ok: () => boolean, ms = 3_000) {
  const until = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
