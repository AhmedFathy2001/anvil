// Creator entry gates against a real database, with Twitch and Discord mocked at fetch: entering a
// gated creator event, linking Twitch, the host's token refreshing (and breaking), the Discord role
// and booster checks through the bot, who is never gated, and that an ordinary clan ignores gates.
//
// Run: npm run test:gates   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('entry-gates');

process.env.TWITCH_CLIENT_ID = 'cid';
process.env.TWITCH_CLIENT_SECRET = 'csecret';
process.env.TWITCH_REDIRECT_URI = 'https://anvil.test/api/auth/twitch/callback';
process.env.TWITCH_TOKEN_KEY = 'test-key-'.padEnd(48, 'x');
process.env.DISCORD_BOT_TOKEN = 'bot-token';

const GUILD = '700000000000000001';
const ROLE = '700000000000000002';
const BROADCASTER = '4242';

// ── The fake internet ────────────────────────────────────────────────────────────────────────────

const net = {
  followers: new Set<string>(),
  subs: new Map<string, string>(),
  /** discord user id → member body; absent = Unknown Member. */
  members: new Map<string, { roles: string[]; premium_since: string | null }>(),
  /** The access token Helix accepts; anything else is a 401. */
  liveToken: 'host-at-1',
  /** What the token endpoint does with a refresh. */
  refresh: 'ok' as 'ok' | 'refused',
  refreshes: 0,
  helixCalls: 0,
  discordCalls: 0,
};

const realFetch = globalThis.fetch;
function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const auth = new Headers(init?.headers).get('authorization') ?? '';
  if (u.hostname === 'id.twitch.tv' && u.pathname === '/oauth2/token') {
    net.refreshes++;
    if (net.refresh === 'refused') return reply({ message: 'Invalid refresh token' }, 400);
    net.liveToken = `host-at-${net.refreshes + 1}`;
    return reply({ access_token: net.liveToken, refresh_token: `host-rt-${net.refreshes + 1}`, expires_in: 14400, scope: [] });
  }
  if (u.hostname === 'api.twitch.tv') {
    net.helixCalls++;
    if (auth !== `Bearer ${net.liveToken}`) return reply({ message: 'Invalid OAuth token' }, 401);
    const user = u.searchParams.get('user_id')!;
    assert.equal(u.searchParams.get('broadcaster_id'), BROADCASTER);
    if (u.pathname === '/helix/channels/followers') return reply({ data: net.followers.has(user) ? [{ user_id: user }] : [], total: 99 });
    if (u.pathname === '/helix/subscriptions') {
      const tier = net.subs.get(user);
      return reply({ data: tier ? [{ user_id: user, tier }] : [] });
    }
  }
  if (u.hostname === 'discord.com') {
    net.discordCalls++;
    assert.equal(auth, 'Bot bot-token');
    const m = /^\/api\/v10\/guilds\/(\d+)\/members\/(\d+)$/.exec(u.pathname);
    if (m && m[1] === GUILD) {
      const member = net.members.get(m[2]);
      return member ? reply({ user: { id: m[2] }, ...member }) : reply({ code: 10007, message: 'Unknown Member' }, 404);
    }
    if (u.pathname === `/api/v10/guilds/${GUILD}/roles`) return reply([{ id: GUILD, name: '@everyone', position: 0, managed: false, permissions: '0' }, { id: ROLE, name: 'Subs', position: 1, managed: true, permissions: '0' }]);
  }
  throw new Error(`unexpected fetch ${u.href}`);
}) as typeof fetch;

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let E: typeof import('../src/lib/eventEntry.ts');
let G: typeof import('../src/lib/entryGatesDb.ts');
let T: typeof import('../src/lib/twitch.ts');

let n = 0;
async function person(name: string) {
  n += 1;
  const discordId = `99400000000000${String(n).padStart(4, '0')}`;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId }).returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id, discordId };
}

let host: Awaited<ReturnType<typeof person>>;
let spaceId: number;

