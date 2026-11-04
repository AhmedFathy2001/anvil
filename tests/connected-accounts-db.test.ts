// Connected accounts against a real database, with Twitch, Kick and Medal mocked at fetch: linking and
// unlinking each platform from settings, "taken" when another login has it, Kick linked in the
// official Anvil channel's chat (and that channel's chat subscription made with the app token), Medal
// verified by a code in a clip title, show-on-profile choices and who sees what, unlink cleanup
// (proofs, codes, claims on finished events — but not running ones), and the gate fast path: an
// account linked in settings passes a gated event's identity step with nothing to link again.
//
// Run: npm run test:connected-accounts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('connected-accounts');

process.env.TWITCH_CLIENT_ID = 'cid';
process.env.TWITCH_CLIENT_SECRET = 'csecret';
process.env.TWITCH_REDIRECT_URI = 'https://anvil.test/api/auth/twitch/callback';
process.env.TWITCH_TOKEN_KEY = 'test-key-'.padEnd(48, 'x');
process.env.KICK_CLIENT_ID = 'kcid';
process.env.KICK_CLIENT_SECRET = 'kcsecret';
process.env.KICK_REDIRECT_URI = 'https://anvil.test/api/auth/kick/callback';
process.env.KICK_TOKEN_KEY = 'kick-test-key-'.padEnd(48, 'x');
process.env.KICK_ANVIL_CHANNEL = 'anvil_osrs';
process.env.MEDAL_API_KEY = 'pub_testkey123';
delete process.env.KICK_ANVIL_BROADCASTER_ID;
delete process.env.KICK_BOT_REFRESH_TOKEN;

const TW_BROADCASTER = '4242';
const ANVIL_KICK = '1000';
const HOST_KICK = '2000';

// ── The fake internet ────────────────────────────────────────────────────────────────────────────

const net = {
  followers: new Set<string>(),
  anvilSubscribed: false,
  appSubscribePosts: 0,
  medalClips: [] as { contentTitle: string; credits: string }[],
  medalCalls: 0,
};

const realFetch = globalThis.fetch;
function reply(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const auth = new Headers(init?.headers).get('authorization') ?? '';
  if (u.hostname === 'api.twitch.tv' && u.pathname === '/helix/channels/followers') {
    if (auth !== 'Bearer tw-host-at') return reply({}, 401);
    const user = u.searchParams.get('user_id')!;
    return reply({ data: net.followers.has(user) ? [{ user_id: user }] : [] });
  }
  if (u.hostname === 'id.kick.com' && u.pathname === '/oauth/token') {
    const form = new URLSearchParams(String(init?.body));
    if (form.get('grant_type') === 'client_credentials') return reply({ access_token: 'kick-app', expires_in: 3600 });
    return reply({ error: 'no' }, 400);
  }
  if (u.hostname === 'api.kick.com') {
    if (u.pathname === '/public/v1/channels' && auth === 'Bearer kick-app') {
      const slugs = u.searchParams.getAll('slug');
      return reply({ data: slugs.includes('anvil_osrs') ? [{ broadcaster_user_id: Number(ANVIL_KICK), slug: 'anvil_osrs' }] : [] });
    }
    if (u.pathname === '/public/v1/channels' && auth === 'Bearer kick-host-at') {
      return reply({ data: [{ broadcaster_user_id: Number(HOST_KICK), slug: 'kickhost' }] });
    }
    if (u.pathname === '/public/v1/events/subscriptions') {
      if (auth === 'Bearer kick-app' && (init?.method ?? 'GET') === 'GET') {
        return reply({ data: net.anvilSubscribed ? [{ id: 's1', event: 'chat.message.sent', broadcaster_user_id: Number(ANVIL_KICK) }] : [] });
      }
      if (auth === 'Bearer kick-app' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        assert.equal(body.broadcaster_user_id, Number(ANVIL_KICK));
        assert.deepEqual(body.events, [{ name: 'chat.message.sent', version: 1 }]);
        net.appSubscribePosts++;
        net.anvilSubscribed = true;
        return reply({ data: [{ name: 'chat.message.sent', version: 1, subscription_id: 's1' }] });
      }
      if (auth === 'Bearer kick-host-at') return reply({ data: [{ name: 'chat.message.sent', version: 1, subscription_id: 'h1' }] });
    }
  }
  if (u.hostname === 'developers.medal.tv' && u.pathname === '/v1/latest') {
    net.medalCalls++;
    assert.equal(auth, 'pub_testkey123');
    return reply({ contentObjects: net.medalClips });
  }
  throw new Error(`unexpected fetch ${u.href}`);
}) as typeof fetch;

