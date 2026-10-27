// The plugin's live push end to end: migration 0149's triggers announce writes on NOTIFY
// 'anvil_push'; lib/push/views builds what moved ONCE (the team's share of the config route's own
// reading); push/server.ts sends that to every subscribed plugin over a ticketed WebSocket.
//
// Run: npx tsx --test tests/plugin-push-notify.test.ts   (needs the test Postgres, see helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import WebSocket from 'ws';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { internalSecret, signTicket, ticketKey } from '../src/lib/push/ticket.ts';

const DB = useTestDatabase('plugin-push-notify');
const PORT = 31_000 + Math.floor(Math.random() * 1_000);

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let views: typeof import('../src/lib/push/views.ts');
let enrolled: typeof import('../src/lib/pluginConfigEnrolled.ts');
let clanCtx: typeof import('../src/lib/clanContext.ts');
let listener: pg.Client;
let site: http.Server;
let server: ChildProcess;
const heard: { k: string; e: number; t: number | null; i: number | null; x?: number | null }[] = [];
let ids: { clan: number; event: number; red: number; blue: number; teamTile: number; soloTile: number; soloKill: number; me: number; mate: number };

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  views = await import('../src/lib/push/views.ts');
  enrolled = await import('../src/lib/pluginConfigEnrolled.ts');
  clanCtx = await import('../src/lib/clanContext.ts');
  listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  listener.on('notification', (n) => heard.push(JSON.parse(n.payload!)));
  await listener.query('LISTEN anvil_push');

  const [clan] = await db.insert(s.clans).values({ slug: 'push', name: 'Push Clan', inGameName: 'Push' }).returning();
  const [event] = await db.insert(s.events).values({ clanId: clan.id, name: 'Live Bingo', boardSize: 3, tilesRevealed: 1 }).returning();
  const [red] = await db.insert(s.teams).values({ eventId: event.id, name: 'Red', color: '#f00' }).returning();
  const [blue] = await db.insert(s.teams).values({ eventId: event.id, name: 'Blue', color: '#00f' }).returning();
  const [teamTile] = await db.insert(s.tiles).values({
    eventId: event.id, position: 0, label: 'Zulrah uniques', tileType: 'drop', trackedItemIds: '[12922,12932]', requiredAmount: 5,
  }).returning();
  const [soloTile] = await db.insert(s.tiles).values({
    eventId: event.id, position: 1, label: 'Solo scales', tileType: 'drop', trackedItemIds: '[12934]', requiredAmount: 3, trackingMode: 'solo',
  }).returning();
  const [soloKill] = await db.insert(s.tiles).values({
    eventId: event.id, position: 2, label: 'Solo Vorkath', tileType: 'kill', requiredAmount: 10, trackingMode: 'solo',
  }).returning();
  const [me] = await db.insert(s.eventParticipants).values({ eventId: event.id, teamId: red.id, name: 'Redman' }).returning();
  const [mate] = await db.insert(s.eventParticipants).values({ eventId: event.id, teamId: red.id, name: 'Redmate' }).returning();
  ids = { clan: clan.id, event: event.id, red: red.id, blue: blue.id, teamTile: teamTile.id, soloTile: soloTile.id, soloKill: soloKill.id, me: me.id, mate: mate.id };

  // The site, as far as the push server sees it: the internal view route, behind its secret.
  const secret = internalSecret('test-secret');
  site = http.createServer(async (req, res) => {
    const key = new URL(req.url ?? '/', 'http://site').searchParams.get('key') ?? '';
    const view = req.headers['x-push-secret'] === secret ? await views.pushView(key) : null;
    res.writeHead(view ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(view ?? { error: 'Not found' }));
  });
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));

  server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'push/server.ts'], {
    env: {
      ...process.env,
      PUSH_PORT: String(PORT),
      PLAYER_SESSION_SECRET: 'test-secret',
      SITE_INTERNAL_URL: `http://127.0.0.1:${(site.address() as AddressInfo).port}`,
      PUSH_MIN_GAP_MS: '200',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve) => server.stdout!.on('data', (d) => String(d).includes('push.db-listening') && resolve()));
});

