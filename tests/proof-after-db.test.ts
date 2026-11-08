// Credit first, proof after (lib/proofAfter, lib/proofFinish): a plugin credit filed with no image and
// `proofPending: true` counts at once and names a key; the screenshot attaches under that key (and only
// for the character that filed it); a credit still waiting past its minute is reversed and its key
// answers 410. Storage is the S3 driver against a stubbed fetch, so no bucket is needed.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/proof-after-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import https from 'node:https';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('proofafter');
// Next's request storage wants the runtime's AsyncLocalStorage on globalThis (the server sets it).
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const ids = {} as Record<string, number>;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// The media store: PUTs (node:https, lib/storage) are kept, GETs (fetch) answered from them, anything
// else (Discord) refused.
const stored = new Map<string, Buffer>();
const realRequest = https.request;
(https as { request: unknown }).request = (opts: { hostname: string; path: string }, done: (res: EventEmitter & { statusCode: number }) => void) => {
  const req = new EventEmitter() as EventEmitter & { end: (b: Buffer) => void };
  req.end = (b: Buffer) => {
    stored.set(`http://localhost:9000${opts.path}`, Buffer.from(b));
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    done(res);
    setImmediate(() => res.emit('end'));
  };
  return req;
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = req.url.split('?')[0];
  if (url.startsWith('http://localhost:9000/')) {
    if (req.method === 'PUT') {
      stored.set(url, Buffer.from(await req.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    const bytes = stored.get(url);
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response(null, { status: 404 });
  }
  return new Response('{}', { status: 404 });
}) as typeof fetch;

// The routes read cookies()/headers() (web sessions); outside Next there is no request scope, so each
// call runs inside a bare one: no cookies, the request's own headers.
async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = { type: 'request', phase: 'render', headers: HeadersAdapter.seal(new Headers(req.headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers())) };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

const headers = (tok = 'tok-pa', rsn = 'Proofer') => ({ Authorization: `Bearer ${tok}`, 'X-RSN': rsn, 'X-Account-Hash': `hash-${rsn}`, 'x-anvil-clan-slug': 'alpha' });

async function credit(item: number, extra: Record<string, unknown> = { proofPending: true }) {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const req = new Request('https://example.test/api/plugin/facts', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts: [{ k: 'loot', src: 'Zulrah', kind: 'npc', items: [[item, 1]] }], proof: { tz: 'UTC', capturedAt: Date.now(), tick: 7, chat: [{ tick: 7, type: 'GAMEMESSAGE', text: 'Valuable drop: Abyssal whip (1,500,000 coins)' }, { tick: 7, type: 'PUBLICCHAT', text: 'my secret' }, { tick: 7, type: 'PRIVATECHATIN', text: 'dm text' }] }, ...extra }),
  });
  const res = await inRequest(req, () => POST(req));
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()) as { credits: { t: number; ok?: boolean; completed?: boolean }[]; proofKey?: string; proofFor?: string[]; retry?: unknown };
}

let jpeg: Buffer;
async function upload(key: string, h = headers()) {
  const { POST } = await import('../src/app/api/plugin/facts/proof/route.ts');
  const form = new FormData();
  form.append('key', key);
  form.append('body', JSON.stringify({ proof: { split: 0.5 } }));
  form.append('file', new File([new Uint8Array(jpeg)], 'proof.jpg', { type: 'image/jpeg' }));
  const req = new Request('https://example.test/api/plugin/facts/proof', { method: 'POST', headers: h, body: form });
  return inRequest(req, () => POST(req));
}

async function rows(tileId: number) {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  return db.select().from(s.submissions).where(eq(s.submissions.tileId, tileId));
}

async function completed(tileId: number) {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  return (await db.select().from(s.completions).where(eq(s.completions.tileId, tileId))).length > 0;
}

async function expire(tileId: number) {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await db.update(s.submissions).set({ proofDueAt: new Date(Date.now() - 1000).toISOString() }).where(eq(s.submissions.tileId, tileId));
}