async function gatedEvent(name: string, gates: unknown, clanId = spaceId): Promise<number> {
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name, boardSize: 5, entry: 'open', entryGates: JSON.stringify(gates) })
    .returning();
  return ev.id;
}

const enter = (p: Awaited<ReturnType<typeof person>>, eventId: number) =>
  E.enterEvent({ eventId, playerId: p.playerId, accountId: p.accountId, actorUserId: p.userId });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  E = await import('../src/lib/eventEntry.ts');
  G = await import('../src/lib/entryGatesDb.ts');
  T = await import('../src/lib/twitch.ts');
  const C = await import('../src/lib/clanCreate.ts');

  host = await person('Streamer');
  const r = await C.createCreatorSpace({ slug: 'gated-streamer', name: 'Gated Streamer', ownerUserId: host.userId });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;

  // The host's channel, as the OAuth callback would store it — expiring in the future.
  await G.saveHostTwitchChannel({
    clanId: spaceId,
    userId: host.userId,
    cfg: T.twitchConfig()!,
    tokens: { accessToken: 'host-at-1', refreshToken: 'host-rt-1', expiresIn: 3600, scope: [...T.HOST_SCOPES] },
    user: { id: BROADCASTER, login: 'gatedstreamer', broadcasterType: 'affiliate' },
  });
  // The space's Discord server, verified as the bot-connect flow writes it.
  await db.insert(s.settings).values([
    { clanId: spaceId, key: 'discord_guild_id', value: GUILD },
    { clanId: spaceId, key: 'discord_guild_verified_id', value: GUILD },
  ]);
});

