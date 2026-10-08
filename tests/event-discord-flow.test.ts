// Event Discord servers for co-hosted events, end to end against a fake Discord.
//
// Pins the promises the feature makes: a separate server only for co-hosted events, only bound by
// someone who manages it, never re-pointed once built; one role per team with shared channels only
// those roles can see; planning made in each clan's OWN server with its own bot; players already in
// get their role, the rest get one DM that carries the verification code and never an invite; the
// invite only comes from the player's own page; and a join is noticed by the sweep.
//
// Run: npm run test:eventdiscordflow

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-discord-flow');
process.env.DISCORD_BOT_TOKEN = 'fake-bot-token';
delete process.env.DISCORD_TOKEN_KEY; // auto-join off: everyone takes the invite path

const EVENT_GUILD = '111111111111111111';
const COHOST_GUILD = '222222222222222222';

// ── Fake Discord ─────────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake request bodies are arbitrary JSON
type Body = any;
interface Call { method: string; path: string; body: Body }
const calls: Call[] = [];
const inGuild = new Map<string, Set<string>>([
  [EVENT_GUILD, new Set(['u-host-player'])],
  [COHOST_GUILD, new Set(['u-cohost-player'])],
]);
let nextId = 1000;
const realFetch = globalThis.fetch;

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeDiscord(method: string, path: string, body: Body): Response {
  let m: RegExpMatchArray | null;
  if (method === 'GET' && path === '/users/@me') return json(200, { id: 'bot-1' });
  if (method === 'GET' && (m = path.match(/^\/guilds\/(\d+)$/))) {
    return json(200, { id: m[1], name: m[1] === EVENT_GUILD ? 'AFK Spot x LFL' : 'LFL', icon: null, owner_id: 'u-host-admin' });
  }
  if (method === 'GET' && (m = path.match(/^\/guilds\/(\d+)\/members\/bot-1$/))) return json(200, { roles: ['bot-role'] });
  if (method === 'GET' && (m = path.match(/^\/guilds\/(\d+)\/roles$/))) {
    return json(200, [{ id: m[1], permissions: '0' }, { id: 'bot-role', permissions: String(1 << 3) }]);
  }
  if (method === 'GET' && (m = path.match(/^\/guilds\/(\d+)\/members\/(.+)$/))) {
    return inGuild.get(m[1])?.has(m[2]) ? json(200, { roles: [] }) : json(404, { code: 10007 });
  }
  if (method === 'POST' && /^\/guilds\/\d+\/roles$/.test(path)) return json(200, { id: `role-${nextId++}` });
  if (method === 'POST' && /^\/guilds\/\d+\/channels$/.test(path)) return json(200, { id: `ch-${nextId++}` });
  if (method === 'PUT' && /^\/channels\/[^/]+\/permissions\//.test(path)) return json(204, null);
  if (method === 'PUT' && (m = path.match(/^\/guilds\/(\d+)\/members\/([^/]+)$/))) {
    // guilds.join: only with the player's own token.
    if (body?.access_token !== 'player-access-token') return json(403, { code: 50025 });
    const set = inGuild.get(m[1])!;
    if (set.has(m[2])) return json(204, null);
    set.add(m[2]);
    return json(201, { user: { id: m[2] } });
  }
  if (method === 'PUT' && (m = path.match(/^\/guilds\/(\d+)\/members\/([^/]+)\/roles\/[^/]+$/))) {
    return inGuild.get(m[1])?.has(m[2]) ? json(204, null) : json(404, { code: 10007, message: 'Unknown Member' });
  }
  if (method === 'POST' && path === '/users/@me/channels') return json(200, { id: `dm-${body.recipient_id}` });
  if (method === 'POST' && /^\/channels\/dm-[^/]+\/messages$/.test(path)) return json(200, { id: 'msg' });
  if (method === 'POST' && /^\/channels\/[^/]+\/invites$/.test(path)) {
    return json(200, { code: 'abcInvite', expires_at: new Date(Date.now() + 86_400_000).toISOString() });
  }
  if (method === 'DELETE') return json(204, null);
  if (method === 'PATCH') return json(200, { id: path.split('/').pop() });
  return json(500, { message: `fake discord: unhandled ${method} ${path}` });
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('https://discord.com/api/v10')) return realFetch(input, init);
  const path = url.slice('https://discord.com/api/v10'.length);
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ method, path, body });
  return fakeDiscord(method, path, body);
}) as typeof fetch;

