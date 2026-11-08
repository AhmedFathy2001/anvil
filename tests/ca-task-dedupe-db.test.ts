// A combat task (or a finished clog page's proof) counts once per tile, judged by the site off LIVE rows (the plugin no longer remembers
// it per session): the same task again is refused "already counted for this tile", deleting its proof
// frees it, and two different tasks both count toward an "any N Elite tasks" tile.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/ca-task-dedupe-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('cadedupe');
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const ids = {} as Record<string, number>;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
// Nothing here talks to the outside (Discord posts and the like are answered with a 404).
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

async function task(what: string, fact: Record<string, unknown> = { t: ids.tile, tier: 'Elite' }) {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const req = new Request('https://example.test/api/plugin/facts', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok-ca', 'X-RSN': 'Tasker', 'X-Account-Hash': 'hash-Tasker', 'x-anvil-clan-slug': 'alpha', 'Content-Type': 'application/json' },
    // As the plugin sends it: credit first, the screenshot after (lib/proofAfter).
    body: JSON.stringify({ facts: [{ k: 'tile', n: 1, what, ...fact }], proofPending: true, proof: { tz: 'UTC', capturedAt: Date.now(), tick: 1 } }),
  });
  const res = await inRequest(req, () => POST(req));
  assert.equal(res.status, 200, await res.clone().text());
  const reply = (await res.json()) as { credits: { t: number; ok?: boolean; error?: string; have: number }[] };
  return reply.credits.find((c) => c.t === fact.t)!;
}

async function rows(tileId = ids.tile) {
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
  const person = (await db.insert(s.players).values({ displayName: 'Tasker' }).returning())[0].id;
  await db.insert(s.users).values({ displayName: 'Tasker', discordId: 'd-Tasker', pluginTokenHash: tokenHash('tok-ca'), playerId: person });
  const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: 'Tasker', rsnNormalized: 'tasker', accountHash: 'hash-Tasker', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' }).returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ids.event, clanMemberId: m.id, accountId: acct.id, name: 'Tasker', teamId: ids.team });
  ids.tile = (await db.insert(s.tiles).values({ eventId: ids.event, position: 1, label: 'Any 3 Elite tasks', tileType: 'ca', targetNpcs: '["Any Elite"]', requiredAmount: 3 }).returning())[0].id;
  ids.page = (await db.insert(s.tiles).values({ eventId: ids.event, position: 2, label: 'Finish Zulrah', tileType: 'clog', countMode: 'complete', targetNpcs: '["Zulrah"]', requiredAmount: 1 }).returning())[0].id;
});

after(async () => {
  await new Promise((r) => setTimeout(r, 300)); // let the after-reply work settle
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a combat task counts once on a tile; a deleted proof frees it; different tasks both count', async () => {
  const first = await task('Whack-a-Mole');
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal((await rows()).length, 1);

  // "Repeat completion" re-fires the same task: refused, with a reason the plugin can say.
  const again = await task('Whack-a-Mole');
  assert.equal(again.ok, false);
  assert.equal(again.error, 'already counted for this tile');
  assert.equal(again.have, 1, 'the refused credit never counted');
  assert.equal((await rows()).length, 1);

  // A staff member deletes the proof: the task is free again, no relog needed.
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await db.delete(s.submissions).where(eq(s.submissions.id, (await rows())[0].id));
  const back = await task('Whack-a-Mole');
  assert.equal(back.ok, true, JSON.stringify(back));

  // A different task is a different credit (the name is keyed like the plugin's: case and punctuation fold).
  const other = await task('Hard Hitter');
  assert.equal(other.ok, true, JSON.stringify(other));
  assert.equal((await task('whack a mole')).ok, false);
  assert.equal((await rows()).length, 2);
});

test('a finished-page proof from the plugin is taken once while it is live', async () => {
  const page = { t: ids.page, pg: true };
  assert.equal((await task('Zulrah', page)).ok, true);
  // Opening the finished page again: the tile reads one proof per member, so a second is refused.
  const again = await task('Zulrah', page);
  assert.equal(again.ok, false);
  assert.equal(again.error, 'already counted for this tile');
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await db.delete(s.submissions).where(eq(s.submissions.tileId, ids.page));
  assert.equal((await task('Zulrah', page)).ok, true, 'a deleted proof can be taken again');
  assert.equal((await rows(ids.page)).length, 1);
});