// ── Signed Kick webhooks ─────────────────────────────────────────────────────────────────────────

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
let msgN = 0;

function webhook(type: string, body: unknown) {
  const raw = JSON.stringify(body);
  const id = `01JCAM${String(++msgN).padStart(8, '0')}`;
  const ts = new Date().toISOString();
  const sig = crypto.sign('sha256', Buffer.from(`${id}.${ts}.${raw}`), privateKey).toString('base64');
  const headers = new Headers({
    'Kick-Event-Message-Id': id,
    'Kick-Event-Message-Timestamp': ts,
    'Kick-Event-Signature': sig,
    'Kick-Event-Type': type,
    'Kick-Event-Version': '1',
  });
  return { headers, raw };
}

function chatIn(broadcaster: string, senderId: number, name: string, content: string) {
  return {
    message_id: crypto.randomUUID(),
    broadcaster: { is_anonymous: false, user_id: Number(broadcaster), username: 'b', channel_slug: 'b', identity: null },
    sender: { is_anonymous: false, user_id: senderId, username: name, identity: { badges: [] } },
    content,
    created_at: new Date().toISOString(),
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let CA: typeof import('../src/lib/connectedAccounts.ts');
let G: typeof import('../src/lib/entryGatesDb.ts');
let E: typeof import('../src/lib/eventEntry.ts');
let K: typeof import('../src/lib/gates/kickDb.ts');
let KA: typeof import('../src/lib/gates/kickAnvilChannel.ts');
let W: typeof import('../src/lib/gates/kickWebhook.ts');
let YT: typeof import('../src/lib/gates/youtubeDb.ts');
let LIVE: typeof import('../src/lib/connectedLive.ts');

let n = 0;
async function person(name: string, linkPublicly = false) {
  n += 1;
  const discordId = `99600000000000${String(n).padStart(4, '0')}`;
  const [pl] = await db.insert(s.players).values({ displayName: name, linkAccountsPublicly: linkPublicly }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString(), shared: true })
    .returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId }).returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id };
}
type Person = Awaited<ReturnType<typeof person>>;

let host: Person;
let spaceId: number;

async function gatedEvent(name: string, gates: unknown, extra: Partial<typeof s.events.$inferInsert> = {}): Promise<number> {
  const [ev] = await db.insert(s.events).values({ clanId: spaceId, name, boardSize: 5, entry: 'open', entryGates: JSON.stringify(gates), ...extra }).returning();
  return ev.id;
}
const enter = (p: Person, eventId: number) => E.enterEvent({ eventId, playerId: p.playerId, accountId: p.accountId, actorUserId: p.userId });

/** Get a settings code for `p` and type it in `broadcaster`'s Kick chat as Kick user `kickId`. */
async function kickChatCode(p: Person, kickId: number, kickName: string, broadcaster = ANVIL_KICK) {
  const { code } = await K.issueKickCode(p.userId);
  const w = webhook('chat.message.sent', chatIn(broadcaster, kickId, kickName, `linking ${code}`));
  const r = await W.handleKickWebhook(w.headers, w.raw);
  assert.equal(r.status, 200, JSON.stringify(r));
  return K.kickCodeStatus(p.userId, code);
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  CA = await import('../src/lib/connectedAccounts.ts');
  G = await import('../src/lib/entryGatesDb.ts');
  E = await import('../src/lib/eventEntry.ts');
  K = await import('../src/lib/gates/kickDb.ts');
  KA = await import('../src/lib/gates/kickAnvilChannel.ts');
  W = await import('../src/lib/gates/kickWebhook.ts');
  YT = await import('../src/lib/gates/youtubeDb.ts');
  LIVE = await import('../src/lib/connectedLive.ts');
  W.setKickPublicKeyForTests(PEM);
  // Live badges are covered in the pure suite; here they must not reach out.
  LIVE.setLiveFetchForTests(async () => new Response('{}', { status: 500 }));
  const T = await import('../src/lib/twitch.ts');
  const C = await import('../src/lib/clanCreate.ts');

  host = await person('CA Host');
  const r = await C.createCreatorSpace({ slug: 'ca-streamer', name: 'CA Streamer', ownerUserId: host.userId });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;
  await G.saveHostTwitchChannel({
    clanId: spaceId,
    userId: host.userId,
    cfg: T.twitchConfig()!,
    tokens: { accessToken: 'tw-host-at', refreshToken: 'tw-host-rt', expiresIn: 3600, scope: [...T.HOST_SCOPES] },
    user: { id: TW_BROADCASTER, login: 'castreamer', broadcasterType: 'affiliate' },
  });
});

