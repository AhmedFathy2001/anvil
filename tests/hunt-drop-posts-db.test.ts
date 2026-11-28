// Item hunt drops on Discord, and the plugin's screenshot of them (lib/huntDropPosts), against a real
// database with Discord and the media store stood in for: what posts, that it posts once, that the
// screenshot lands on the right drop for its own character only, and that no screenshot ever costs a
// drop anything.
//
// Run: TESTS_OK=1 npx tsx --test tests/hunt-drop-posts-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import http from 'node:http';
import https from 'node:https';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';

const DB = useTestDatabase('hunt-drop-posts');
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/itemHuntDb.ts');
let P: typeof import('../src/lib/huntDropPosts.ts');
let setSetting: typeof import('../src/lib/settings.ts')['setSetting'];

const FANG = 12922;
const HOUR = 3_600_000;
const START = Date.now() - 48 * HOUR;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const settle = (ms = 100) => new Promise((r) => setTimeout(r, ms));

let clanId = 0;
let staffUserId = 0;
const seats: Record<string, number> = {};

// Discord: every webhook call kept; a post answers with a fresh message id.
type Call = { method: string; url: string; body: { embeds?: { description?: string; fields?: { name: string; value: string }[]; image?: { url: string } }[] } };
const calls: Call[] = [];
let nextId = 1000;
// The media store: PUTs kept, GETs answered from them.
const stored = new Map<string, Buffer>();
const realRequest = https.request;
const realHttpRequest = http.request;
const realFetch = globalThis.fetch;

async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = { type: 'request', phase: 'render', headers: HeadersAdapter.seal(new Headers(req.headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers())) };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

const headers = (rsn: string) => ({ Authorization: `Bearer tok-${rsn}`, 'X-RSN': rsn, 'X-Account-Hash': `hash-${rsn}`, ...clanHeaders('hunters') });

let jpeg: Buffer;
async function upload(key: string, rsn: string) {
  const { POST } = await import('../src/app/api/plugin/facts/proof/route.ts');
  const form = new FormData();
  form.append('key', key);
  form.append('body', JSON.stringify({ proof: { split: 0.5 } }));
  form.append('file', new File([new Uint8Array(jpeg)], 'proof.jpg', { type: 'image/jpeg' }));
  const req = new Request('https://example.test/api/plugin/facts/proof', { method: 'POST', headers: headers(rsn), body: form });
  return inRequest(req, () => POST(req));
}

async function hunt(title = 'Fang hunt') {
  // One running hunt at a time: a report is filed into every hunt the clan is running.
  await db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.clanId, clanId));
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'hunt',
      metric: 'Tanzanite fang from Zulrah',
      title,
      startDate: new Date(START).toISOString(),
      endDate: new Date(Date.now() + 120 * HOUR).toISOString(),
      status: 'active',
      includeGuests: 0,
      hunt: JSON.stringify({
        v: 1, target: 'items', items: [{ id: FANG, name: 'Tanzanite fang', sources: ['Zulrah'], count: 'drops' }],
        petGroup: null, rule: 'most', ends: { kind: 'date' }, confirm: 'staff', killsOf: 'zulrah', xpSkill: null,
      }),
    })
    .returning();
  for (const rsn of ['Alpha', 'Bravo']) {
    await db.insert(s.weeklyParticipants).values({ competitionId: comp.id, clanMemberId: seats[rsn], rsn, rsnNormalized: rsn.toLowerCase(), baselineValue: 400, currentValue: 500 });
  }
  return comp;
}