// ── Seed ─────────────────────────────────────────────────────────────────────────────────────────
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let E: typeof import('../src/lib/eventDiscord.ts');
let hostClan: number;
let cohostClan: number;
let eventId: number;
let hostAdminUser: number;
let cohostAdminUser: number;
let cohostPlayerUser: number;
let cohostRowId: number;

async function person(name: string, discordId: string) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const [u] = await db.insert(s.users).values({ playerId: p.id, displayName: name, discordId }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  return { playerId: p.id, userId: u.id, accountId: a.id };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  E = await import('../src/lib/eventDiscord.ts');

  [{ id: hostClan }] = await db.insert(s.clans).values({ slug: 'afkspot', name: 'AFK Spot' }).returning();
  [{ id: cohostClan }] = await db.insert(s.clans).values({ slug: 'lfl', name: 'LFL' }).returning();
  // The co-host's own verified server, for planning.
  await db.insert(s.settings).values([
    { clanId: cohostClan, key: 'discord_guild_id', value: COHOST_GUILD },
    { clanId: cohostClan, key: 'discord_guild_verified_id', value: COHOST_GUILD },
  ]);

  hostAdminUser = (await person('Host Admin', 'u-host-admin')).userId;
  cohostAdminUser = (await person('Cohost Admin', 'u-cohost-admin')).userId;
  const hp = await person('Host Player', 'u-host-player');
  const cp = await person('Cohost Player', 'u-cohost-player');
  cohostPlayerUser = cp.userId;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: hostClan, name: 'Clan Wars discord.gg/scam', boardSize: 5, teamFormation: 'per_clan' })
    .returning();
  eventId = ev.id;
  const [hostTeam] = await db.insert(s.teams).values({ eventId, name: 'AFK Spot', color: '#ff0000', clanId: hostClan }).returning();
  const [cohostTeam] = await db.insert(s.teams).values({ eventId, name: 'LFL', color: '#0000ff', clanId: cohostClan }).returning();
  const [cohostRow] = await db
    .insert(s.eventCohosts)
    .values({ eventId, clanId: cohostClan, status: 'pending', teamId: cohostTeam.id })
    .returning();
  cohostRowId = cohostRow.id;

  const [hs] = await db.insert(s.clanMemberships).values({ clanId: hostClan, accountId: hp.accountId, kind: 'member' }).returning();
  const [cs] = await db.insert(s.clanMemberships).values({ clanId: cohostClan, accountId: cp.accountId, kind: 'member' }).returning();
  await db.insert(s.eventParticipants).values([
    { eventId, teamId: hostTeam.id, clanMemberId: hs.id, accountId: hp.accountId, name: 'Host Player' },
    { eventId, teamId: cohostTeam.id, clanMemberId: cs.id, accountId: cp.accountId, name: 'Cohost Player' },
  ]);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool?.end();
  await dropDatabase(DB);
});

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────
test('a separate server is only for co-hosted events', async () => {
  const r = await E.configureEventServer({ eventId, actorClanId: hostClan, actorUserId: hostAdminUser, layout: 'joint', guildId: EVENT_GUILD });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /co-hosted/);
  await db.update(s.eventCohosts).set({ status: 'accepted' }).where(eq(s.eventCohosts.id, cohostRowId));
});

test('binding needs someone who manages the server', async () => {
  // The fake says u-host-admin owns it; the co-host admin is not even a member.
  const r = await E.configureEventServer({ eventId, actorClanId: cohostClan, actorUserId: cohostAdminUser, layout: 'joint', guildId: EVENT_GUILD });
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  const strangerClan = (await db.insert(s.clans).values({ slug: 'nope', name: 'Nope' }).returning())[0].id;
  const r2 = await E.configureEventServer({ eventId, actorClanId: strangerClan, actorUserId: hostAdminUser, layout: 'joint', guildId: EVENT_GUILD });
  assert.equal(r2.status, 403, 'a clan not running the event cannot touch it');
});