beforeEach(() => {
  for (const k of [...Array(200).keys()]) G.gateCache.forgetUser(k);
});

after(async () => {
  globalThis.fetch = realFetch;
  LIVE.setLiveFetchForTests(null);
  await pool.end();
  await dropDatabase(DB);
});

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

test('Twitch: link from settings, show by default, hide, unlink; "taken" on another login', async () => {
  const a = await person('Tw A');
  const b = await person('Tw B');
  // The settings link IS the gate flow's viewer link (api/auth/twitch/callback, mode viewer).
  assert.equal(await G.linkViewerTwitch(a.userId, { id: '7001', login: 'twa', broadcasterType: '' }), 'ok');
  assert.equal(await G.linkViewerTwitch(b.userId, { id: '7001', login: 'twa', broadcasterType: '' }), 'taken');

  let view = await CA.connectedAccountsForUser(a.userId);
  assert.deepEqual(
    view.links.map((l) => [l.platform, l.handle, l.url, l.verified, l.showOnProfile]),
    [['twitch', 'twa', 'https://www.twitch.tv/twa', true, true]],
  );
  assert.equal(await CA.setShowOnProfile(a.userId, 'twitch', false), true);
  view = await CA.connectedAccountsForUser(a.userId);
  assert.equal(view.links[0].showOnProfile, false);
  // Nothing linked → nothing to toggle.
  assert.equal(await CA.setShowOnProfile(b.userId, 'twitch', true), false);

  await CA.unlinkConnectedAccount(a.userId, 'twitch');
  assert.equal((await CA.connectedAccountsForUser(a.userId)).links.length, 0);
  assert.equal(await db.query.userConnectedPrefs.findFirst({ where: eq(s.userConnectedPrefs.userId, a.userId) }), undefined);
  // Free again: B can have it now.
  assert.equal(await G.linkViewerTwitch(b.userId, { id: '7001', login: 'twa', broadcasterType: '' }), 'ok');
});

test('gate fast path (Twitch): an account linked in settings is the one the gate checks — no link step', async () => {
  const ev = await gatedEvent('Followers', { anyOf: [{ kind: 'twitch-follow' }] });
  const v = await person('Fast Viewer');
  assert.equal(await G.linkViewerTwitch(v.userId, { id: '7100', login: 'fastviewer', broadcasterType: '' }), 'ok');
  const info = await G.entryGateInfo(ev, v.userId);
  assert.equal(info?.twitchLinked, 'fastviewer');
  net.followers.add('7100');
  const r = await enter(v, ev);
  assert.equal(r.outcome, 'seated', JSON.stringify(r));
});

