// Kick for creator spaces against a real database, with Kick mocked at fetch and webhooks signed by a
// generated RSA key: connecting a channel, linking a viewer by chat code, follow/sub facts from
// webhooks, the gate verdict and its one-Kick-account-per-event claim, replay protection, `!join`
// replies (app bot and bot-account token), and disconnecting.
//
// Run: npm run test:kick   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('kick-gates');

process.env.KICK_CLIENT_ID = 'kcid';
process.env.KICK_CLIENT_SECRET = 'kcsecret';
process.env.KICK_REDIRECT_URI = 'https://anvil.test/api/auth/kick/callback';
process.env.KICK_TOKEN_KEY = 'kick-test-key-'.padEnd(48, 'x');
delete process.env.KICK_BOT_REFRESH_TOKEN;

const BROADCASTER = '424242';

// ── The fake Kick ────────────────────────────────────────────────────────────────────────────────

const net = {
  liveToken: 'host-at-1',
  refresh: 'ok' as 'ok' | 'refused',
  refreshes: 0,
  subscribes: 0,
  unsubscribes: [] as string[],
  chats: [] as { auth: string; body: Record<string, unknown> }[],
  botRefreshes: 0,
};

const realFetch = globalThis.fetch;
function reply(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const auth = new Headers(init?.headers).get('authorization') ?? '';
  if (u.hostname === 'id.kick.com' && u.pathname === '/oauth/token') {
    const form = new URLSearchParams(String(init?.body));
    if (form.get('grant_type') === 'client_credentials') return reply({ access_token: 'app-token', expires_in: 3600 });
    if (form.get('refresh_token')?.startsWith('bot-rt')) {
      net.botRefreshes++;
      return reply({ access_token: `bot-at-${net.botRefreshes}`, refresh_token: `bot-rt-${net.botRefreshes + 1}`, expires_in: 7200, scope: 'user:read chat:write' });
    }
    net.refreshes++;
    if (net.refresh === 'refused') return reply({ error: 'Invalid request' }, 400);
    net.liveToken = `host-at-${net.refreshes + 1}`;
    return reply({ access_token: net.liveToken, refresh_token: `host-rt-${net.refreshes + 1}`, expires_in: 7200, scope: 'user:read channel:read events:subscribe chat:write' });
  }
  if (u.hostname === 'api.kick.com') {
    if (u.pathname === '/public/v1/events/subscriptions') {
      if (auth === 'Bearer app-token') {
        if (init?.method === 'DELETE') {
          net.unsubscribes.push(...u.searchParams.getAll('id'));
          return reply(null, 204);
        }
        return reply({ data: [{ id: 'sub-1', broadcaster_user_id: Number(BROADCASTER), event: 'chat.message.sent' }] });
      }
      if (auth !== `Bearer ${net.liveToken}`) return reply({ message: 'Unauthorized' }, 401);
      net.subscribes++;
      return reply({ data: [{ name: 'chat.message.sent', version: 1, subscription_id: 'sub-1' }] });
    }
    if (u.pathname === '/public/v1/channels') {
      if (auth !== `Bearer ${net.liveToken}`) return reply({ message: 'Unauthorized' }, 401);
      return reply({ data: [{ broadcaster_user_id: Number(BROADCASTER), slug: 'kickstreamer' }] });
    }
    if (u.pathname === '/public/v1/chat') {
      const ok = auth === `Bearer ${net.liveToken}` || auth.startsWith('Bearer bot-at-');
      if (!ok) return reply({ message: 'Unauthorized' }, 401);
      net.chats.push({ auth, body: JSON.parse(String(init?.body)) });
      return reply({ data: { is_sent: true, message_id: crypto.randomUUID() } });
    }
  }
  throw new Error(`unexpected fetch ${u.href}`);
}) as typeof fetch;

// ── Signed webhooks ──────────────────────────────────────────────────────────────────────────────

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
let msgN = 0;