test('the host binds a joint server', async () => {
  const r = await E.configureEventServer({ eventId, actorClanId: hostClan, actorUserId: hostAdminUser, layout: 'joint', guildId: EVENT_GUILD });
  assert.deepEqual(r, { ok: true });
  const ev = await db.query.events.findFirst({ where: eq(s.events.id, eventId) });
  assert.equal(ev?.discordLayout, 'joint');
  assert.equal(ev?.eventGuildClanId, hostClan);
});

test('joint: one role per team, shared text + voice only those roles can see, no private channels', async () => {
  calls.length = 0;
  const r = await E.provisionEventServer(eventId);
  assert.ok(r.ok, r.error);
  assert.equal(r.rolesCreated, 2);
  const roleCreates = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/roles'));
  assert.ok(roleCreates.every((c) => c.body.permissions === '0'), 'team roles grant nothing server-wide');
  const channels = calls.filter((c) => c.method === 'POST' && c.path === `/guilds/${EVENT_GUILD}/channels`);
  assert.deepEqual(channels.map((c) => c.body.type).sort(), [0, 2, 4], 'category + shared text + shared voice only');
  const ev = await db.query.events.findFirst({ where: eq(s.events.id, eventId) });
  const resources = await db.select().from(s.teamDiscordResources);
  const roleIds = resources.map((x) => x.roleId).sort();
  for (const shared of channels.filter((c) => c.body.type !== 4)) {
    const ow = shared.body.permission_overwrites as { id: string; type: number; allow?: string; deny?: string }[];
    assert.ok(ow.some((o) => o.id === EVENT_GUILD && o.deny), '@everyone denied');
    assert.deepEqual(ow.filter((o) => o.type === 0 && o.allow).map((o) => o.id).sort(), roleIds);
  }
  assert.ok(ev?.eventGuildTextChannelId && ev.eventGuildVoiceChannelId);
});

test('players already in get their role; the rest get ONE DM with the code and no invite', async () => {
  calls.length = 0;
  const r = await E.syncEventServerMembers(eventId);
  assert.ok(r.ok, r.error);
  assert.equal(r.joined, 1);
  assert.equal(r.dmSent, 1);
  const dm = calls.find((c) => c.path === '/channels/dm-u-cohost-player/messages');
  assert.ok(dm);
  const text = JSON.stringify(dm!.body);
  assert.ok(!/discord\.gg|discord\.com\/invite/i.test(text), 'never an invite in a DM');
  const row = await db.query.eventDiscordMembers.findFirst({ where: eq(s.eventDiscordMembers.discordId, 'u-cohost-player') });
  assert.ok(text.includes(row!.joinCode));
  assert.ok(text.includes('lfl.'), 'links to the player’s own clan site');

  // Re-running does not DM again.
  calls.length = 0;
  await E.syncEventServerMembers(eventId);
  assert.equal(calls.filter((c) => c.path === '/users/@me/channels').length, 0);
});

test('the invite comes only from the player’s own page, and the sweep notices the join', async () => {
  const view = await E.playerJoinView(eventId, cohostPlayerUser);
  assert.equal(view.available, true);
  assert.equal(view.status, 'pending');
  assert.equal(view.server?.name, 'AFK Spot x LFL');
  assert.equal((await E.playerJoinView(eventId, cohostAdminUser)).available, false, 'nobody else’s row');

  const inv = await E.playerInvite(eventId, cohostPlayerUser);
  assert.equal(inv.url, 'https://discord.gg/abcInvite');
  const invCall = calls.filter((c) => c.path.endsWith('/invites')).pop();
  assert.equal(invCall?.body.max_uses, 1);

  inGuild.get(EVENT_GUILD)!.add('u-cohost-player');
  assert.equal(await E.recheckPendingEventServerMembers(), 1);
  const row = await db.query.eventDiscordMembers.findFirst({ where: eq(s.eventDiscordMembers.discordId, 'u-cohost-player') });
  assert.equal(row?.status, 'joined');
  assert.equal(row?.method, 'invite');
});

