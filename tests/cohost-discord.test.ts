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

const posts: { url: string; method: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;
const realBotToken = process.env.DISCORD_BOT_TOKEN;

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
    const href = String(url);
    if (href.endsWith('/users/@me')) {
      return Response.json({ id: 'bot-user' });
    }
    if (/\/guilds\/[^/]+\/roles$/.test(href)) {
      return Response.json([
        { id: 'host-role', name: 'Host bingo', position: 2, managed: false, permissions: '0' },
        { id: 'guest-role', name: 'Guest bingo', position: 2, managed: false, permissions: '0' },
        { id: 'pending-role', name: 'Pending bingo', position: 2, managed: false, permissions: '0' },
      ]);
    }
    posts.push({ url: href, method: init?.method ?? 'GET', body: JSON.parse(String(init?.body ?? '{}')) });
    if (new URL(href).searchParams.get('wait') === 'true') {
      return Response.json({ id: `rules-message-${posts.length}` });
    }
    if (init?.method === 'PATCH') return Response.json({ ok: true });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (realBotToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
  else process.env.DISCORD_BOT_TOKEN = realBotToken;
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

test('board reveal fans out a signed full-board image and interactive link', async () => {
  const previousRedirect = process.env.DISCORD_REDIRECT_URI;
  process.env.DISCORD_REDIRECT_URI = 'https://anvil.test/api/auth/discord/callback';
  try {
    const { notifyBoardRevealed } = await import('../src/lib/discord.ts');
    posts.length = 0;
    const ok = await notifyBoardRevealed({
      clanId: hostClan,
      eventId,
      eventName: 'Rumble',
      startDate: '2099-01-01T00:00:00.000Z',
      revealedAt: '2026-10-07T12:00:00.000Z',
      tileCount: 25,
    });
    assert.equal(ok, true);
    assert.equal(posts.length, 2);
    for (const post of posts) {
      const embed = (post.body.embeds as { url?: string; image?: { url?: string } }[])[0];
      assert.equal(embed.url, `https://anvil.test/events/${eventId}`);
      assert.match(embed.image?.url ?? '', /^https:\/\/anvil\.test\/api\/og\/board\?e=1&v=/);
      assert.match(embed.image?.url ?? '', /&s=[A-Za-z0-9_-]+$/);
    }
  } finally {
    if (previousRedirect === undefined) delete process.env.DISCORD_REDIRECT_URI;
    else process.env.DISCORD_REDIRECT_URI = previousRedirect;
  }
});

test('board reveal test post stays in the current clan and never fans out', async () => {
  const { notifyBoardRevealed } = await import('../src/lib/discord.ts');
  posts.length = 0;
  const ok = await notifyBoardRevealed({
    clanId: hostClan,
    eventId,
    eventName: 'Rumble',
    revealedAt: 'test-123',
    tileCount: 25,
    test: true,
  });
  assert.equal(ok, true);
  assert.deepEqual(posts.map((post) => post.url), ['https://discord.test/host-bingo']);
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
    results.map((r) => [r.clanId, r.status, r.action]),
    [
      [hostClan, 'sent', 'posted'],
      [guestClan, 'sent', 'posted'],
    ],
  );
  const guestPost = posts.find((p) => p.url.startsWith('https://discord.test/guest-cohost?'));
  const embeds = guestPost?.body.embeds as { title?: string; description?: string }[];
  assert.equal(embeds.length, 2);
  assert.match(embeds[0].description ?? '', /hosted by Host Clan/);
  assert.equal(embeds[1].description, 'Rumble rules');

  const row = await db.query.events.findFirst({ where: (await import('drizzle-orm')).eq(s.events.id, eventId) });
  assert.deepEqual(row?.rulesMessageIds, {
    [String(hostClan)]: results[0].messageId,
    [String(guestClan)]: results[1].messageId,
  });

  posts.length = 0;
  const updated = await postEventRules(eventId, hostClan);
  assert.deepEqual(updated.map((r) => r.action), ['updated', 'updated']);
  assert.equal(posts.length, 2);
  assert.ok(posts.every((post) => post.method === 'PATCH'));
  assert.ok(posts.some((post) => post.url.endsWith(`/messages/${results[0].messageId}`)));
  assert.ok(posts.some((post) => post.url.endsWith(`/messages/${results[1].messageId}`)));
});

test('bingo-role fan-out uses only accepted co-hosts that explicitly opted in, with each own role', async () => {
  process.env.DISCORD_BOT_TOKEN = 'cohost-role-test-token';
  await db.insert(s.settings).values([
    { clanId: hostClan, key: 'discord_team_sync_enabled', value: 'true' },
    { clanId: hostClan, key: 'discord_guild_id', value: 'host-guild' },
    { clanId: hostClan, key: 'discord_guild_verified_id', value: 'host-guild' },
    { clanId: hostClan, key: 'discord_bingo_role_id', value: 'host-role' },
    { clanId: guestClan, key: 'discord_guild_id', value: 'guest-guild' },
    { clanId: guestClan, key: 'discord_guild_verified_id', value: 'guest-guild' },
    { clanId: guestClan, key: 'discord_bingo_role_id', value: 'guest-role' },
    { clanId: guestClan, key: 'discord_cohost_role_sync_enabled', value: 'true' },
    // Even an opted-in clan is excluded until its co-host invitation is accepted.
    { clanId: pendingClan, key: 'discord_guild_id', value: 'pending-guild' },
    { clanId: pendingClan, key: 'discord_guild_verified_id', value: 'pending-guild' },
    { clanId: pendingClan, key: 'discord_bingo_role_id', value: 'pending-role' },
    { clanId: pendingClan, key: 'discord_cohost_role_sync_enabled', value: 'true' },
  ]);

  const [person] = await db.insert(s.players).values({ displayName: 'Role Tester' }).returning();
  const [user] = await db
    .insert(s.users)
    .values({ displayName: 'Role Tester', playerId: person.id, discordId: 'discord-user-1' })
    .returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Role Tester', rsnNormalized: 'role tester' })
    .returning();
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: hostClan, accountId: account.id, kind: 'member' })
    .returning();
  await db.insert(s.eventSignups).values({
    eventId,
    userId: user.id,
    clanMemberId: seat.id,
    status: 'approved',
  });

  posts.length = 0;
  const { assignBingoRoleToApprovedSignups } = await import('../src/lib/discord-teams.ts');
  const report = await assignBingoRoleToApprovedSignups(eventId);
  assert.equal(report.ok, true);
  assert.deepEqual(
    posts.map((p) => p.url).sort(),
    [
      'https://discord.com/api/v10/guilds/guest-guild/members/discord-user-1/roles/guest-role',
      'https://discord.com/api/v10/guilds/host-guild/members/discord-user-1/roles/host-role',
    ],
  );
  assert.equal(report.roleServers?.length, 2);
  assert.equal(posts.some((p) => p.url.includes('pending-guild')), false);
});