function webhook(type: string, body: unknown, opts: { id?: string; ts?: string; badSig?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const id = opts.id ?? `01JMSG${String(++msgN).padStart(8, '0')}`;
  const ts = opts.ts ?? new Date().toISOString();
  const sig = crypto.sign('sha256', Buffer.from(`${id}.${ts}.${opts.badSig ? `${raw} ` : raw}`), privateKey).toString('base64');
  const headers = new Headers({
    'Kick-Event-Message-Id': id,
    'Kick-Event-Message-Timestamp': ts,
    'Kick-Event-Signature': sig,
    'Kick-Event-Type': type,
    'Kick-Event-Version': '1',
  });
  return { headers, raw, id };
}

const BC = { is_anonymous: false, user_id: Number(BROADCASTER), username: 'KickStreamer', channel_slug: 'kickstreamer', identity: null };
function chat(senderId: number, name: string, content: string, badges: string[] = []) {
  return {
    message_id: crypto.randomUUID(),
    broadcaster: BC,
    sender: { is_anonymous: false, user_id: senderId, username: name, identity: { badges: badges.map((t) => ({ type: t, text: t })) } },
    content,
    created_at: new Date().toISOString(),
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let E: typeof import('../src/lib/eventEntry.ts');
let G: typeof import('../src/lib/entryGatesDb.ts');
let K: typeof import('../src/lib/gates/kickDb.ts');
let W: typeof import('../src/lib/gates/kickWebhook.ts');
let C: typeof import('../src/lib/gates/kickChat.ts');
let KL: typeof import('../src/lib/kick.ts');

let n = 0;
async function person(name: string) {
  n += 1;
  const discordId = `99500000000000${String(n).padStart(4, '0')}`;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: new Date().toISOString() })
    .returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId }).returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id, discordId };
}
type Person = Awaited<ReturnType<typeof person>>;

let host: Person;
let spaceId: number;

async function gatedEvent(name: string, gates: unknown): Promise<number> {
  const [ev] = await db.insert(s.events).values({ clanId: spaceId, name, boardSize: 5, entry: 'open', entryGates: JSON.stringify(gates) }).returning();
  return ev.id;
}
const enter = (p: Person, eventId: number) => E.enterEvent({ eventId, playerId: p.playerId, accountId: p.accountId, actorUserId: p.userId });

/** Get a code for `p` and type it in chat as Kick user `kickId`. */
async function linkByCode(p: Person, kickId: number, kickName: string, badges: string[] = []) {
  const { code } = await K.issueKickCode(p.userId);
  const w = webhook('chat.message.sent', chat(kickId, kickName, `here: ${code.toLowerCase()} thanks`, badges));
  const r = await W.handleKickWebhook(w.headers, w.raw);
  assert.equal(r.status, 200, JSON.stringify(r));
  return { code, status: await K.kickCodeStatus(p.userId, code) };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  E = await import('../src/lib/eventEntry.ts');
  G = await import('../src/lib/entryGatesDb.ts');
  K = await import('../src/lib/gates/kickDb.ts');
  W = await import('../src/lib/gates/kickWebhook.ts');
  C = await import('../src/lib/gates/kickChat.ts');
  KL = await import('../src/lib/kick.ts');
  W.setKickPublicKeyForTests(PEM);
  const CC = await import('../src/lib/clanCreate.ts');

  host = await person('Kick Host');
  const r = await CC.createCreatorSpace({ slug: 'kick-streamer', name: 'Kick Streamer', ownerUserId: host.userId });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;
});

