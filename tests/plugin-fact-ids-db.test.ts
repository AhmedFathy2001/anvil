// Fact ids (lib/pluginFacts/factIds, factIdStore): a plugin fact may carry `id`, and one that is sent
// again (the first send may or may not have landed) is answered as accepted and credited once.
// Remembered per person and character in feed_items, in the same transaction as the credit; a fact
// sent back under `retry` keeps its id and is not remembered; no id behaves as before.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/plugin-fact-ids-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';

// Next's request storage wants the runtime's AsyncLocalStorage on globalThis (the server sets it).
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

const DB = useTestDatabase('fact-ids');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const ids = {} as Record<string, number>;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// The routes read cookies()/headers(); outside Next there is no request scope, so run in a bare one
// (as tests/proof-after-db.test.ts does): no cookies, the request's own headers.
async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = { type: 'request', phase: 'render', headers: HeadersAdapter.seal(new Headers(req.headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers())) };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

type Who = { tok: string; rsn: string };
const ONE: Who = { tok: 'tok-one', rsn: 'Factone' };
const TWO: Who = { tok: 'tok-two', rsn: 'Facttwo' };
type Reply = {
  credits: { t: number; ok?: boolean; have?: number; error?: string }[];
  retry?: { id?: string; done?: number[] }[];
  duplicates?: number;
  proofKey?: string;
};

async function send(who: Who, facts: unknown[], extra: Record<string, unknown> = {}): Promise<Reply> {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const req = new Request('https://example.test/api/plugin/facts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${who.tok}`, 'X-RSN': who.rsn, 'X-Account-Hash': `hash-${who.rsn}`, ...clanHeaders('alpha'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts, ...extra }),
  });
  const res = await inRequest(req, () => POST(req));
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as Reply;
}

const kill = (npc: string, id?: unknown) => ({ k: 'kill', n: { [npc]: 1 }, ...(id === undefined ? {} : { id }) });

async function rows(tileId: number) {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  return db.select().from(s.submissions).where(eq(s.submissions.tileId, tileId));
}

async function keys() {
  const { db, schema: s } = await loadDb();
  return (await db.select().from(s.feedItems)).map((r) => r.dedupKey).sort();
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
  const seat = async (who: Who) => {
    const person = (await db.insert(s.players).values({ displayName: who.rsn }).returning())[0].id;
    const [user] = await db.insert(s.users).values({ displayName: who.rsn, discordId: `d-${who.rsn}`, pluginTokenHash: tokenHash(who.tok), playerId: person }).returning();
    const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: who.rsn, rsnNormalized: who.rsn.toLowerCase(), accountHash: `hash-${who.rsn}`, claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
    await db.insert(s.eventParticipants).values({ eventId: ids.event, clanMemberId: m.id, accountId: acct.id, name: who.rsn, teamId: ids.team });
    return user.id;
  };
  ids.userOne = await seat(ONE);
  ids.userTwo = await seat(TWO);
  const killTile = async (position: number, npc: string) =>
    (await db.insert(s.tiles).values({ eventId: ids.event, position, label: npc, tileType: 'kill', targetNpcs: `["${npc}"]`, requiredAmount: 50 }).returning())[0].id;
  ids.zulrah = await killTile(1, 'Zulrah');
  ids.vorkath = await killTile(2, 'Vorkath');
  ids.kraken = await killTile(3, 'Kraken');
  ids.hydra = await killTile(4, 'Hydra');
  ids.cerberus = await killTile(5, 'Cerberus');
  ids.whip = (await db.insert(s.tiles).values({ eventId: ids.event, position: 6, label: 'Whip', tileType: 'drop', trackedItemIds: '[4151]', requiredAmount: 1 }).returning())[0].id;
});

after(async () => {
  await new Promise((r) => setTimeout(r, 300)); // let the after-reply work settle
  await pool.end();
  await dropDatabase(DB);
});

test('the same id twice credits once; the second is answered as accepted, never under retry', async () => {
  const id = '4f3a-41c2-9b1e-0a1b2c3d4e5f';
  const first = await send(ONE, [kill('Zulrah', id)]);
  assert.equal(first.credits[0]?.t, ids.zulrah);
  assert.equal(first.credits[0]?.ok, true);
  assert.equal(first.retry, undefined);
  assert.equal(first.duplicates, undefined);
  assert.equal((await rows(ids.zulrah)).length, 1);
  // Both keys are stored: the credit's (with its row) and the fact's (answered for good).
  assert.deepEqual(await keys(), [`fact:${ids.userOne}:${id}`, `fact:${ids.userOne}:${id}:${ids.zulrah}`]);

  const second = await send(ONE, [kill('Zulrah', id)]);
  assert.equal(second.retry, undefined, 'not sent back: the plugin clears it');
  assert.equal(second.duplicates, 1);
  assert.deepEqual(second.credits, []);
  assert.equal((await rows(ids.zulrah)).length, 1, 'credited once');
});

test('the same id from a different account is independent', async () => {
  const reply = await send(TWO, [kill('Zulrah', '4f3a-41c2-9b1e-0a1b2c3d4e5f')]);
  assert.equal(reply.credits[0]?.ok, true);
  assert.equal(reply.duplicates, undefined);
  assert.equal((await rows(ids.zulrah)).length, 2, 'one each');
});