after(async () => {
  server?.kill('SIGTERM');
  site?.close();
  await listener?.end();
  await pool.end();
  await dropDatabase(DB);
});

/** Wait for the listener to catch up, then take what it heard. */
async function drain(): Promise<typeof heard> {
  await new Promise((r) => setTimeout(r, 100));
  return heard.splice(0).map(({ x, ...rest }) => (x != null ? { ...rest, x } : rest));
}

test('a submission announces its event, team and tile', async () => {
  await drain();
  await db.insert(s.submissions).values({ tileId: ids.teamTile, teamId: ids.red, playerId: ids.me, amount: 2 });
  assert.deepEqual(await drain(), [{ k: 'submissions', e: ids.event, t: ids.red, i: ids.teamTile }]);
});

test('a tile edit is event-wide; an update that changes nothing is silent', async () => {
  await drain();
  await db.update(s.tiles).set({ label: 'Zulrah uniques!' }).where(eq(s.tiles.id, ids.teamTile));
  await db.update(s.tiles).set({ label: 'Zulrah uniques!' }).where(eq(s.tiles.id, ids.teamTile));
  assert.deepEqual(await drain(), [{ k: 'tiles', e: ids.event, t: null, i: null }]);
});

test("a participant's stats refresh speaks to their team only; bookkeeping columns stay quiet", async () => {
  await drain();
  await db.update(s.eventParticipants).set({ cachedStats: '{"zulrah":5}' }).where(eq(s.eventParticipants.id, ids.mate));
  await db.update(s.eventParticipants).set({ lastStatsFetch: new Date().toISOString() }).where(eq(s.eventParticipants.id, ids.mate));
  assert.deepEqual(await drain(), [{ k: 'event_participants', e: ids.event, t: ids.red, i: null }]);
});

test('leaving a team names it (x) so its listeners re-ticket; a pick from the pool names none', async () => {
  const [temp] = await db.insert(s.eventParticipants).values({ eventId: ids.event, name: 'Mover' }).returning();
  await drain();
  await db.update(s.eventParticipants).set({ teamId: ids.blue }).where(eq(s.eventParticipants.id, temp.id));
  await db.update(s.eventParticipants).set({ teamId: ids.red }).where(eq(s.eventParticipants.id, temp.id));
  await db.delete(s.eventParticipants).where(eq(s.eventParticipants.id, temp.id));
  assert.deepEqual(await drain(), [
    { k: 'event_participants', e: ids.event, t: null, i: null },
    { k: 'event_participants', e: ids.event, t: null, i: null, x: ids.blue },
    { k: 'event_participants', e: ids.event, t: null, i: null, x: ids.red },
  ]);
});

