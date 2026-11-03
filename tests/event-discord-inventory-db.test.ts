// The event Discord tab's inventory against a fake Discord: every stored id is checked live, "Create
// missing" remakes only what Discord confirmed is gone (and re-grants a remade role onto surviving
// channels), and deletes touch only ids Anvil stored — one at a time or all at once.
//
// Run: npx tsx --test tests/event-discord-inventory-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event_discord_inventory');
const GUILD = 'inv-guild';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let eventId: number;
let otherEventId: number;
let teamA: number;
let teamB: number;
let otherTeam: number;

const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
const roles = new Set(['role-a', 'player-role']);
// Channel id -> HTTP status for GET /channels/{id}.
const channels = new Map<string, number>([
  ['cat', 200],
  ['text-a', 200],
  ['voice-a', 403],
  ['text-b', 404],
  ['voice-b', 200],
  ['other-text', 200],
]);
let nextId = 1;
const realFetch = globalThis.fetch;
const realBotToken = process.env.DISCORD_BOT_TOKEN;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  process.env.DISCORD_BOT_TOKEN = 'inventory-test-token';

  const [clan] = await db.insert(s.clans).values({ slug: 'inv', name: 'Inventory Clan' }).returning();
  await db.insert(s.settings).values([
    { clanId: clan.id, key: 'discord_team_sync_enabled', value: 'true' },
    { clanId: clan.id, key: 'discord_guild_id', value: GUILD },
    { clanId: clan.id, key: 'discord_guild_verified_id', value: GUILD },
    { clanId: clan.id, key: 'discord_bingo_role_id', value: 'player-role' },
  ]);
  const mkEvent = async (name: string, categoryId: string | null) =>
    (
      await db
        .insert(s.events)
        .values({ clanId: clan.id, name, boardSize: 5, startDate: '2020-01-01T00:00:00.000Z', endDate: '2099-01-01T00:00:00.000Z', discordCategoryId: categoryId })
        .returning()
    )[0].id;
  eventId = await mkEvent('Rumble', 'cat');
  otherEventId = await mkEvent('Other', null);
  [{ id: teamA }, { id: teamB }, { id: otherTeam }] = await db
    .insert(s.teams)
    .values([
      { eventId, name: 'Team A', color: '#ff0000', discordRoleId: 'role-a', discordTextChannelId: 'text-a', discordVoiceChannelId: 'voice-a' },
      // Role and text channel deleted by hand in Discord; the voice channel survived.
      { eventId, name: 'Team B', color: '#00ff00', discordRoleId: 'role-b', discordTextChannelId: 'text-b', discordVoiceChannelId: 'voice-b' },
      { eventId: otherEventId, name: 'Other', color: '#0000ff', discordTextChannelId: 'other-text' },
    ])
    .returning({ id: s.teams.id });

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace(/^\/api\/v10/, '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path, body: JSON.parse(String(init?.body ?? '{}')) });
    let m: RegExpMatchArray | null;
    if (path === '/users/@me') return Response.json({ id: 'bot-user' });
    if (method === 'GET' && path === `/guilds/${GUILD}/roles`) {
      return Response.json([...roles].map((id) => ({ id, name: `name-${id}`, managed: false, permissions: '0' })));
    }
    if (method === 'GET' && (m = path.match(/^\/channels\/([^/]+)$/))) {
      const status = channels.get(m[1]) ?? 404;
      return status === 200 ? Response.json({ id: m[1], name: `name-${m[1]}`, guild_id: GUILD }) : Response.json({ code: 0 }, { status });
    }
    if (method === 'POST' && path === `/guilds/${GUILD}/roles`) {
      const id = `new-role-${nextId++}`;
      roles.add(id);
      return Response.json({ id, name: 'new', permissions: '0' });
    }
    if (method === 'POST' && path === `/guilds/${GUILD}/channels`) {
      const id = `new-ch-${nextId++}`;
      channels.set(id, 200);
      return Response.json({ id });
    }
    if (method === 'DELETE' && (m = path.match(/^\/channels\/([^/]+)$/))) {
      // The bot cannot see voice-a, so it cannot delete it either.
      if (m[1] === 'voice-a') return Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 });
      channels.delete(m[1]);
      return new Response(null, { status: 204 });
    }
    if (method === 'DELETE' && (m = path.match(/^\/guilds\/[^/]+\/roles\/([^/]+)$/))) {
      roles.delete(m[1]);
      return new Response(null, { status: 204 });
    }
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