test('no id, or a malformed one, behaves as before: every send credits', async () => {
  await send(ONE, [kill('Vorkath')]);
  await send(ONE, [kill('Vorkath')]);
  const a = await send(ONE, [kill('Vorkath', 'bad id!')]);
  const b = await send(ONE, [kill('Vorkath', 'bad id!')]);
  assert.equal(a.credits[0]?.ok, true);
  assert.equal(b.credits[0]?.ok, true, 'never a refused batch');
  assert.equal(b.duplicates, undefined);
  assert.equal((await rows(ids.vorkath)).length, 4);
});

test('a fact sent back under retry keeps its id, is not remembered, and credits when sent again', async () => {
  // Past the per-request cap (50) a fact is not looked at: it comes back under `retry`.
  const id = 'retry-me-0001';
  const filler = Array.from({ length: 50 }, () => kill('Nothing Here'));
  const first = await send(ONE, [...filler, kill('Kraken', id)]);
  assert.deepEqual(first.retry?.map((f) => f.id), [id], 'the id is echoed unchanged');
  assert.equal((await rows(ids.kraken)).length, 0);
  assert.ok(!(await keys()).some((k) => k.includes(id)), 'a retried fact is not recorded');

  const second = await send(ONE, first.retry!);
  assert.equal(second.credits[0]?.t, ids.kraken);
  assert.equal(second.credits[0]?.ok, true);
  assert.equal(second.duplicates, undefined);
  assert.equal((await rows(ids.kraken)).length, 1);
  const third = await send(ONE, first.retry!);
  assert.equal(third.duplicates, 1);
  assert.equal((await rows(ids.kraken)).length, 1);
});

test('the credit\'s own id guards alone: with the "answered" key lost, a re-send still credits once and reads as accepted', async () => {
  // A request that died after the credit but before the fact was marked answered leaves only the
  // per-tile key, which was written in the credit's transaction.
  const id = 'crashed-midway-01';
  await send(ONE, [kill('Hydra', id)]);
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await db.delete(s.feedItems).where(eq(s.feedItems.dedupKey, `fact:${ids.userOne}:${id}`));

  const again = await send(ONE, [kill('Hydra', id)]);
  assert.equal(again.retry, undefined);
  assert.equal(again.duplicates, 1);
  assert.equal(again.credits[0]?.ok, true, 'reads as accepted');
  assert.equal(again.credits[0]?.have, 1, 'the count is not bumped a second time');
  assert.equal((await rows(ids.hydra)).length, 1);
  assert.ok((await keys()).includes(`fact:${ids.userOne}:${id}`), 'and is marked answered now');
});

test('several kills folded into one credit, one of them already in: only the new one is credited', async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await send(ONE, [kill('Hydra', 'folded-old-0001')]);
  await db.delete(s.feedItems).where(eq(s.feedItems.dedupKey, `fact:${ids.userOne}:folded-old-0001`));
  const before = (await rows(ids.hydra)).reduce((n, r) => n + r.amount, 0);

  const mixed = await send(ONE, [kill('Hydra', 'folded-old-0001'), kill('Hydra', 'folded-new-0002')]);
  // Nothing filed: both come back, the old one marked done on the tile.
  assert.deepEqual(mixed.retry?.map((f) => [f.id, f.done]), [['folded-old-0001', [ids.hydra]], ['folded-new-0002', undefined]]);
  assert.equal((await rows(ids.hydra)).reduce((n, r) => n + r.amount, 0), before);

  const resent = await send(ONE, mixed.retry!);
  assert.equal(resent.retry, undefined);
  assert.equal((await rows(ids.hydra)).reduce((n, r) => n + r.amount, 0), before + 1, 'the new kill only');
});

test('two requests with the same id at once: one credit, both answered as accepted', async () => {
  const id = 'both-at-once-0001';
  const [a, b] = await Promise.all([send(ONE, [kill('Cerberus', id)]), send(ONE, [kill('Cerberus', id)])]);
  assert.equal(a.retry, undefined);
  assert.equal(b.retry, undefined);
  assert.equal((await rows(ids.cerberus)).length, 1, 'credited exactly once');
  for (const r of [a, b]) for (const c of r.credits) assert.equal(c.ok, true);
  assert.equal((a.duplicates ?? 0) + (b.duplicates ?? 0), 1, 'exactly one of them was the repeat');
});

test('a screenshot fact (proofPending) carries an id too: sent twice, one waiting credit', async () => {
  const fact = { k: 'loot', src: 'Abyssal demon', kind: 'npc', items: [[4151, 1]], id: 'proof-fact-0001' };
  const first = await send(ONE, [fact], { proofPending: true, proof: { tz: 'UTC', capturedAt: Date.now(), tick: 7, chat: [] } });
  assert.ok(first.proofKey);
  assert.equal((await rows(ids.whip)).length, 1);
  const second = await send(ONE, [fact], { proofPending: true, proof: { tz: 'UTC', capturedAt: Date.now(), tick: 7, chat: [] } });
  assert.equal(second.retry, undefined);
  assert.equal(second.duplicates, 1);
  assert.equal(second.proofKey, undefined, 'no new key: the first reply named the one the picture goes under');
  assert.equal((await rows(ids.whip)).length, 1);
});