test('planning goes in the co-host’s OWN server, made with its own bot', async () => {
  calls.length = 0;
  const r = await E.provisionClanPlanning(eventId, cohostClan);
  assert.ok(r.ok, r.error);
  assert.equal(r.membersAssigned, 1);
  assert.ok(calls.filter((c) => c.method === 'POST' && c.path.startsWith('/guilds/')).every((c) => c.path.startsWith(`/guilds/${COHOST_GUILD}/`)));
  const planning = await db.select().from(s.teamDiscordResources).where(and(eq(s.teamDiscordResources.purpose, 'planning')));
  assert.equal(planning.length, 1);
  assert.equal(planning[0].guildId, COHOST_GUILD);
  assert.equal(planning[0].clanId, cohostClan);
  assert.ok(planning[0].textChannelId && planning[0].voiceChannelId);
  // The host has no server connected, so it cannot plan anywhere.
  assert.equal((await E.provisionClanPlanning(eventId, hostClan)).ok, false);
});

test('a built server cannot be re-pointed until it is torn down', async () => {
  const r = await E.configureEventServer({ eventId, actorClanId: hostClan, actorUserId: hostAdminUser, layout: 'single', guildId: EVENT_GUILD });
  assert.equal(r.status, 409);
  const t = await E.teardownEventServer(eventId);
  assert.ok(t.ok, t.error);
  assert.equal((await db.select().from(s.eventDiscordMembers)).length, 0);
  const r2 = await E.configureEventServer({ eventId, actorClanId: hostClan, actorUserId: hostAdminUser, layout: 'single', guildId: EVENT_GUILD });
  assert.deepEqual(r2, { ok: true });
  // The co-host's planning is the co-host's to remove.
  const tp = await E.teardownClanPlanning(eventId, cohostClan);
  assert.ok(tp.ok, tp.error);
});

test('single: each team also gets private planning channels in the one server', async () => {
  calls.length = 0;
  const r = await E.provisionEventServer(eventId);
  assert.ok(r.ok, r.error);
  const types = calls.filter((c) => c.method === 'POST' && c.path === `/guilds/${EVENT_GUILD}/channels`).map((c) => c.body.type);
  // category + 2 teams × (text + voice) + shared text + shared voice
  assert.equal(types.length, 7);
});

test('opted-in players are added straight away with their team role; the grant is stored encrypted', async () => {
  process.env.DISCORD_TOKEN_KEY = 'k'.repeat(40);
  const T = await import('../src/lib/discordUserTokens.ts');
  inGuild.get(EVENT_GUILD)!.delete('u-cohost-player');
  const stored = await T.storeJoinGrant(cohostPlayerUser, {
    accessToken: 'player-access-token',
    refreshToken: 'player-refresh-token',
    expiresIn: 3600,
    scope: 'identify email guilds.join',
  });
  assert.equal(stored, true);
  const row = await db.query.userDiscordTokens.findFirst({ where: eq(s.userDiscordTokens.userId, cohostPlayerUser) });
  assert.ok(row && !row.accessToken.includes('player-access-token') && row.accessToken.startsWith('enc1:'));
  // A plain login (no guilds.join) stores nothing.
  assert.equal(await T.storeJoinGrant(hostAdminUser, { accessToken: 'x', refreshToken: null, expiresIn: 60, scope: 'identify email' }), false);

  calls.length = 0;
  const r = await E.syncEventServerMembers(eventId);
  assert.ok(r.ok, r.error);
  assert.equal(r.autoJoined, 1);
  assert.equal(r.dmSent, 0, 'nothing is sent to someone added automatically');
  const join = calls.find((c) => c.method === 'PUT' && c.path === `/guilds/${EVENT_GUILD}/members/u-cohost-player`);
  assert.equal(join?.body.access_token, 'player-access-token');
  assert.equal(join?.body.roles.length, 1);
  delete process.env.DISCORD_TOKEN_KEY;
});