beforeEach(() => {
  for (const k of [...Array(200).keys()]) G.gateCache.forgetUser(k);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

test('connecting: scopes checked, channel learned, tokens encrypted, webhooks subscribed', async () => {
  const cfg = KL.kickConfig()!;
  const missing = await K.finishHostKickConnect({
    clanId: spaceId,
    userId: host.userId,
    cfg,
    tokens: { accessToken: 'host-at-1', refreshToken: 'host-rt-1', expiresIn: 7200, scope: ['user:read'] },
  });
  assert.equal(missing, 'scopes');
  assert.equal(await K.hostKickChannel(spaceId), null);

  const r = await K.finishHostKickConnect({
    clanId: spaceId,
    userId: host.userId,
    cfg,
    tokens: { accessToken: 'host-at-1', refreshToken: 'host-rt-1', expiresIn: 7200, scope: [...KL.KICK_HOST_SCOPES] },
  });
  assert.equal(r, 'connected');
  assert.equal(net.subscribes, 1);
  const row = await db.query.clanKickChannels.findFirst({ where: eq(s.clanKickChannels.clanId, spaceId) });
  assert.equal(row!.kickUserId, BROADCASTER);
  assert.ok(row!.accessToken.startsWith('enc1:') && !row!.accessToken.includes('host-at-1'));
  assert.ok(row!.refreshToken.startsWith('enc1:'));
  assert.deepEqual(await K.hostKickChannel(spaceId), { slug: 'kickstreamer', broken: false, followersOnlyChat: false, chatJoin: false });
  const opts = await G.gateOptions(spaceId);
  assert.deepEqual(opts.kick, {
    configured: true,
    channel: { slug: 'kickstreamer', broken: false, followersOnlyChat: false },
    connectUrl: `/api/auth/kick/start?space=${spaceId}`,
  });
});

test('followers: unlinked → code; linked by chat code; a follow event lets them in', async () => {
  const ev = await gatedEvent('Kick Followers', { anyOf: [{ kind: 'kick-follow' }] });
  const viewer = await person('Kick Viewer');

  const info = await G.entryGateInfo(ev, viewer.userId);
  assert.deepEqual(info?.kick, { slug: 'kickstreamer', linked: null, available: true });
  assert.equal(info?.summary, 'Open to followers of kickstreamer on Kick.');

  const r1 = await enter(viewer, ev);
  assert.equal(r1.outcome, 'gated', JSON.stringify(r1));
  if (r1.outcome === 'gated') {
    assert.equal(r1.gate.linkKick, true);
    assert.deepEqual(r1.gate.steps, ['Link your Kick account: get a code and type it in kickstreamer’s Kick chat']);
  }

  const { status } = await linkByCode(viewer, 7001, 'viewer_one');
  assert.deepEqual(status, { state: 'linked', username: 'viewer_one' });
  assert.deepEqual(await K.viewerKick(viewer.userId), { id: '7001', username: 'viewer_one' });

  const r2 = await enter(viewer, ev);
  assert.equal(r2.outcome, 'gated');
  if (r2.outcome === 'gated') assert.match(r2.gate.steps[0], /^Follow kickstreamer on Kick/);

  const f = webhook('channel.followed', { broadcaster: BC, follower: { is_anonymous: false, user_id: 7001, username: 'viewer_one' } });
  assert.equal((await W.handleKickWebhook(f.headers, f.raw)).status, 200);
  // The follow cleared the cached "no" by itself.
  const r3 = await enter(viewer, ev);
  assert.equal(r3.outcome, 'seated', JSON.stringify(r3));
  assert.deepEqual(await G.entryGateVerdict({ eventId: ev, userId: viewer.userId, playerId: viewer.playerId }), { pass: true, via: 'kick-follow' });
});

test('subs: a code typed with a sub badge proves a sub; a renewal event does too; facts expire', async () => {
  const ev = await gatedEvent('Kick Subs', { anyOf: [{ kind: 'kick-sub' }] });
  const a = await person('Badge Sub');
  await linkByCode(a, 7101, 'badge_sub', ['subscriber']);
  assert.equal((await enter(a, ev)).outcome, 'seated');
  const facts = await K.kickFactsFor(BROADCASTER, '7101');
  const days = (Date.parse(facts!.subUntil!) - Date.now()) / 86_400_000;
  assert.ok(days > 34 && days < 36, String(days));

  const b = await person('Event Sub');
  await linkByCode(b, 7102, 'event_sub');
  assert.equal((await enter(b, ev)).outcome, 'gated', 'no badge, no event yet');
  const expires = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const r = webhook('channel.subscription.renewal', { broadcaster: BC, subscriber: { user_id: 7102, username: 'event_sub' }, duration: 2, expires_at: expires });
  await W.handleKickWebhook(r.headers, r.raw);
  assert.equal((await enter(b, ev)).outcome, 'seated');

  // A lapsed sub (sub_until in the past) is turned away again.
  const c = await person('Lapsed Sub');
  await linkByCode(c, 7103, 'lapsed');
  await db.insert(s.kickChannelFacts).values({ broadcasterId: BROADCASTER, kickUserId: '7103', subUntil: new Date(Date.now() - 1000).toISOString(), updatedAt: new Date().toISOString() });
  G.gateCache.forgetUser(c.userId);
  assert.equal((await enter(c, ev)).outcome, 'gated');

  // Gifts: each giftee becomes a sub.
  const g = webhook('channel.subscription.gifts', { broadcaster: BC, gifter: { is_anonymous: true }, giftees: [{ user_id: 7103, username: 'lapsed' }], expires_at: expires });
  await W.handleKickWebhook(g.headers, g.raw);
  assert.equal((await enter(c, ev)).outcome, 'seated');
});

test('followers-only chat: a code typed there proves a follow', async () => {
  const ev = await gatedEvent('Kick FO', { anyOf: [{ kind: 'kick-follow' }] });
  assert.equal(await K.setHostKickFlags(spaceId, { followersOnlyChat: true }), true);
  const v = await person('FO Viewer');
  await linkByCode(v, 7201, 'fo_viewer');
  assert.equal((await enter(v, ev)).outcome, 'seated');
  await K.setHostKickFlags(spaceId, { followersOnlyChat: false });
});

test('codes: single use, expire, bound to their login; another login’s Kick account is refused', async () => {
  const a = await person('Code A');
  const { code } = await linkByCode(a, 7301, 'code_a');
  // The same line again (a new message id): the code is spent.
  const again = webhook('chat.message.sent', chat(7399, 'thief', code));
  await W.handleKickWebhook(again.headers, again.raw);
  assert.equal((await K.viewerKick(a.userId))?.id, '7301', 'not re-pointed at the thief');
  assert.equal(await db.query.userKickLinks.findFirst({ where: eq(s.userKickLinks.kickUserId, '7399') }), undefined);

  // Somebody else's code reads as expired to me.
  const b = await person('Code B');
  assert.deepEqual(await K.kickCodeStatus(b.userId, code), { state: 'expired' });

  // An expired code links nobody.
  const old = await K.issueKickCode(b.userId, Date.now() - 11 * 60_000);
  const late = webhook('chat.message.sent', chat(7302, 'code_b', old.code));
  await W.handleKickWebhook(late.headers, late.raw);
  assert.equal(await K.viewerKick(b.userId), null);
  assert.deepEqual(await K.kickCodeStatus(b.userId, old.code), { state: 'expired' });

  // A Kick account already linked to A cannot be linked to B.
  const { status } = await linkByCode(b, 7301, 'code_a');
  assert.deepEqual(status, { state: 'taken' });
  assert.equal(await K.viewerKick(b.userId), null);

  // A fresh code replaces an unused one.
  const c1 = await K.issueKickCode(b.userId);
  const c2 = await K.issueKickCode(b.userId);
  assert.deepEqual(await K.kickCodeStatus(b.userId, c1.code), { state: 'expired' });
  assert.equal((await K.kickCodeStatus(b.userId, c2.code)).state, 'pending');
});

test('webhook: bad signature, stale timestamp and replays are refused; idle chat writes nothing', async () => {
  const body = chat(7401, 'x', 'hello chat');
  const bad = webhook('chat.message.sent', body, { badSig: true });
  assert.equal((await W.handleKickWebhook(bad.headers, bad.raw)).status, 401);

  const stale = webhook('chat.message.sent', body, { ts: new Date(Date.now() - 30 * 60_000).toISOString() });
  assert.equal((await W.handleKickWebhook(stale.headers, stale.raw)).status, 400);

  const idle = webhook('chat.message.sent', body);
  assert.equal((await W.handleKickWebhook(idle.headers, idle.raw)).status, 200);
  assert.equal(await db.query.kickWebhookSeen.findFirst({ where: eq(s.kickWebhookSeen.messageId, idle.id) }), undefined, 'ordinary chat is not even recorded');

  const f = webhook('channel.followed', { broadcaster: BC, follower: { user_id: 7402, username: 'rep' } });
  assert.deepEqual((await W.handleKickWebhook(f.headers, f.raw)).body, { ok: true });
  const replay = await W.handleKickWebhook(f.headers, f.raw);
  assert.deepEqual(replay.body, { ok: true, duplicate: true });

  // A channel no space connected: acknowledged, nothing stored.
  const elsewhere = webhook('channel.followed', { broadcaster: { ...BC, user_id: 999 }, follower: { user_id: 7403, username: 'z' } });
  assert.equal((await W.handleKickWebhook(elsewhere.headers, elsewhere.raw)).status, 200);
  assert.equal(await K.kickFactsFor('999', '7403'), null);

  const missing = new Headers({ 'Kick-Event-Type': 'channel.followed' });
  assert.equal((await W.handleKickWebhook(missing, '{}')).status, 400);
});

test('one Kick account, one player per event: relinking it to another login does not get them in', async () => {
  const ev = await gatedEvent('Kick Claims', { anyOf: [{ kind: 'kick-follow' }] });
  const a = await person('Claim A');
  const b = await person('Claim B');
  const f = webhook('channel.followed', { broadcaster: BC, follower: { user_id: 7501, username: 'shared' } });
  await W.handleKickWebhook(f.headers, f.raw);
  await linkByCode(a, 7501, 'shared');
  assert.equal((await enter(a, ev)).outcome, 'seated');

  await K.unlinkViewerKick(a.userId);
  await linkByCode(b, 7501, 'shared');
  const r = await enter(b, ev);
  assert.equal(r.outcome, 'gated', JSON.stringify(r));
  if (r.outcome === 'gated') {
    assert.equal(r.error, 'That Kick account was already used to join this event by another player.');
    assert.equal(r.gate.blocked, true);
  }
  const claim = await db.query.eventGateClaims.findFirst({
    where: and(eq(s.eventGateClaims.eventId, ev), eq(s.eventGateClaims.platform, 'kick'), eq(s.eventGateClaims.platformUserId, '7501')),
  });
  assert.equal(claim?.userId, a.userId);
});

test('!join: only when switched on; replies once per cooldown as the app bot through the host token', async () => {
  await db.insert(s.events).values({ clanId: spaceId, name: 'Open Kick Bingo', boardSize: 5, entry: 'open', visibility: 'public' } as typeof s.events.$inferInsert);

  const off = webhook('chat.message.sent', chat(7601, 'asker', '!join'));
  const r0 = await W.handleKickWebhook(off.headers, off.raw);
  assert.equal(r0.after, undefined, 'switched off: no reply');

  await K.setHostKickFlags(spaceId, { chatJoin: true });
  const body = chat(7601, 'asker', '!JOIN please');
  const on = webhook('chat.message.sent', body);
  const r1 = await W.handleKickWebhook(on.headers, on.raw);
  assert.deepEqual(r1.after, { kind: 'join', clanId: spaceId, broadcasterId: BROADCASTER, replyTo: body.message_id });

  // The plan (lib/creatorPlans): once FREEMIUM_ENFORCED is on, `!join` is Silver+ — a Free space's
  // channel is ignored exactly like the Twitch bot's chatBotChannels skips it.
  process.env.FREEMIUM_ENFORCED = 'true';
  try {
    const capped = webhook('chat.message.sent', chat(7601, 'asker', '!join'));
    assert.equal((await W.handleKickWebhook(capped.headers, capped.raw)).after, undefined, 'Free + enforced: no reply');
    await db.update(s.clans).set({ plan: 'silver' }).where(eq(s.clans.id, spaceId));
    const paid = webhook('chat.message.sent', chat(7601, 'asker', '!join'));
    assert.equal((await W.handleKickWebhook(paid.headers, paid.raw)).after?.kind, 'join', 'Silver + enforced: replies');
  } finally {
    delete process.env.FREEMIUM_ENFORCED;
    await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, spaceId));
  }

  const before = net.chats.length;
  assert.equal(await C.answerKickJoin({ clanId: spaceId, broadcasterId: BROADCASTER, replyTo: body.message_id }, 1_000_000), true);
  const sent = net.chats[before];
  assert.equal(sent.auth, `Bearer ${net.liveToken}`);
  assert.equal(sent.body.type, 'bot');
  assert.equal(sent.body.reply_to_message_id, body.message_id);
  assert.match(String(sent.body.content), /^(Join .+ on Anvil: https?:\/\/\S+\/c\/kick-streamer\/events\/\d+|No event is open)/);
  // Within the cooldown: quiet.
  assert.equal(await C.answerKickJoin({ clanId: spaceId, broadcasterId: BROADCASTER, replyTo: null }, 1_010_000), false);
  assert.equal(net.chats.length, before + 1);
});