test('YouTube: link (identity only), taken, unlink drops the link and its proofs', async () => {
  const a = await person('Yt A');
  const b = await person('Yt B');
  const ch = { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', title: 'A’s Channel' };
  assert.equal(await YT.linkViewerYoutube(a.userId, ch), 'ok');
  assert.equal(await YT.linkViewerYoutube(b.userId, ch), 'taken');
  await YT.recordProof({ userId: a.userId, hostChannelId: 'UCbbbbbbbbbbbbbbbbbbbbbb', kind: 'sub', channel: ch, ok: true });
  const view = await CA.connectedAccountsForUser(a.userId);
  assert.deepEqual(
    view.links.map((l) => [l.platform, l.handle, l.url, l.verified]),
    [['youtube', 'A’s Channel', 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa', true]],
  );
  await CA.unlinkConnectedAccount(a.userId, 'youtube');
  assert.equal(await YT.viewerYoutube(a.userId), null);
  assert.equal(await db.query.userYoutubeProofs.findFirst({ where: eq(s.userYoutubeProofs.userId, a.userId) }), undefined);
});

test('Kick: the Anvil channel chat is subscribed with the APP token, once; a code typed there links', async () => {
  KA.resetAnvilKickForTests();
  assert.deepEqual(await KA.anvilKickChannel(), { broadcasterId: ANVIL_KICK, slug: 'anvil_osrs' });
  assert.equal(await KA.ensureAnvilKickChat(), true);
  assert.equal(net.appSubscribePosts, 1);
  assert.equal(await KA.ensureAnvilKickChat(true), true, 'already subscribed: listed, not posted again');
  assert.equal(net.appSubscribePosts, 1);

  const a = await person('Kick A');
  const b = await person('Kick B');
  assert.deepEqual(await kickChatCode(a, 501, 'Kick_A'), { state: 'linked', username: 'Kick_A' });
  assert.deepEqual(await kickChatCode(b, 501, 'Kick_A'), { state: 'taken' });
  const view = await CA.connectedAccountsForUser(a.userId);
  assert.deepEqual(
    view.links.map((l) => [l.platform, l.handle, l.url, l.verified]),
    [['kick', 'Kick_A', 'https://kick.com/kick-a', true]],
  );
  // A code in some other channel nobody connected is ignored (no link, the code stays unused).
  const c = await person('Kick C');
  const st = await kickChatCode(c, 502, 'Kick_C', '3999');
  assert.equal(st.state, 'pending');

  // Unlink drops the link and their unused codes.
  await CA.unlinkConnectedAccount(c.userId, 'kick');
  assert.equal(await db.query.kickLinkCodes.findFirst({ where: and(eq(s.kickLinkCodes.userId, c.userId)) }), undefined);
  await CA.unlinkConnectedAccount(a.userId, 'kick');
  assert.equal(await K.viewerKick(a.userId), null);
});

test('gate fast path (Kick): linked in the Anvil channel, a follow seen in the host channel lets them in', async () => {
  const cfg = (await import('../src/lib/kick.ts')).kickConfig()!;
  const r = await K.finishHostKickConnect({
    clanId: spaceId,
    userId: host.userId,
    cfg,
    tokens: { accessToken: 'kick-host-at', refreshToken: 'kick-host-rt', expiresIn: 7200, scope: ['user:read', 'channel:read', 'events:subscribe', 'chat:write'] },
  });
  assert.equal(r, 'connected');
  const ev = await gatedEvent('Kick Followers', { anyOf: [{ kind: 'kick-follow' }] });
  const v = await person('Kick Fast');
  assert.deepEqual(await kickChatCode(v, 601, 'KickFast'), { state: 'linked', username: 'KickFast' });
  const follow = webhook('channel.followed', {
    broadcaster: { is_anonymous: false, user_id: Number(HOST_KICK), username: 'kickhost', channel_slug: 'kickhost', identity: null },
    follower: { is_anonymous: false, user_id: 601, username: 'KickFast' },
  });
  assert.equal((await W.handleKickWebhook(follow.headers, follow.raw)).status, 200);
  const res = await enter(v, ev);
  assert.equal(res.outcome, 'seated', JSON.stringify(res));
});

test('Medal: unverified until the code shows up in a clip title; taken only once verified', async () => {
  const a = await person('Medal A');
  const b = await person('Medal B');
  assert.deepEqual(await CA.setMedalProfile(a.userId, 'https://evil.com/users/1'), { ok: false, reason: 'invalid' });
  assert.deepEqual(await CA.setMedalProfile(a.userId, 'https://medal.tv/users/31337'), { ok: true });
  // B typing A's profile is allowed while it is unverified (nobody can squat it) …
  assert.deepEqual(await CA.setMedalProfile(b.userId, 'medal.tv/users/31337'), { ok: true });

  let view = await CA.connectedAccountsForUser(a.userId);
  assert.equal(view.links[0].verified, false);
  assert.equal(view.links[0].showOnProfile, false, 'unverified: hidden by default');
  const code = view.medal!.code!;
  assert.equal(code, CA.medalCodeFor(a.userId, '31337'));

  net.medalClips = [{ contentTitle: 'big drop', credits: 'Credits to Clipper (https://medal.tv/users/31337)' }];
  assert.deepEqual(await CA.verifyMedal(a.userId), { ok: false, reason: 'no-code' });
  // The code on a clip credited to SOMEONE ELSE (one that only shows up in their list) proves nothing.
  net.medalClips.push({ contentTitle: `team clip ${code}`, credits: 'Credits to Other (https://medal.tv/users/999)' });
  assert.deepEqual(await CA.verifyMedal(a.userId), { ok: false, reason: 'no-code' });
  net.medalClips.push({ contentTitle: `zuk kill ${code}`, credits: 'Credits to Clipper (https://medal.tv/users/31337)' });
  assert.deepEqual(await CA.verifyMedal(a.userId), { ok: true, username: 'Clipper' });

  view = await CA.connectedAccountsForUser(a.userId);
  assert.deepEqual([view.links[0].verified, view.links[0].showOnProfile, view.links[0].url], [true, true, 'https://medal.tv/u/Clipper']);
  // … and B's unverified claim of the same account is gone; B cannot take it now.
  assert.equal((await CA.connectedAccountsForUser(b.userId)).links.length, 0);
  assert.deepEqual(await CA.setMedalProfile(b.userId, '31337'), { ok: false, reason: 'taken' });
  // B's code in A's clip title proves nothing for B (it is derived from B's login).
  assert.notEqual(CA.medalCodeFor(b.userId, '31337'), code);

  // Re-saving the same verified account keeps it verified; a username-only profile cannot be verified.
  assert.deepEqual(await CA.setMedalProfile(a.userId, 'https://medal.tv/users/31337'), { ok: true });
  assert.equal((await CA.connectedAccountsForUser(a.userId)).links[0].verified, true);
  const c = await person('Medal C');
  await CA.setMedalProfile(c.userId, 'https://medal.tv/u/someone');
  assert.deepEqual(await CA.verifyMedal(c.userId), { ok: false, reason: 'needs-id' });
  assert.equal((await CA.connectedAccountsForUser(c.userId)).medal?.code, null);
});

test('profile: a person’s links across their logins, only those they show, the owner sees all', async () => {
  const p = await person('Profile P', true);
  const [second] = await db.insert(s.users).values({ playerId: p.playerId, displayName: 'P alt', discordId: '99600000000009999' }).returning();
  await G.linkViewerTwitch(p.userId, { id: '7300', login: 'profilep', broadcasterType: '' });
  await YT.linkViewerYoutube(second.id, { id: 'UCpppppppppppppppppppppp', title: 'P Tube' });
  await CA.setMedalProfile(p.userId, 'medal.tv/users/777');
  await CA.setShowOnProfile(second.id, 'youtube', false);

  const stranger = await CA.profileConnectedAccounts(p.playerId, false);
  assert.deepEqual(stranger.map((l) => l.platform), ['twitch']);
  assert.equal(stranger[0].live, false, 'live lookup failed → not live, never a throw');
  const owner = await CA.profileConnectedAccounts(p.playerId, true);
  assert.deepEqual(owner.map((l) => l.platform), ['twitch', 'youtube', 'medal']);

  await CA.setShowOnProfile(p.userId, 'medal', true);
  const shown = await CA.profileConnectedAccounts(p.playerId, false);
  assert.deepEqual(shown.map((l) => [l.platform, l.verified]), [['twitch', true], ['medal', false]]);
});

test('unlink keeps one-account-per-event claims for running events, drops them for finished ones', async () => {
  const v = await person('Claims V');
  await G.linkViewerTwitch(v.userId, { id: '7400', login: 'claimsv', broadcasterType: '' });
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const running = await gatedEvent('Running', { anyOf: [{ kind: 'twitch-follow' }] }, { endDate: future });
  const ended = await gatedEvent('Ended', { anyOf: [{ kind: 'twitch-follow' }] }, { endDate: past });
  const forced = await gatedEvent('Forced', { anyOf: [{ kind: 'twitch-follow' }] }, { endDate: future, forceEndedAt: past });
  for (const eventId of [running, ended, forced]) {
    assert.equal(await G.claimTwitchForEvent({ eventId, clanId: spaceId, twitchUserId: '7400', userId: v.userId }), 'ok');
  }
  await db.insert(s.eventGateClaims).values([
    { eventId: running, platform: 'kick', platformUserId: '9', userId: v.userId, claimedAt: past },
    { eventId: ended, platform: 'kick', platformUserId: '9', userId: v.userId, claimedAt: past },
  ]);

  await CA.unlinkConnectedAccount(v.userId, 'twitch');
  const tw = await db.query.eventTwitchClaims.findMany({ where: eq(s.eventTwitchClaims.userId, v.userId) });
  assert.deepEqual(tw.map((c) => c.eventId), [running]);
  // Kick's claims are untouched by a Twitch unlink …
  assert.equal((await db.query.eventGateClaims.findMany({ where: eq(s.eventGateClaims.userId, v.userId) })).length, 2);
  // … and a Kick unlink drops only the finished event's.
  await CA.unlinkConnectedAccount(v.userId, 'kick');
  const kc = await db.query.eventGateClaims.findMany({ where: eq(s.eventGateClaims.userId, v.userId) });
  assert.deepEqual(kc.map((c) => c.eventId), [running]);

  // The kept claim still holds: the same Twitch account relinked on another login can't join the running event.
  const other = await person('Claims Other');
  await G.linkViewerTwitch(other.userId, { id: '7400', login: 'claimsv', broadcasterType: '' });
  assert.equal(await G.claimTwitchForEvent({ eventId: running, clanId: spaceId, twitchUserId: '7400', userId: other.userId }), 'taken');
});