const teamRow = async (id: number) => (await db.select().from(s.teams).where(eq(s.teams.id, id)))[0];

test('inventory: each stored id is checked live — exists, deleted, or hidden from the bot', async () => {
  const { inspectTeamDiscord } = await import('../src/lib/discord-teams.ts');
  const inv = await inspectTeamDiscord(eventId);
  assert.ok(inv);
  assert.equal(inv.connected, true);
  assert.equal(inv.category.status, 'exists');
  assert.equal(inv.playerRole.status, 'exists');
  assert.equal(inv.playerRole.name, 'name-player-role');
  const [a, b] = inv.teams;
  assert.deepEqual([a.role.status, a.text.status, a.voice.status], ['exists', 'exists', 'no-access']);
  assert.deepEqual([b.role.status, b.text.status, b.voice.status], ['missing', 'missing', 'exists']);
  assert.equal(a.text.name, 'name-text-a');
});

test('create missing: remakes only what Discord confirmed gone, and re-grants the new role on the survivor', async () => {
  const { createMissingTeamDiscord } = await import('../src/lib/discord-teams.ts');
  calls.length = 0;
  const r = await createMissingTeamDiscord(eventId);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.forgotten, 2);
  assert.equal(r.playerRoleCreated, false);
  assert.ok(!calls.some((c) => c.method === 'DELETE'), 'create never deletes');

  const a = await teamRow(teamA);
  assert.deepEqual([a.discordRoleId, a.discordTextChannelId, a.discordVoiceChannelId], ['role-a', 'text-a', 'voice-a']);
  const b = await teamRow(teamB);
  assert.match(b.discordRoleId ?? '', /^new-role-/);
  assert.match(b.discordTextChannelId ?? '', /^new-ch-/);
  assert.equal(b.discordVoiceChannelId, 'voice-b');
  assert.equal(r.regranted, 1);
  const grant = calls.find((c) => c.method === 'PUT' && c.path === `/channels/voice-b/permissions/${b.discordRoleId}`);
  assert.ok(grant, 'surviving voice channel opened to the remade role');
});

test('delete one: only that team’s stored item, and never a team from another event', async () => {
  const { teardownOneTeamDiscord } = await import('../src/lib/discord-teams.ts');
  const r = await teardownOneTeamDiscord(eventId, teamA, 'text');
  assert.deepEqual(r, { ok: true, deleted: true });
  const a = await teamRow(teamA);
  assert.equal(a.discordTextChannelId, null);
  assert.equal(a.discordRoleId, 'role-a');

  calls.length = 0;
  const foreign = await teardownOneTeamDiscord(eventId, otherTeam, 'text');
  assert.equal(foreign.ok, false);
  assert.equal(calls.filter((c) => c.method === 'DELETE').length, 0);
  assert.equal((await teamRow(otherTeam)).discordTextChannelId, 'other-text');
});

test('delete all: every stored id goes; a refused delete keeps its id for a retry', async () => {
  const { teardownTeamDiscord } = await import('../src/lib/discord-teams.ts');
  const r = await teardownTeamDiscord(eventId);
  assert.equal(r.ok, true);
  assert.equal(r.channelsFailed, 1);
  assert.equal(r.categoryDeleted, true);
  const a = await teamRow(teamA);
  assert.deepEqual([a.discordRoleId, a.discordTextChannelId, a.discordVoiceChannelId], [null, null, 'voice-a']);
  const b = await teamRow(teamB);
  assert.deepEqual([b.discordRoleId, b.discordTextChannelId, b.discordVoiceChannelId], [null, null, null]);
  // The clan's shared player role is never deleted.
  assert.ok(roles.has('player-role'));
  assert.equal((await teamRow(otherTeam)).discordTextChannelId, 'other-text');
});