beforeEach(() => {
  // Each test reasons about its own calls; a cached pass from an earlier one would hide them.
  for (const k of [...Array(200).keys()]) G.gateCache.forgetUser(k);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

test('tokens are stored encrypted, never as given', async () => {
  const row = await db.query.clanTwitchChannels.findFirst({ where: eq(s.clanTwitchChannels.clanId, spaceId) });
  assert.ok(row!.accessToken.startsWith('enc1:') && !row!.accessToken.includes('host-at-1'));
  assert.ok(row!.refreshToken.startsWith('enc1:'));
  assert.deepEqual(await G.hostTwitchChannel(spaceId), { login: 'gatedstreamer', canHaveSubs: true, broken: false });
});

test('followers only: unlinked → link Twitch; linked, not following → follow; following → in', async () => {
  const ev = await gatedEvent('Followers Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const viewer = await person('Viewer One');

  const r1 = await enter(viewer, ev);
  assert.equal(r1.outcome, 'gated', JSON.stringify(r1));
  if (r1.outcome !== 'gated') return;
  assert.equal(r1.status, 403);
  assert.equal(r1.gate.linkTwitch, true);
  assert.deepEqual(r1.gate.steps, ['Link your Twitch account']);
  assert.equal(r1.gate.summary, 'Open to followers of gatedstreamer on Twitch.');

  assert.equal(await G.linkViewerTwitch(viewer.userId, { id: '5001', login: 'viewerone', broadcasterType: '' }), 'ok');
  const r2 = await enter(viewer, ev);
  assert.equal(r2.outcome, 'gated');
  if (r2.outcome === 'gated') {
    assert.deepEqual(r2.gate.steps, ['Follow gatedstreamer on Twitch']);
    assert.match(r2.error, /Follow gatedstreamer on Twitch, then try again\./);
  }

  net.followers.add('5001');
  // A clean "no" is only held for seconds; drop it rather than wait.
  G.gateCache.forgetUser(viewer.userId);
  const r3 = await enter(viewer, ev);
  assert.equal(r3.outcome, 'seated', JSON.stringify(r3));

  // The pass is cached: asking again costs Twitch nothing.
  const calls = net.helixCalls;
  const again = await G.entryGateVerdict({ eventId: ev, userId: viewer.userId, playerId: viewer.playerId });
  assert.deepEqual(again, { pass: true, via: 'twitch-follow' });
  assert.equal(net.helixCalls, calls);
});

test('one Twitch account cannot be linked to two Anvil logins', async () => {
  const a = await person('Alt A');
  const b = await person('Alt B');
  assert.equal(await G.linkViewerTwitch(a.userId, { id: '6001', login: 'shared', broadcasterType: '' }), 'ok');
  assert.equal(await G.linkViewerTwitch(b.userId, { id: '6001', login: 'shared', broadcasterType: '' }), 'taken');
  assert.equal(await G.linkViewerTwitch(a.userId, { id: '6001', login: 'renamed', broadcasterType: '' }), 'ok', 'relinking your own is fine');
  assert.equal((await G.viewerTwitch(a.userId))?.login, 'renamed');
  assert.equal(await G.viewerTwitch(b.userId), null);
});

test('subs at tier 2: a tier-1 sub is told to upgrade, a tier-2 sub gets in', async () => {
  const ev = await gatedEvent('Subs Bingo', { anyOf: [{ kind: 'twitch-sub', tier: 2 }] });
  const t1 = await person('Tier One');
  const t2 = await person('Tier Two');
  await G.linkViewerTwitch(t1.userId, { id: '7001', login: 't1', broadcasterType: '' });
  await G.linkViewerTwitch(t2.userId, { id: '7002', login: 't2', broadcasterType: '' });
  net.subs.set('7001', '1000');
  net.subs.set('7002', '2000');

  const r1 = await enter(t1, ev);
  assert.equal(r1.outcome, 'gated');
  if (r1.outcome === 'gated') assert.deepEqual(r1.gate.steps, ['Upgrade your gatedstreamer sub to tier 2']);
  assert.equal((await enter(t2, ev)).outcome, 'seated');
});

test('an expired host token is refreshed once and the new one stored', async () => {
  const ev = await gatedEvent('Refresh Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const v = await person('Refresh Viewer');
  await G.linkViewerTwitch(v.userId, { id: '8001', login: 'rv', broadcasterType: '' });
  net.followers.add('8001');
  await db
    .update(s.clanTwitchChannels)
    .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    .where(eq(s.clanTwitchChannels.clanId, spaceId));

  const before = net.refreshes;
  assert.equal((await enter(v, ev)).outcome, 'seated');
  assert.equal(net.refreshes, before + 1);
  const row = await db.query.clanTwitchChannels.findFirst({ where: eq(s.clanTwitchChannels.clanId, spaceId) });
  assert.ok(Date.parse(row!.expiresAt) > Date.now());
  assert.ok(!row!.accessToken.includes(net.liveToken), 'still encrypted');
});

test('a 401 from Helix triggers a refresh and one retry', async () => {
  const ev = await gatedEvent('Revoked Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const v = await person('Retry Viewer');
  await G.linkViewerTwitch(v.userId, { id: '8101', login: 'retry', broadcasterType: '' });
  net.followers.add('8101');
  // Twitch invalidated the stored access token early (password change, etc.).
  net.liveToken = 'rotated-elsewhere';
  const before = net.refreshes;
  assert.equal((await enter(v, ev)).outcome, 'seated');
  assert.equal(net.refreshes, before + 1);
});

test('a refused refresh marks the channel broken: everyone is turned away, and told it is the host’s move', async () => {
  const ev = await gatedEvent('Broken Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const v = await person('Broken Viewer');
  await G.linkViewerTwitch(v.userId, { id: '8201', login: 'bv', broadcasterType: '' });
  net.followers.add('8201');
  net.liveToken = 'nothing-matches';
  net.refresh = 'refused';
  try {
    const r = await enter(v, ev);
    assert.equal(r.outcome, 'gated');
    if (r.outcome === 'gated') {
      assert.deepEqual(r.gate.steps, ['The host’s Twitch connection isn’t working — let them know']);
      assert.equal(r.gate.transient, false);
    }
    assert.equal((await G.hostTwitchChannel(spaceId))?.broken, true);
  } finally {
    net.refresh = 'ok';
  }
  // Reconnecting clears it.
  await G.saveHostTwitchChannel({
    clanId: spaceId,
    userId: host.userId,
    cfg: T.twitchConfig()!,
    tokens: { accessToken: 'host-at-fresh', refreshToken: 'host-rt-fresh', expiresIn: 3600, scope: [...T.HOST_SCOPES] },
    user: { id: BROADCASTER, login: 'gatedstreamer', broadcasterType: 'affiliate' },
  });
  net.liveToken = 'host-at-fresh';
  G.gateCache.forgetUser(v.userId);
  assert.equal((await enter(v, ev)).outcome, 'seated');
});

test('Discord: role holders and boosters get in; others are told what to do', async () => {
  const ev = await gatedEvent('Discord Bingo', {
    anyOf: [
      { kind: 'discord-role', roleId: ROLE, roleName: 'Subs' },
      { kind: 'discord-booster' },
    ],
  });
  const roled = await person('Has Role');
  const booster = await person('Booster');
  const plain = await person('Plain Member');
  const outsider = await person('Not In Server');
  net.members.set(roled.discordId, { roles: [ROLE], premium_since: null });
  net.members.set(booster.discordId, { roles: [], premium_since: '2026-10-01T00:00:00.000Z' });
  net.members.set(plain.discordId, { roles: [], premium_since: null });

  assert.equal((await enter(roled, ev)).outcome, 'seated');
  assert.equal((await enter(booster, ev)).outcome, 'seated');

  const p = await enter(plain, ev);
  assert.equal(p.outcome, 'gated');
  if (p.outcome === 'gated') {
    assert.deepEqual(p.gate.steps, ['Get the Subs role in Gated Streamer’s Discord server', 'Boost Gated Streamer’s Discord server']);
  }
  const o = await enter(outsider, ev);
  if (o.outcome === 'gated') assert.deepEqual(o.gate.steps, ['Join Gated Streamer’s Discord server']);
  else assert.fail(JSON.stringify(o));
});

test('any-of across platforms: a Discord booster passes a followers-or-boosters event without Twitch', async () => {
  const ev = await gatedEvent('Mixed Bingo', { anyOf: [{ kind: 'twitch-follow' }, { kind: 'discord-booster' }] });
  const b = await person('Booster Only');
  net.members.set(b.discordId, { roles: [], premium_since: '2026-10-01T00:00:00.000Z' });
  assert.equal((await enter(b, ev)).outcome, 'seated');
});

test('staff and people the host invited by name are never gated', async () => {
  const ev = await gatedEvent('Staff Bingo', { anyOf: [{ kind: 'twitch-sub', tier: 3 }] });
  assert.equal(await G.entryGateVerdict({ eventId: ev, userId: host.userId, playerId: host.playerId }), null);

  const guest = await person('Invited Guest');
  await db.insert(s.eventInvites).values({ eventId: ev, playerId: guest.playerId });
  assert.equal(await G.entryGateVerdict({ eventId: ev, userId: guest.userId, playerId: guest.playerId }), null);
  assert.equal((await enter(guest, ev)).outcome, 'seated');
});

test('a seat from another event does not skip this event’s gate (the sign-up check)', async () => {
  const open = await gatedEvent('Open Bingo', null);
  const gated = await gatedEvent('Gated Later', { anyOf: [{ kind: 'twitch-follow' }] });
  const v = await person('Seated Elsewhere');
  assert.equal((await enter(v, open)).outcome, 'seated');
  // Seated in the space now, so entry calls them an insider — the sign-up route runs this instead.
  assert.equal((await enter(v, gated)).outcome, 'insider');
  const verdict = await G.entryGateVerdict({ eventId: gated, userId: v.userId, playerId: v.playerId });
  assert.equal(verdict?.pass, false);
});

test('an ordinary clan ignores the column; info for the join card makes no external call', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'real-clan', name: 'Real Clan', inGameName: 'Real Clan' }).returning();
  const ev = await gatedEvent('Clan Bingo', { anyOf: [{ kind: 'twitch-follow' }] }, clan.id);
  const v = await person('Clan Visitor');
  assert.equal(await G.entryGateVerdict({ eventId: ev, userId: v.userId, playerId: v.playerId }), null);
  assert.equal(await G.entryGateInfo(ev, v.userId), null);

  const creatorEv = await gatedEvent('Info Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const calls = net.helixCalls + net.discordCalls;
  const info = await G.entryGateInfo(creatorEv, v.userId);
  assert.deepEqual(info, {
    summary: 'Open to followers of gatedstreamer on Twitch.',
    usesTwitch: true,
    twitchLinked: null,
    twitchAvailable: true,
  });
  assert.equal(net.helixCalls + net.discordCalls, calls);
});

test('gate options: the space’s channel and its server’s roles (not @everyone)', async () => {
  const o = await G.gateOptions(spaceId);
  assert.equal(o.twitch.configured, true);
  assert.equal(o.twitch.channel?.login, 'gatedstreamer');
  assert.equal(o.twitch.connectUrl, `/api/auth/twitch/start?as=host&space=${spaceId}`);
  assert.equal(o.discord.connected, true);
  assert.deepEqual(o.discord.roles, [{ id: ROLE, name: 'Subs' }], 'a managed integration role is offered; @everyone is not');
});

// ── One Twitch account, one player per event ────────────────────────────────────────────────────

const claimOf = async (eventId: number, twitchUserId: string) =>
  db.query.eventTwitchClaims.findFirst({
    where: and(eq(s.eventTwitchClaims.eventId, eventId), eq(s.eventTwitchClaims.twitchUserId, twitchUserId)),
  });

test('link → join → unlink → relink on another login → join is refused; the first player can come back', async () => {
  const ev = await gatedEvent('Relink Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const a = await person('Sub Owner');
  const b = await person('Alt Login');
  net.followers.add('9001');

  await G.linkViewerTwitch(a.userId, { id: '9001', login: 'onesub', broadcasterType: '' });
  assert.equal((await enter(a, ev)).outcome, 'seated');
  assert.equal((await claimOf(ev, '9001'))?.userId, a.userId);

  await G.unlinkViewerTwitch(a.userId);
  assert.equal(await G.linkViewerTwitch(b.userId, { id: '9001', login: 'onesub', broadcasterType: '' }), 'ok');
  const r = await enter(b, ev);
  assert.equal(r.outcome, 'gated', JSON.stringify(r));
  if (r.outcome === 'gated') {
    assert.equal(r.error, 'That Twitch account was already used to join this event by another player.');
    assert.equal(r.gate.blocked, true);
    assert.equal(r.status, 403);
  }
  // The sign-up check refuses it too.
  const v = await G.entryGateVerdict({ eventId: ev, userId: b.userId, playerId: b.playerId });
  assert.equal(v?.pass, false);
  assert.equal((await claimOf(ev, '9001'))?.userId, a.userId, 'the claim did not move');

  // A Twitch pass on ANOTHER event is a separate claim.
  const other = await gatedEvent('Relink Other', { anyOf: [{ kind: 'twitch-follow' }] });
  assert.equal((await enter(b, other)).outcome, 'seated');

  // The original player relinks and re-enters / signs up: still theirs.
  await G.unlinkViewerTwitch(b.userId);
  await G.linkViewerTwitch(a.userId, { id: '9001', login: 'onesub', broadcasterType: '' });
  assert.deepEqual(await G.entryGateVerdict({ eventId: ev, userId: a.userId, playerId: a.playerId }), { pass: true, via: 'twitch-follow' });
});

test('a claim moves only once its holder has left the event and the hold has passed', async () => {
  const ev = await gatedEvent('Moving Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const a = await person('Leaver');
  const b = await person('Next Owner');
  net.followers.add('9101');
  await G.linkViewerTwitch(a.userId, { id: '9101', login: 'mover', broadcasterType: '' });
  assert.equal((await enter(a, ev)).outcome, 'seated');
  await G.unlinkViewerTwitch(a.userId);
  await G.linkViewerTwitch(b.userId, { id: '9101', login: 'mover', broadcasterType: '' });

  // Seat gone but the claim is fresh: still held (it may be mid-join).
  await db.update(s.clanMemberships).set({ leftAt: new Date().toISOString() }).where(eq(s.clanMemberships.accountId, a.accountId));
  assert.equal(await G.claimTwitchForEvent({ eventId: ev, clanId: spaceId, twitchUserId: '9101', userId: b.userId }), 'taken');

  // Old, and the holder has no seat or sign-up: it moves.
  await db
    .update(s.eventTwitchClaims)
    .set({ claimedAt: new Date(Date.now() - G.CLAIM_HOLD_MS - 1000).toISOString() })
    .where(eq(s.eventTwitchClaims.eventId, ev));
  assert.equal((await enter(b, ev)).outcome, 'seated');
  assert.equal((await claimOf(ev, '9101'))?.userId, b.userId);
});

test('an old claim whose holder is still seated does not move', async () => {
  const ev = await gatedEvent('Holding Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const a = await person('Stayer');
  const b = await person('Hopeful');
  net.followers.add('9201');
  await G.linkViewerTwitch(a.userId, { id: '9201', login: 'stayer', broadcasterType: '' });
  assert.equal((await enter(a, ev)).outcome, 'seated');
  await db
    .update(s.eventTwitchClaims)
    .set({ claimedAt: new Date(Date.now() - G.CLAIM_HOLD_MS - 1000).toISOString() })
    .where(eq(s.eventTwitchClaims.eventId, ev));
  assert.equal(await G.claimTwitchForEvent({ eventId: ev, clanId: spaceId, twitchUserId: '9201', userId: b.userId }), 'taken');
});

test('racing claims for one Twitch account: exactly one login wins', async () => {
  const ev = await gatedEvent('Race Bingo', { anyOf: [{ kind: 'twitch-follow' }] });
  const racers = await Promise.all(['Racer A', 'Racer B', 'Racer C', 'Racer D'].map((nm) => person(nm)));
  const results = await Promise.all(
    racers.map((r) => G.claimTwitchForEvent({ eventId: ev, clanId: spaceId, twitchUserId: '9301', userId: r.userId })),
  );
  assert.equal(results.filter((x) => x === 'ok').length, 1, JSON.stringify(results));
  const rows = await db.query.eventTwitchClaims.findMany({ where: eq(s.eventTwitchClaims.eventId, ev) });
  assert.equal(rows.length, 1);
});

test('a Discord pass writes no Twitch claim', async () => {
  const ev = await gatedEvent('Discord Only', { anyOf: [{ kind: 'twitch-follow' }, { kind: 'discord-booster' }] });
  const b = await person('Boosting Unlinked');
  net.members.set(b.discordId, { roles: [], premium_since: '2026-10-01T00:00:00.000Z' });
  assert.equal((await enter(b, ev)).outcome, 'seated');
  assert.equal((await db.query.eventTwitchClaims.findMany({ where: eq(s.eventTwitchClaims.eventId, ev) })).length, 0);
});

test('only an admin of a creator space may connect its channel', async () => {
  const stranger = await person('Stranger');
  assert.equal(await G.isAdminOfCreatorSpace(spaceId, host.userId), true);
  assert.equal(await G.isAdminOfCreatorSpace(spaceId, stranger.userId), false);
  const clan = await db.query.clans.findFirst({ where: and(eq(s.clans.slug, 'real-clan')) });
  assert.equal(await G.isAdminOfCreatorSpace(clan!.id, host.userId), false);
});
