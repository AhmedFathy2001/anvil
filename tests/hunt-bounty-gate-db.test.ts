// A bounty spends the clan's money, so only a treasurer or admin may set one, change one, or make a
// bounty hunt repeat: the admin weekly routes, called as a moderator and as a treasurer, against a
// real database.
//
// Run: TESTS_OK=1 npx tsx --test tests/hunt-bounty-gate-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { clanHeaders } from './helpers/clanHeader.ts';
import { paysMoney } from '../src/lib/weeklyPrizes.ts';

const DB = useTestDatabase('hunt-bounty-gate');
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

const M = 1_000_000;
const HOUR = 3_600_000;
const users: Record<string, number> = {};

/** An admin_session cookie as the login would set it (lib/auth sign). */
function session(userId: number): string {
  const payload = JSON.stringify({ userId, iat: Date.now(), sessionVersion: 0 });
  const sig = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret').update(payload).digest('hex');
  return `admin_session=${Buffer.from(payload).toString('base64')}.${sig}`;
}

async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = {
    type: 'request',
    phase: 'render',
    headers: HeadersAdapter.seal(new Headers(req.headers)),
    cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers({ cookie: req.headers.get('cookie') ?? '' }))),
  };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

const huntBody = (bounty?: number[]) => ({
  v: 2,
  rule: 'first',
  items: [{ id: 4151, name: 'Abyssal whip', anySource: true, ...(bounty ? { bounty } : {}) }],
  ends: { kind: 'date' },
  confirm: 'staff',
});

async function create(as: string, bounty?: number[]) {
  const { POST } = await import('../src/app/api/admin/weekly/route.ts');
  const req = new Request('https://example.test/api/admin/weekly', {
    method: 'POST',
    headers: { cookie: session(users[as]), 'Content-Type': 'application/json', ...clanHeaders('gate') },
    body: JSON.stringify({
      type: 'hunt',
      title: 'Whip hunt',
      startDate: new Date(Date.now() + 24 * HOUR).toISOString(),
      endDate: new Date(Date.now() + 96 * HOUR).toISOString(),
      hunt: huntBody(bounty),
    }),
  });
  return inRequest(req, () => POST(req));
}

async function put(as: string, id: number, body: Record<string, unknown>) {
  const { PUT } = await import('../src/app/api/admin/weekly/[id]/route.ts');
  const req = new Request(`https://example.test/api/admin/weekly/${id}`, {
    method: 'PUT',
    headers: { cookie: session(users[as]), 'Content-Type': 'application/json', ...clanHeaders('gate') },
    body: JSON.stringify(body),
  });
  return inRequest(req, () => PUT(req, { params: Promise.resolve({ id: String(id) }) }));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'gate', name: 'Gate', status: 'active' }).returning();
  for (const role of ['moderator', 'treasurer']) {
    const [p] = await db.insert(s.players).values({ displayName: role }).returning();
    const [u] = await db.insert(s.users).values({ displayName: role, discordId: `d-${role}`, playerId: p.id }).returning();
    await db.insert(s.clanStaff).values({ clanId: clan.id, userId: u.id, role });
    users[role] = u.id;
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('prizes or a bounty both count as paying money', () => {
  assert.equal(paysMoney({ prizes: null, type: 'hunt', hunt: JSON.stringify(huntBody()) }), false);
  assert.equal(paysMoney({ prizes: '{"places":[{"gp":1000000}]}', type: 'skill', hunt: null }), true);
  assert.equal(paysMoney({ prizes: null, type: 'hunt', hunt: JSON.stringify(huntBody([5 * M])) }), true);
});

let plainId = 0;
let bountyId = 0;

test('a moderator cannot create a hunt with a bounty; a treasurer can', async () => {
  const refused = await create('moderator', [5 * M]);
  assert.equal(refused.status, 403, await refused.clone().text());
  const plain = await create('moderator');
  assert.equal(plain.status, 200, await plain.clone().text());
  plainId = ((await plain.json()) as { id: number }).id;
  const paid = await create('treasurer', [5 * M]);
  assert.equal(paid.status, 200, await paid.clone().text());
  bountyId = ((await paid.json()) as { id: number }).id;
});

test('a moderator cannot add, change or remove a bounty, but may edit the rest of the hunt', async () => {
  const add = await put('moderator', plainId, { target: { hunt: huntBody([5 * M]) } });
  assert.equal(add.status, 400);
  assert.match(((await add.json()) as { error: string }).error, /treasurer or admin/);
  const change = await put('moderator', bountyId, { target: { hunt: huntBody([9 * M]) } });
  assert.equal(change.status, 400);
  const remove = await put('moderator', bountyId, { target: { hunt: huntBody() } });
  assert.equal(remove.status, 400);
  // The same bounty, untouched, with the rest edited: fine.
  const same = await put('moderator', bountyId, { target: { hunt: { ...huntBody([5 * M]), rule: 'most' } } });
  assert.equal(same.status, 200, await same.clone().text());
  const [row] = await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, bountyId));
  assert.deepEqual((JSON.parse(row.hunt ?? '{}') as { items: { bounty?: number[] }[] }).items[0].bounty, [5 * M]);

  const byTreasurer = await put('treasurer', bountyId, { target: { hunt: huntBody([9 * M]) } });
  assert.equal(byTreasurer.status, 200, await byTreasurer.clone().text());
});

test('a moderator cannot make a bounty hunt repeat; a prize-free one they can', async () => {
  const refused = await put('moderator', bountyId, { repeat: {} });
  assert.equal(refused.status, 403, await refused.clone().text());
  assert.match(((await refused.json()) as { error: string }).error, /prizes or bounties/);
  const plain = await put('moderator', plainId, { repeat: {} });
  assert.equal(plain.status, 200, await plain.clone().text());
  const byTreasurer = await put('treasurer', bountyId, { repeat: {} });
  assert.equal(byTreasurer.status, 200, await byTreasurer.clone().text());
});