test('a rename follows the team into the event server, and into planning only with that clan’s consent', async () => {
  const lfl = (await db.query.teams.findFirst({ where: and(eq(s.teams.eventId, eventId), eq(s.teams.clanId, cohostClan)) }))!;
  await db.update(s.teams).set({ name: 'LFL Legends', color: '#00ff00' }).where(eq(s.teams.id, lfl.id));
  // A planning row in the co-host's own server (built while the event was joint).
  await db.insert(s.teamDiscordResources).values({
    teamId: lfl.id, clanId: cohostClan, guildId: COHOST_GUILD, purpose: 'planning',
    roleId: 'plan-role', textChannelId: 'plan-text', voiceChannelId: 'plan-voice',
  });

  calls.length = 0;
  const byHost = await E.updateTeamEventDiscordIdentity(lfl.id, hostClan);
  assert.deepEqual(byHost, { updated: 1, skipped: 1, failed: 0 }, 'event server yes; co-host planning not without consent');
  const patches = calls.filter((c) => c.method === 'PATCH');
  assert.ok(patches.every((c) => !c.path.includes('plan-')), 'never touched the co-host’s server');
  const ev = (await db.select().from(s.teamDiscordResources).where(and(eq(s.teamDiscordResources.teamId, lfl.id), eq(s.teamDiscordResources.purpose, 'event'))))[0];
  assert.deepEqual(patches.find((c) => c.path.endsWith(`/roles/${ev.roleId}`))?.body, { name: 'LFL Legends', color: 0x00ff00 });
  assert.equal(patches.find((c) => c.path === `/channels/${ev.textChannelId}`)?.body.name, 'lfl-legends-planning');
  assert.equal(patches.find((c) => c.path === `/channels/${ev.voiceChannelId}`)?.body.name, 'LFL Legends planning');

  // The team's own clan renaming it (its captain) updates its own planning.
  calls.length = 0;
  assert.deepEqual(await E.updateTeamEventDiscordIdentity(lfl.id, cohostClan), { updated: 2, skipped: 0, failed: 0 });
  assert.ok(calls.some((c) => c.method === 'PATCH' && c.path === `/guilds/${COHOST_GUILD}/roles/plan-role`));

  // Or anyone, once that clan switched team sync on.
  await db.insert(s.settings).values({ clanId: cohostClan, key: 'discord_team_sync_enabled', value: 'true' });
  assert.deepEqual(await E.updateTeamEventDiscordIdentity(lfl.id, hostClan), { updated: 2, skipped: 0, failed: 0 });
});

test('with no DISCORD_TOKEN_KEY, allowing auto-join still adds the player right then, and stores nothing', async () => {
  delete process.env.DISCORD_TOKEN_KEY;
  await db.delete(s.userDiscordTokens);
  inGuild.get(EVENT_GUILD)!.delete('u-cohost-player');
  await db
    .update(s.eventDiscordMembers)
    .set({ status: 'pending', method: null })
    .where(eq(s.eventDiscordMembers.discordId, 'u-cohost-player'));

  assert.equal(await E.joinPendingEventServersNow('u-cohost-player', 'player-access-token'), 1);
  const row = await db.query.eventDiscordMembers.findFirst({ where: eq(s.eventDiscordMembers.discordId, 'u-cohost-player') });
  assert.equal(row?.status, 'joined');
  assert.equal(row?.method, 'auto');
  assert.equal((await db.select().from(s.userDiscordTokens)).length, 0);
  // A token for someone else's account is refused by Discord and changes nothing.
  assert.equal(await E.joinPendingEventServersNow('u-host-player', 'wrong-token'), 0);
});

test('an operator acting as the co-host’s admin can author the co-hosted board; an expired grant can’t', async () => {
  const { cohostBoardEventIds } = await import('../src/lib/eventEditors.ts');
  await db.update(s.eventCohosts).set({ staffCanEditBoard: true }).where(eq(s.eventCohosts.id, cohostRowId));
  const [grant] = await db
    .insert(s.platformActAs)
    .values({ clanId: cohostClan, userId: hostAdminUser, role: 'admin', reason: 'test', expiresAt: new Date(Date.now() + 3600_000).toISOString() })
    .returning();
  assert.deepEqual(await cohostBoardEventIds(hostAdminUser, { eventId }), [eventId]);
  await db.update(s.platformActAs).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(s.platformActAs.id, grant.id));
  assert.deepEqual(await cohostBoardEventIds(hostAdminUser, { eventId }), []);
});

test('the co-host’s panel offers its own contestant role tools; the host’s does not', async () => {
  const cohost = await E.adminStatus(eventId, cohostClan);
  assert.equal(cohost?.role, 'cohost');
  assert.deepEqual(cohost?.cohostRole, { ready: false }, 'not switched on under Integrations yet');
  assert.equal((await E.adminStatus(eventId, hostClan))?.cohostRole, null);
});