before(async () => {
  jpeg = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#335' } }).jpeg().toBuffer();
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const clanId = (await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha', status: 'active' }).returning())[0].id;
  const now = new Date().toISOString();
  const seat = async (name: string, tok: string, teamId: number, eventId: number) => {
    const person = (await db.insert(s.players).values({ displayName: name }).returning())[0].id;
    await db.insert(s.users).values({ displayName: name, discordId: `d-${name}`, pluginTokenHash: tokenHash(tok), playerId: person });
    const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: name, rsnNormalized: name.toLowerCase(), accountHash: `hash-${name}`, claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
    return (await db.insert(s.eventParticipants).values({ eventId, clanMemberId: m.id, accountId: acct.id, name, teamId }).returning())[0].id;
  };
  ids.event = (await db.insert(s.events).values({ clanId, name: 'Board', boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1 }).returning())[0].id;
  ids.team = (await db.insert(s.teams).values({ eventId: ids.event, name: 'Team', color: '#fff' }).returning())[0].id;
  ids.player = await seat('Proofer', 'tok-pa', ids.team, ids.event);
  ids.other = await seat('Stranger', 'tok-other', ids.team, ids.event);
  const tile = async (position: number, label: string, item: number) =>
    (await db.insert(s.tiles).values({ eventId: ids.event, position, label, tileType: 'drop', trackedItemIds: `[${item}]`, requiredAmount: 1 }).returning())[0].id;
  ids.whip = await tile(1, 'Whip', 4151);
  ids.fang = await tile(2, 'Fang', 26219);
  ids.bow = await tile(3, 'Bow', 20997);
});

after(async () => {
  await new Promise((r) => setTimeout(r, 300)); // let the after-reply work settle
  globalThis.fetch = realFetch;
  (https as { request: unknown }).request = realRequest;
  await pool.end();
  await dropDatabase(DB);
});

let whipKey = '';

test('a pending credit counts at once with no image, says it completed, and names a key', async () => {
  const reply = await credit(4151);
  assert.equal(reply.credits[0].t, ids.whip);
  assert.equal(reply.credits[0].ok, true);
  assert.equal(reply.credits[0].completed, true, '"Tile complete" is known before any picture');
  assert.match(reply.proofKey ?? '', /^[A-Za-z0-9_-]{24}$/);
  assert.deepEqual(reply.proofFor, ['Whip']);
  whipKey = reply.proofKey!;
  const [row] = await rows(ids.whip);
  assert.equal(row.imageUrl, null);
  assert.equal(row.proofKey, whipKey);
  assert.ok(row.proofDueAt && Date.parse(row.proofDueAt) > Date.now() + 50_000);
  // Only the lines the stamp would print are kept while it waits; the rest of the chat never is.
  assert.deepEqual((JSON.parse(row.proofPending ?? '{}') as { claims: { chat: { text: string }[] } }).claims.chat.map((c) => c.text), ['Valuable drop: Abyssal whip (1,500,000 coins)']);
  // No API shows the key or the stored claims.
  const { GET } = await import('../src/app/api/events/[eventId]/submissions/route.ts');
  const req = new Request(`https://example.test/api/events/${ids.event}/submissions`, { headers: headers() });
  const listed = (await inRequest(req, () => GET(req, { params: Promise.resolve({ eventId: String(ids.event) }) }))) as Response;
  const body = await listed.text();
  assert.ok(!body.includes(whipKey) && !body.includes('proofPending') && !body.includes('proofKey'), body.slice(0, 300));
  assert.ok(await completed(ids.whip));
});

test('someone else’s token cannot attach to it', async () => {
  const res = await upload(whipKey, headers('tok-other', 'Stranger'));
  assert.equal(res.status, 404, await res.clone().text());
  assert.equal((await rows(ids.whip))[0].imageUrl, null);
});

test('the screenshot attaches, gets stamped, and a repeat upload is a no-op', async () => {
  const res = await upload(whipKey);
  assert.equal(res.status, 200, await res.clone().text());
  assert.deepEqual(await res.json(), { ok: true, attached: 1 });
  let [row] = await rows(ids.whip);
  assert.ok(row.imageUrl?.startsWith('http://localhost:9000/'));
  assert.equal(row.proofDueAt, null);
  assert.equal(row.proofPending, null);
  assert.notEqual(row.proofKey, whipKey, 'the key is gone once attached');
  assert.match(row.proofKey ?? '', /^done:/);
  assert.ok(row.imageSha256);
  // The stamp runs after the reply: the clean frame moves to cleanImageUrl, the stamped copy shows.
  for (let i = 0; i < 50 && !row.cleanImageUrl; i++) {
    await new Promise((r) => setTimeout(r, 100));
    [row] = await rows(ids.whip);
  }
  assert.ok(row.cleanImageUrl, 'stamped');
  assert.match(row.imageUrl ?? '', /-stamped\.webp$/);
  assert.equal((JSON.parse(row.proofFacts ?? '{}') as { split?: number }).split, 0.5);

  const again = await upload(whipKey);
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { ok: true, attached: 0 });
  assert.ok(await completed(ids.whip), 'still complete');
});

test('a credit whose screenshot never came is reversed by the sweep, and its key is then too late', async () => {
  const reply = await credit(26219);
  assert.ok(reply.proofKey);
  assert.ok(await completed(ids.fang));
  await expire(ids.fang);
  const { sweepOverdueProofs } = await import('../src/lib/proofFinish.ts');
  assert.deepEqual(await sweepOverdueProofs(), ['Fang']);
  assert.equal((await rows(ids.fang)).length, 0);
  assert.equal(await completed(ids.fang), false, 'the tile is open again');
  const res = await upload(reply.proofKey!);
  assert.equal(res.status, 410);
  assert.match((await res.json()).error, /Too late/);
});

test('an upload that arrives after the minute reverses the credit itself and answers 410', async () => {
  const reply = await credit(20997);
  await expire(ids.bow);
  const res = await upload(reply.proofKey!);
  assert.equal(res.status, 410);
  assert.equal((await rows(ids.bow)).length, 0);
  assert.equal(await completed(ids.bow), false);
});

test('without proofPending an image-less drop is refused exactly as before (no key)', async () => {
  const reply = await credit(20997, {});
  assert.equal(reply.proofKey, undefined);
  assert.equal(reply.credits[0].ok, false);
  assert.equal((await rows(ids.bow)).length, 0);
});