test("the team view plus my own numbers is exactly my config's progress", async () => {
  await db.insert(s.submissions).values([
    { tileId: ids.teamTile, teamId: ids.red, playerId: ids.mate, amount: 1 },
    { tileId: ids.soloTile, teamId: ids.red, playerId: ids.me, amount: 1 },
    { tileId: ids.soloTile, teamId: ids.red, playerId: ids.mate, amount: 2 },
    { tileId: ids.soloKill, teamId: ids.red, playerId: ids.me, amount: 4 },
    { tileId: ids.soloKill, teamId: ids.red, playerId: ids.mate, amount: 7 },
  ]);
  const view = (await views.pushView(`team:${ids.event}:${ids.red}`)) as {
    config: {
      trackedDrops: { tileId: number; currentAmount: number }[];
      trackedKills: { tileId: number; currentAmount: number }[];
      panel?: unknown;
      codeword?: unknown;
    };
    board?: unknown;
    at: string;
    members: Record<number, { c: Record<number, number> }>;
  };
  const amounts = (rows: { tileId: number; currentAmount: number }[]) => Object.fromEntries(rows.map((d) => [d.tileId, d.currentAmount]));
  // A drop pool reads the team's total even on Solo; a Solo kill tile is each member's own count.
  assert.deepEqual(amounts(view.config.trackedDrops), { [ids.teamTile]: 3, [ids.soloTile]: 3 });
  assert.deepEqual(amounts(view.config.trackedKills), { [ids.soloKill]: 0 }, 'left to each member');
  assert.deepEqual(view.members[ids.me].c, { [ids.soloKill]: 4 });
  assert.deepEqual(view.members[ids.mate].c, { [ids.soloKill]: 7 });
  assert.equal(view.config.codeword, undefined, 'nothing of one caller rides a team view');
  assert.equal(view.board, undefined, 'no board: the panel is a site view, fetched when this arrives');
  assert.equal(view.config.panel, undefined);
  assert.ok(view.at, 'stamped, so a rebuild always goes out');

  // What the plugin does with it: its own numbers over the team's, then compared with its own config.
  const overlay = (rows: { tileId: number; currentAmount: number }[]) =>
    rows.map((r) => ({ ...r, currentAmount: view.members[ids.me].c[r.tileId] ?? r.currentAmount }));
  const clan = (await clanCtx.resolveClanById(ids.clan))!;
  const own = await enrolled.buildEnrolledConfig({
    eventId: ids.event,
    teamId: ids.red,
    clan,
    viewer: { playerId: ids.me, userId: null, rsn: 'Redman', request: new Request('http://site/api/plugin/config') },
  });
  assert.ok(own.ok);
  const body = own.body as unknown as typeof view.config;
  assert.deepEqual(amounts(overlay(view.config.trackedDrops)), amounts(body.trackedDrops));
  assert.deepEqual(amounts(overlay(view.config.trackedKills)), amounts(body.trackedKills));
});

test('the push server sends my team its view, then the new one when a teammate scores', async () => {
  const url = `ws://127.0.0.1:${PORT}/api/plugin/push/ws`;
  const refused = await new Promise<number>((resolve) => {
    const ws = new WebSocket(url);
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    ws.on('open', () => resolve(101));
  });
  assert.equal(refused, 401);

  const connect = (teamId: number) => {
    const { ticket } = signTicket({ userId: 1, eventIds: [ids.event], teamId }, ticketKey('test-secret'), Date.now());
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${ticket}` } });
    const got: { t: string; teamId?: number; tileId?: number; config?: { trackedDrops: { tileId: number; currentAmount: number }[] } }[] = [];
    ws.on('message', (m) => got.push(JSON.parse(String(m))));
    return { ws, got };
  };
  const red = connect(ids.red);
  const blue = connect(ids.blue);
  await waitFor(() => red.got.length >= 2 && blue.got.length >= 2);
  assert.deepEqual(red.got.map((m) => m.t), ['hello', 'team']);
  assert.equal(red.got[1].teamId, ids.red);
  assert.equal(blue.got[1].teamId, ids.blue);
  const teamTile = (m: (typeof red.got)[number]) => m.config!.trackedDrops.find((d) => d.tileId === ids.teamTile)!.currentAmount;
  assert.equal(teamTile(red.got[1]), 3);

  await db.insert(s.submissions).values({ tileId: ids.teamTile, teamId: ids.red, playerId: ids.mate, amount: 1 });
  await waitFor(() => red.got.some((m) => m.t === 'team' && teamTile(m) === 4) && blue.got.some((m) => m.t === 'tile'));
  assert.ok(red.got.some((m) => m.t === 'tile' && m.tileId === ids.teamTile), 'the tracker moves too');
  assert.equal(blue.got.filter((m) => m.t === 'team').length, 1, "the other team's view didn't change, so it wasn't resent");
  red.ws.close();
  blue.ws.close();
});

async function waitFor(ok: () => boolean, ms = 5_000) {
  const until = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
