// /api/plugin/notify names the poster from the TOKEN's character, never from the body: a drop's
// facts.rsn, a newer kind's rsn, or an older plugin's finished embed author can't put a post under
// someone else's name.
//
// Run: npx tsx --test tests/notify-poster-name-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('notify-poster-name');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let POST: typeof import('../src/app/api/plugin/notify/route.ts')['POST'];
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/poster-name-token';
const sent: Record<string, unknown>[] = [];
const realFetch = globalThis.fetch;

before(async () => {
  await resetDatabase(DB);
  const l = await loadDb();
  pool = l.pool;
  const { db, schema: s } = l;
  await db.insert(s.clans).values({ slug: 'home', name: 'Home' });
  const [p] = await db.insert(s.players).values({ displayName: 'Realme' }).returning({ id: s.players.id });
  await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Realme', rsnNormalized: 'realme' });
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Realme', discordId: 'd-poster', pluginTokenHash: tokenHash('tok-poster'), playerId: p.id })
    .returning({ id: s.users.id });
  await db.insert(s.userWebhooks).values({ userId: u.id, url: HOOK, kinds: JSON.stringify(['rareDrops', 'milestones']) });
  ({ POST } = await import('../src/app/api/plugin/notify/route.ts'));
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url).startsWith('https://discord.com/api/webhooks/')) {
      sent.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(JSON.stringify({ id: '1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url as string, init);
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

const post = (body: Record<string, unknown>) =>
  POST(
    new Request('https://example.test/api/plugin/notify', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-poster', 'X-RSN': 'Realme', 'x-anvil-clan-slug': 'home', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const lastEmbed = () => (sent.at(-1)?.embeds as { author?: { name?: string }; description?: string }[] | undefined)?.[0];

test('a site-built drop post ignores the body rsn and names the token’s character', async () => {
  sent.length = 0;
  const res = await post({ channel: 'rareDrops', kind: 'drop', facts: { rsn: 'Zezima', items: [{ name: 'Twisted bow', qty: 1, value: 1_000_000_000 }], source: 'Chambers of Xeric' } });
  assert.ok(res.status < 300, `status ${res.status} ${await res.clone().text()}`);
  assert.equal(sent.length, 1, 'posted to the personal webhook');
  const e = lastEmbed();
  assert.equal(e?.author?.name, 'Realme');
  assert.doesNotMatch(JSON.stringify(sent[0]), /Zezima/);
});

test('an older plugin’s finished embed gets its author line from the token too', async () => {
  sent.length = 0;
  await post({ channel: 'rareDrops', embed: { author: { name: 'Zezima' }, title: 'Loot', description: 'a drop' } });
  assert.equal(sent.length, 1);
  assert.equal(lastEmbed()?.author?.name, 'Realme');
});
