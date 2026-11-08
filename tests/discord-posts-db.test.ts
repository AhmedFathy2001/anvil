// Board posts keep their Discord message ids (lib/discordPosts), and a removal edits the post instead
// of leaving it standing. Discord itself is stubbed: `fetch` answers like a webhook.
//
// Run: TEST_DATABASE_URL=… npx tsx --test tests/discord-posts-db.test.ts

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('discord-posts-db');
const HOOK = 'https://discord.com/api/webhooks/123456/secret-token';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let clanId: number;
let eventId: number;
let teamId: number;
let tileId: number;
let calls: { method: string; url: string; body: unknown }[] = [];
let failPatch = false;
const realFetch = globalThis.fetch;

function stubDiscord() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body });
    if (method === 'POST') return new Response(JSON.stringify({ id: `m${calls.length}`, channel_id: 'c1' }), { status: 200 });
    if (method === 'GET') return new Response(JSON.stringify({ id: 'm1', content: '', embeds: [{ title: 'Drop — Twisted bow', description: 'Alice got it', image: { url: 'https://x/p.png' } }] }), { status: 200 });
    if (method === 'PATCH') return new Response(failPatch ? 'nope' : '{}', { status: failPatch ? 500 : 200 });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'posts', name: 'Posts' }).returning();
  clanId = clan.id;
  await db.insert(s.settings).values({ clanId, key: 'discord_webhook_bingo', value: HOOK });
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Bingo', boardSize: 5, startDate: new Date(Date.now() - 864e5).toISOString() }).returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  teamId = team.id;
  const [tile] = await db.insert(s.tiles).values({ eventId, position: 0, label: 'Twisted bow', tileType: 'drop' }).returning();
  tileId = tile.id;
  stubDiscord();
});

beforeEach(() => {
  calls = [];
  failPatch = false;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a submission post is sent with wait=true and its message id is kept', async () => {
  const { notifySubmission } = await import('../src/lib/discord.ts');
  await notifySubmission({
    clanId, teamId, eventId, eventName: 'Bingo', tileLabel: 'Twisted bow', teamName: 'Red', teamColor: '#ff0000',
    creditPlayerName: 'Alice', amount: 1, currentTotal: 1, requiredAmount: 1, note: null, imageUrl: 'https://x/p.png',
    tileType: 'drop', completed: true, tile: { id: tileId, tileType: 'drop' } as never, submissionIds: [41],
  });
  const post = calls.find((c) => c.method === 'POST');
  assert.ok(post && post.url.includes('wait=true'));
  const rows = await db.select().from(s.discordPosts);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'submissionComplete');
  assert.equal(rows[0].messageId, 'm1');
  assert.equal(rows[0].channelId, 'c1');
  assert.deepEqual(rows[0].submissionIds, [41]);
  assert.equal(rows[0].tileId, tileId);
});

test('removing that submission edits the post: struck title, the reason, image kept', async () => {
  const { markSubmissionPostsRemoved } = await import('../src/lib/discordPostActions.ts');
  let fellBack = false;
  const r = await markSubmissionPostsRemoved(41, 'Removed by an admin: wrong account', async () => { fellBack = true; });
  assert.deepEqual(r, { done: 1, failed: 0 });
  assert.equal(fellBack, false);
  const patch = calls.find((c) => c.method === 'PATCH')!;
  assert.ok(patch.url.endsWith('/messages/m1'));
  const embed = (patch.body as { embeds: { title: string; description: string; image: { url: string } }[] }).embeds[0];
  assert.equal(embed.title, '~~Drop — Twisted bow~~');
  assert.match(embed.description, /^\*\*Removed by an admin: wrong account\*\*/);
  assert.equal(embed.image.url, 'https://x/p.png');
  const [row] = await db.select().from(s.discordPosts);
  assert.ok(row.editedAt);
});

test('no stored post, or an edit Discord refuses: the correction post runs instead', async () => {
  const { markSubmissionPostsRemoved } = await import('../src/lib/discordPostActions.ts');
  let fellBack = 0;
  await markSubmissionPostsRemoved(999, 'Removed by an admin', async () => { fellBack++; });
  assert.equal(fellBack, 1, 'unknown id');
  failPatch = true;
  await markSubmissionPostsRemoved(41, 'Removed by an admin', async () => { fellBack++; });
  assert.equal(fellBack, 2, 'edit refused');
});

test('a completion rolled back with "delete" deletes its post and marks it deleted', async () => {
  const { notifyTileCompletion } = await import('../src/lib/discord.ts');
  await notifyTileCompletion({ clanId, teamId, eventId, eventName: 'Bingo', tileLabel: 'Twisted bow', teamName: 'Red', teamColor: '#ff0000', tileType: 'drop', tile: { id: tileId, tileType: 'drop' } as never });
  const { markCompletionPostsRemoved } = await import('../src/lib/discordPostActions.ts');
  const r = await markCompletionPostsRemoved({ eventId, teamId, tileIds: [tileId], action: 'delete', note: 'Rolled back by an admin' });
  // The tile-complete post and the earlier completing submission post both announced it.
  assert.equal(r.failed, 0);
  assert.ok(r.done >= 1);
  assert.ok(calls.some((c) => c.method === 'DELETE'));
  const live = (await db.select().from(s.discordPosts)).filter((p) => p.deletedAt == null && p.tileId === tileId && p.kind === 'tileComplete');
  assert.equal(live.length, 0);
});

test('a post without a ref is sent as before (no wait, nothing kept)', async () => {
  const before = (await db.select().from(s.discordPosts)).length;
  const { sendBingoWebhook } = await import('../src/lib/discord.ts');
  await sendBingoWebhook(clanId, { content: 'hello' });
  const post = calls.find((c) => c.method === 'POST')!;
  assert.ok(!post.url.includes('wait=true'));
  assert.equal((await db.select().from(s.discordPosts)).length, before);
  void eq;
});
