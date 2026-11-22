// Tile conditions against a real database: a raid tile is credited only from raid facts the site
// judged (POST /api/plugin/facts), and a plugin posting straight to the submissions route, with or
// without a screenshot, is refused. Also proves migration 0279 applies (tiles.conditions).
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/tile-conditions-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';

const DB = useTestDatabase('tile-conditions');
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const ids = {} as Record<string, number>;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// Nothing here talks to the network (Discord posts and the like are refused).
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch;

async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = { type: 'request', phase: 'render', headers: HeadersAdapter.seal(new Headers(req.headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers())) };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

const headers = () => ({ Authorization: 'Bearer tok-raider', 'X-RSN': 'Raider', 'X-Account-Hash': 'hash-Raider', 'X-Anvil-Plugin-Version': '1.17.2', ...clanHeaders('alpha'), 'Content-Type': 'application/json' });

async function facts(list: unknown[]) {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const req = new Request('https://example.test/api/plugin/facts', { method: 'POST', headers: headers(), body: JSON.stringify({ facts: list }) });
  const res = await inRequest(req, () => POST(req));
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as { credits: { t: number; ok?: boolean; have: number }[]; notes: string[] };
}

async function rawSubmit(body: Record<string, unknown>) {
  const { POST } = await import('../src/app/api/events/[eventId]/submissions/route.ts');
  const req = new Request(`https://example.test/api/events/${ids.event}/submissions`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  return inRequest(req, () => POST(req, { params: Promise.resolve({ eventId: String(ids.event) }) }));
}

async function rows(tileId: number) {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  return db.select().from(s.submissions).where(eq(s.submissions.tileId, tileId));
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const clanId = (await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha', status: 'active' }).returning())[0].id;
  const now = new Date().toISOString();
  ids.event = (await db.insert(s.events).values({ clanId, name: 'Board', boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1 }).returning())[0].id;
  ids.team = (await db.insert(s.teams).values({ eventId: ids.event, name: 'Team', color: '#fff' }).returning())[0].id;
  const person = (await db.insert(s.players).values({ displayName: 'Raider' }).returning())[0].id;
  await db.insert(s.users).values({ displayName: 'Raider', discordId: 'd-raider', pluginTokenHash: tokenHash('tok-raider'), playerId: person });
  const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: 'Raider', rsnNormalized: 'raider', accountHash: 'hash-Raider', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
  ids.player = (await db.insert(s.eventParticipants).values({ eventId: ids.event, clanMemberId: m.id, accountId: acct.id, name: 'Raider', teamId: ids.team }).returning())[0].id;
  const conditions = JSON.stringify({ v: 1, raids: [{ raid: 'cox', modes: ['normal'], under: 1800 }], noDeaths: true });
  ids.raid = (await db.insert(s.tiles).values({ eventId: ids.event, position: 0, label: 'Fast CoX', tileType: 'raid', requiredAmount: 2, conditions }).returning())[0].id;
});

after(async () => {
  await new Promise((r) => setTimeout(r, 300));
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a raw plugin ping to a raid tile is refused, with or without a screenshot', async () => {
  const ping = await rawSubmit({ tileId: ids.raid, teamId: ids.team, creditPlayerId: ids.player, amount: 1, note: 'x', imageUrl: null });
  assert.equal(ping.status, 403, await ping.clone().text());
  const shot = await rawSubmit({ tileId: ids.raid, teamId: ids.team, creditPlayerId: ids.player, amount: 1, note: 'x', imageUrl: 'https://example.test/x.jpg' });
  assert.notEqual(shot.status, 200);
  assert.equal((await rows(ids.raid)).length, 0);
});

test('a raid fact the site judges credits the tile; a refused one files nothing and says why', async () => {
  const good = await facts([{ k: 'raid', key: 'chambers of xeric', sec: 1700, deaths: 0, party: 2 }]);
  assert.equal(good.credits.find((c) => c.t === ids.raid)?.ok, true, JSON.stringify(good));
  assert.ok(good.notes.includes('Tile progress: Fast CoX (1/2)'), JSON.stringify(good.notes));
  assert.equal((await rows(ids.raid)).length, 1);

  const died = await facts([{ k: 'raid', key: 'chambers of xeric', sec: 1700, deaths: 1 }]);
  assert.deepEqual(died.credits, []);
  assert.ok(died.notes.includes('Not counted: Fast CoX: 1 death in the party.'), JSON.stringify(died.notes));
  assert.equal((await rows(ids.raid)).length, 1);
});
