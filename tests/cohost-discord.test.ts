// Co-hosted boards in Discord: a co-host's server resolves the shared board (`/bingo`), reads the
// HOST's rulebook, and receives the board's posts (fan-out) in its own channel, pinging its own role.
//
// Run: npx tsx --test tests/cohost-discord.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('cohost_discord');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

let hostClan: number;
let guestClan: number;
let pendingClan: number;
let strangerClan: number;
let eventId: number;

const posts: { url: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());

  const mk = async (slug: string, name: string) =>
    (await db.insert(s.clans).values({ slug, name }).returning())[0].id;
  hostClan = await mk('host', 'Host Clan');
  guestClan = await mk('guest', 'Guest Clan');
  pendingClan = await mk('pending', 'Pending Clan');
  strangerClan = await mk('stranger', 'Stranger Clan');

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: hostClan, name: 'Rumble', boardSize: 5, startDate: '2020-01-01T00:00:00.000Z', endDate: '2099-01-01T00:00:00.000Z' })
    .returning();
  eventId = ev.id;
  await db.insert(s.eventCohosts).values([
    { eventId, clanId: guestClan, status: 'accepted' },
    { eventId, clanId: pendingClan, status: 'pending' },
  ]);

  await db.insert(s.settings).values([
    { clanId: hostClan, key: 'board_rules', value: 'Host house rules' },
    { clanId: guestClan, key: 'board_rules', value: 'Guest house rules — must never show for the host board' },
    { clanId: hostClan, key: 'discord_webhook_bingo', value: 'https://discord.test/host-bingo' },
    { clanId: hostClan, key: 'discord_member_ping_role_id', value: '111' },
    { clanId: guestClan, key: 'discord_webhook_bingo', value: 'https://discord.test/guest-bingo' },
    { clanId: guestClan, key: 'discord_webhook_cohost', value: 'https://discord.test/guest-cohost' },
    { clanId: guestClan, key: 'discord_member_ping_role_id', value: '222' },
    { clanId: pendingClan, key: 'discord_webhook_bingo', value: 'https://discord.test/pending-bingo' },
  ]);

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('a co-host server resolves the shared board, naming the host', async () => {
  const { pickEvent, listLiveEvents, loadEvent } = await import('../src/lib/discordContext.ts');
  const picked = await pickEvent(guestClan);
  assert.equal(picked?.id, eventId);
  assert.equal(picked?.hostClanName, 'Host Clan');
  assert.equal((await listLiveEvents(guestClan)).map((e) => e.id).join(), String(eventId));
  assert.equal((await loadEvent(eventId, guestClan))?.id, eventId);
  // The host sees its own board, without a "hosted by".
  assert.equal((await pickEvent(hostClan))?.hostClanName, null);
});

test('a pending co-host and a stranger do not', async () => {
  const { pickEvent, loadEvent } = await import('../src/lib/discordContext.ts');
  assert.equal(await pickEvent(pendingClan), null);
  assert.equal(await loadEvent(eventId, pendingClan), null);
  assert.equal(await loadEvent(eventId, strangerClan), null);
});

test('the rulebook is the HOST clan’s, and the event’s own text wins over it', async () => {
  const { loadRulesFacts } = await import('../src/lib/eventRulebook.ts');
  const before = await loadRulesFacts(eventId);
  assert.equal(before?.rulebook.text, 'Host house rules');
  assert.equal(before?.rulebook.source, 'clan');
  await db.update(s.events).set({ rulebook: 'Rumble rules' }).where((await import('drizzle-orm')).eq(s.events.id, eventId));
  const after = await loadRulesFacts(eventId);
  assert.equal(after?.rulebook.text, 'Rumble rules');
  assert.equal(after?.rulebook.source, 'event');
});

test('fan-out: host + accepted co-host only, co-host channel preferred, each pings its own role', async () => {
  const { sendEventBingoWebhook } = await import('../src/lib/discord.ts');
  posts.length = 0;
  const ok = await sendEventBingoWebhook(hostClan, eventId, { embeds: [{ title: 'Event started' }] }, { ping: true });
  assert.equal(ok, true);
  const byUrl = new Map(posts.map((p) => [p.url, p.body]));
  assert.deepEqual([...byUrl.keys()].sort(), ['https://discord.test/guest-cohost', 'https://discord.test/host-bingo']);
  assert.equal(byUrl.get('https://discord.test/host-bingo')?.content, '<@&111>');
  assert.equal(byUrl.get('https://discord.test/guest-cohost')?.content, '<@&222>');
});

test('fan-out: a co-host that switched it off gets nothing; the host still posts', async () => {
  const { sendEventBingoWebhook } = await import('../src/lib/discord.ts');
  await db.insert(s.settings).values({ clanId: guestClan, key: 'discord_cohost_posts_enabled', value: 'false' });
  posts.length = 0;
  await sendEventBingoWebhook(hostClan, eventId, { embeds: [{ title: 'Tile done' }] });
  assert.deepEqual(posts.map((p) => p.url), ['https://discord.test/host-bingo']);
});

test('rules post targets: host first, then accepted co-hosts; narrowed on request', async () => {
  const { rulesPostTargets } = await import('../src/lib/eventRulesPost.ts');
  assert.deepEqual(await rulesPostTargets(eventId, hostClan), [hostClan, guestClan]);
  assert.deepEqual(await rulesPostTargets(eventId, hostClan, [guestClan]), [guestClan]);
  assert.deepEqual(await rulesPostTargets(eventId, hostClan, [strangerClan]), []);
});

test('cross-clan context reads without throwing', async () => {
  const { getCrossClanContext } = await import('../src/lib/discordContext.ts');
  const cross = await getCrossClanContext(eventId);
  assert.equal(typeof cross.shared, 'boolean');
});

test('postEventRules: one post per clan, each in its own channel, under the host’s rulebook', async () => {
  const { postEventRules } = await import('../src/lib/eventRulesPost.ts');
  const { eq } = await import('drizzle-orm');
  await db.delete(s.settings).where(eq(s.settings.key, 'discord_cohost_posts_enabled'));
  posts.length = 0;
  const results = await postEventRules(eventId, hostClan);
  assert.deepEqual(
    results.map((r) => [r.clanId, r.status]),
    [
      [hostClan, 'sent'],
      [guestClan, 'sent'],
    ],
  );
  const guestPost = posts.find((p) => p.url === 'https://discord.test/guest-cohost');
  const embeds = guestPost?.body.embeds as { title?: string; description?: string }[];
  assert.equal(embeds.length, 2);
  assert.match(embeds[0].description ?? '', /hosted by Host Clan/);
  assert.equal(embeds[1].description, 'Rumble rules');
});