const report = (over: Record<string, unknown> = {}) => ({ kind: 'drop', itemId: FANG, itemName: 'Tanzanite fang', quantity: 1, source: 'Zulrah', kc: 512, occurredAt: ago(5), dedupKey: 'k', ...over });
const send = (rsn: string, reports: ReturnType<typeof report>[]) => H.recordHuntReports({ clanMemberId: seats[rsn], rsn }, clanId, reports);
const rows = (competitionId: number) => db.select().from(s.huntDrops).where(eq(s.huntDrops.competitionId, competitionId)).orderBy(s.huntDrops.id);
const posted = (method = 'POST') => calls.filter((c) => c.method === method);
/** The fire-and-forget post has gone (or nothing is coming). */
async function quiet() {
  let n = -1;
  while (n !== calls.length) {
    n = calls.length;
    await settle(250);
  }
}

before(async () => {
  jpeg = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#335' } }).jpeg().toBuffer();
  // Both: storage PUTs over http to a local endpoint and https to a real one.
  const fakePut = (opts: { path: string }, done: (res: EventEmitter & { statusCode: number }) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: (b: Buffer) => void };
    req.end = (b: Buffer) => {
      stored.set(`http://localhost:9000${opts.path}`, Buffer.from(b));
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      done(res);
      setImmediate(() => res.emit('end'));
    };
    (req as unknown as { on: () => void }).on = () => {};
    return req;
  };
  (https as { request: unknown }).request = fakePut;
  (http as { request: unknown }).request = fakePut;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = req.url;
    if (url.includes('discord.com/api/webhooks')) {
      const text = req.method === 'GET' || req.method === 'DELETE' ? '' : await req.text();
      calls.push({ method: req.method, url, body: text ? JSON.parse(text) : {} });
      if (req.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ id: req.method === 'PATCH' ? url.split('/messages/')[1].split('?')[0] : String(nextId++) }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('http://localhost:9000/')) {
      if (req.method === 'PUT') {
        stored.set(url.split('?')[0], Buffer.from(await req.arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      const bytes = stored.get(url.split('?')[0]);
      return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response(null, { status: 404 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/itemHuntDb.ts');
  P = await import('../src/lib/huntDropPosts.ts');
  ({ setSetting } = await import('../src/lib/settings.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'hunters', name: 'Hunters', status: 'active' }).returning();
  clanId = clan.id;
  await setSetting(clanId, 'discord_webhook_weekly', `https://discord.com/api/webhooks/1${clanId}/token`);
  const [staff] = await db.insert(s.users).values({ displayName: 'Olive' }).returning();
  staffUserId = staff.id;
  const now = new Date().toISOString();
  for (const rsn of ['Alpha', 'Bravo']) {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    await db.insert(s.users).values({ displayName: rsn, discordId: `d-${rsn}`, pluginTokenHash: tokenHash(`tok-${rsn}`), playerId: p.id });
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase(), accountHash: `hash-${rsn}`, claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member', source: 'roster' }).returning();
    seats[rsn] = m.id;
  }
});

after(async () => {
  await quiet();
  globalThis.fetch = realFetch;
  (https as { request: unknown }).request = realRequest;
  (http as { request: unknown }).request = realHttpRequest;
  await pool.end();
  await dropDatabase(DB);
});

let firstKey = '';
let firstCompId = 0;

test('a counted plugin drop is posted once, with who, what, where, the kc and their standing', async () => {
  const comp = await hunt();
  firstCompId = comp.id;
  const before = posted().length;
  const result = await send('Alpha', [report()]);
  assert.equal(result.stored, 1);
  assert.equal(result.proofs.length, 1);
  assert.equal(result.proofs[0].itemId, FANG);
  firstKey = result.proofs[0].key;
  await quiet();

  const sent = posted().slice(before);
  assert.equal(sent.length, 1, 'one post');
  const embed = sent[0].body.embeds![0];
  assert.match(embed.description ?? '', /\*\*Alpha\*\* got \*\*Tanzanite fang\*\* from \*\*Zulrah\*\* at 512 kc\./);
  assert.ok(embed.fields?.some((f) => f.name === 'Standing' && /1st, 1 drop/.test(f.value)));
  assert.equal(embed.image, undefined, 'no picture yet: the post never waits for one');
  const [row] = await rows(comp.id);
  assert.ok(row.postedAt);
  assert.equal(row.discordMessageId, String(nextId - 1), 'the post’s id, for the screenshot’s edit');

  // The same drop again (a retry, the log line) and a direct second ask: nothing more goes out.
  await send('Alpha', [report({ dedupKey: 'again' })]);
  assert.equal(await P.announceHuntDrop(row.id), false);
  await quiet();
  assert.equal(posted().length - before, 1, 'still one post');
});

test('a held drop posts only once staff confirm it; a turned-down one never does', async () => {
  const comp = await hunt('Held hunt');
  const before = posted().length;
  // Below the site's own kill count: held for staff.
  const held = await send('Bravo', [report({ kc: 120 })]);
  assert.equal(held.stored, 1);
  const [row] = await rows(comp.id);
  assert.equal(row.status, 'review');
  await quiet();
  assert.equal(posted().length, before, 'a held drop is not posted');
  assert.equal(await P.announceHuntDrop(row.id), false);

  assert.deepEqual(await H.decideHuntDrop(comp, row.id, 'confirm', { userId: staffUserId }), { ok: true });
  await quiet();
  assert.equal(posted().length, before + 1, 'confirmed: posted');
  assert.match(posted().at(-1)!.body.embeds![0].fields!.find((f) => f.name === 'Counted from')!.value, /confirmed by Olive/);

  // Another held one, turned down: nothing.
  await send('Alpha', [report({ kc: 130, occurredAt: ago(2) })]);
  const second = (await rows(comp.id)).find((r) => r.rsnNormalized === 'alpha')!;
  await H.decideHuntDrop(comp, second.id, 'reject', { userId: staffUserId });
  await quiet();
  assert.equal(posted().length, before + 1, 'a rejected drop is never posted');
});

test('a member’s proof that staff approve is posted with its own screenshot', async () => {
  const comp = await hunt('Manual hunt');
  const before = posted().length;
  const [seat] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, comp.id));
  const added = await H.addManualDrop(comp, { participantId: seat.id, itemId: FANG, itemName: 'Tanzanite fang', source: 'Zulrah', quantity: 1, occurredAt: ago(3), kc: 480, xp: null, xpSkill: null, screenshotUrl: 'https://cdn.example/shot.png', note: null }, { userId: 0, staff: false });
  assert.equal(added.ok, true);
  await quiet();
  assert.equal(posted().length, before, 'pending: not posted');
  await H.decideHuntDrop(comp, (added as { id: number }).id, 'confirm', { userId: staffUserId });
  await quiet();
  assert.equal(posted().length, before + 1);
  assert.equal(posted().at(-1)!.body.embeds![0].image?.url, 'https://cdn.example/shot.png');
});

test('the screenshot attaches only for the drop’s own character, is added to the post, and only once', async () => {
  const other = await upload(firstKey, 'Bravo');
  assert.equal(other.status, 404, await other.clone().text());
  assert.equal((await rows(firstCompId))[0].screenshotUrl, null);

  const edits = posted('PATCH').length;
  const res = await upload(firstKey, 'Alpha');
  assert.equal(res.status, 200, await res.clone().text());
  assert.deepEqual(await res.json(), { ok: true, attached: 1 });
  const [row] = await rows(firstCompId);
  assert.ok(row.screenshotUrl?.startsWith('http://localhost:9000/'));
  assert.match(row.proofKey ?? '', /^done:/, 'the key is spent');
  assert.equal(row.status, 'counted');
  await quiet();
  const patch = posted('PATCH').slice(edits);
  assert.equal(patch.length, 1, 'the post is edited in place');
  assert.ok(patch[0].url.includes(`/messages/${row.discordMessageId}`));
  assert.equal(patch[0].body.embeds![0].image?.url, row.screenshotUrl);

  const again = await upload(firstKey, 'Alpha');
  assert.deepEqual(await again.json(), { ok: true, attached: 0 });
  await quiet();
  assert.equal(posted('PATCH').length, edits + 1, 'a repeat upload edits nothing');
});

test('a screenshot that never comes, or comes too late, changes nothing about the drop', async () => {
  const comp = await hunt('No shot hunt');
  const result = await send('Bravo', [report({ occurredAt: ago(1) })]);
  const key = result.proofs[0].key;
  await quiet();
  // The bingo sweep reverses credits whose picture never came; it has nothing to say to a hunt drop.
  const { sweepOverdueProofs } = await import('../src/lib/proofFinish.ts');
  await sweepOverdueProofs(Date.now() + 24 * HOUR);
  let [row] = await rows(comp.id);
  assert.equal(row.status, 'counted');
  assert.equal(row.proofKey, key, 'still waiting, harmlessly');

  // Past the window: refused, and the drop still counts.
  await db.update(s.huntDrops).set({ createdAt: new Date(Date.now() - 2 * HOUR).toISOString() }).where(eq(s.huntDrops.id, row.id));
  const late = await upload(key, 'Bravo');
  assert.equal(late.status, 410);
  [row] = await rows(comp.id);
  assert.equal(row.status, 'counted');
  assert.equal(row.screenshotUrl, null);
  const standings = await H.huntStandings(comp);
  assert.equal(standings?.rows.find((r) => r.rsn === 'Bravo')?.count, 1);
});

test('a drop turned down after it was posted is taken down', async () => {
  const comp = await hunt('Takedown hunt');
  await send('Alpha', [report({ occurredAt: ago(4) })]);
  await quiet();
  const [row] = await rows(comp.id);
  assert.ok(row.discordMessageId);
  const deletes = posted('DELETE').length;
  await H.decideHuntDrop(comp, row.id, 'reject', { userId: staffUserId });
  await quiet();
  assert.equal(posted('DELETE').length, deletes + 1);
  assert.ok(posted('DELETE').at(-1)!.url.includes(`/messages/${row.discordMessageId}`));
});

test('a clan that switched the drop posts off hears none; the drops count all the same', async () => {
  await setSetting(clanId, 'weekly_post_hunt_drops', 'false');
  const comp = await hunt('Quiet hunt');
  const before = posted().length;
  const result = await send('Bravo', [report({ occurredAt: ago(6) })]);
  assert.equal(result.stored, 1);
  await quiet();
  assert.equal(posted().length, before);
  const [row] = await rows(comp.id);
  assert.equal(row.status, 'counted');
  assert.ok(row.postedAt, 'claimed, so a later switch-on does not post old news');
  await setSetting(clanId, 'weekly_post_hunt_drops', 'true');
});

test('the moments push names each new hunt drop’s screenshot key; an unknown key is still the bingo route’s', async () => {
  const comp = await hunt('Route hunt');
  const { POST } = await import('../src/app/api/plugin/moments/route.ts');
  const body = { moments: [{ kind: 'drop', key: 'client-key-1', at: new Date().toISOString(), itemId: FANG, itemName: 'Tanzanite fang', quantity: 1, source: 'Zulrah', kc: 515 }] };
  const req = new Request('https://example.test/api/plugin/moments', { method: 'POST', headers: { ...headers('Alpha'), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const res = await inRequest(req, () => POST(req));
  assert.equal(res.status, 200, await res.clone().text());
  const reply = (await res.json()) as { huntProofs?: { itemId: number; key: string }[] };
  assert.equal(reply.huntProofs?.length, 1);
  assert.equal(reply.huntProofs![0].itemId, FANG);
  const [row] = await rows(comp.id);
  assert.equal(row.proofKey, reply.huntProofs![0].key);

  const unknown = await upload('x'.repeat(24), 'Alpha');
  assert.equal(unknown.status, 410, 'no hunt drop and no credit: the bingo answer, as before');
});