test('!join with a bot-account token: sent as that user, and the rotated refresh token is stored encrypted', async () => {
  process.env.KICK_BOT_REFRESH_TOKEN = 'bot-rt-seed';
  try {
    const before = net.chats.length;
    assert.equal(await C.answerKickJoin({ clanId: spaceId, broadcasterId: BROADCASTER, replyTo: null }, 5_000_000), true);
    const sent = net.chats[before];
    assert.equal(sent.auth, 'Bearer bot-at-1');
    assert.equal(sent.body.type, 'user');
    assert.equal(sent.body.broadcaster_user_id, Number(BROADCASTER));
    const row = await db.query.kickBotTokens.findFirst();
    assert.ok(row!.refreshToken.startsWith('enc1:') && !row!.refreshToken.includes('bot-rt'));
    // The stored token is reused, not the seed again.
    await C.sendKickChat({ clanId: spaceId, broadcasterId: BROADCASTER, content: 'hi', replyTo: null });
    assert.equal(net.botRefreshes, 1);
  } finally {
    delete process.env.KICK_BOT_REFRESH_TOKEN;
  }
});

test('an expired host token is refreshed; a refused refresh marks the channel broken', async () => {
  await db.update(s.clanKickChannels).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(s.clanKickChannels.clanId, spaceId));
  const t = await K.hostKickToken(spaceId, KL.kickConfig()!);
  assert.equal(t?.token, net.liveToken);
  assert.equal(net.refreshes, 1);

  net.refresh = 'refused';
  assert.equal(await K.hostKickToken(spaceId, KL.kickConfig()!, true), null);
  assert.equal((await K.hostKickChannel(spaceId))?.broken, true);
  net.refresh = 'ok';
  await db.update(s.clanKickChannels).set({ brokenAt: null }).where(eq(s.clanKickChannels.clanId, spaceId));
});

test('disconnecting drops the channel, its facts and its webhook subscriptions', async () => {
  assert.ok(await K.kickFactsFor(BROADCASTER, '7001'));
  await K.disconnectHostKick(spaceId);
  assert.equal(await K.hostKickChannel(spaceId), null);
  assert.equal(await K.kickFactsFor(BROADCASTER, '7001'), null);
  assert.deepEqual(net.unsubscribes, ['sub-1']);
  // Kick-gated events now tell viewers it is the host's move.
  const ev = await gatedEvent('After Disconnect', { anyOf: [{ kind: 'kick-follow' }] });
  const v = await person('After');
  const r = await enter(v, ev);
  assert.ok(r.outcome === 'gated' && /host’s Kick connection/.test(r.gate.steps[0]), JSON.stringify(r));
});
