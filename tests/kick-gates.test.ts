// Kick for creator spaces — the pure half: webhook signatures (a generated RSA key), OAuth state and
// PKCE, link codes, reading Kick's payloads, how long facts count, the gate words, and the Kick HTTP
// client against a mocked fetch. No database, no network.
//
// Run: npm run test:kick

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { checkGates, gatesSummary, parseGates, validateGatesFor, verdictMessage, type GateOptions, type GateProbe } from '../src/lib/entryGates.ts';
import {
  KICK_BADGE_SUB_MS,
  KICK_SUB_GRACE_MS,
  factsSay,
  findKickCode,
  isKickCode,
  makeKickCode,
  parseKickEvent,
  subUntilFrom,
  type KickAnswer,
} from '../src/lib/gates/kick.ts';
import {
  KICK_EVENTS,
  KICK_HOST_SCOPES,
  cleanKickName,
  exchangeKickCode,
  fetchOwnChannel,
  hasKickHostScopes,
  kickAuthorizeUrl,
  kickConfig,
  pkceChallenge,
  pkceVerifier,
  postKickChat,
  refreshKickToken,
  signKickState,
  subscribeChannelEvents,
  unsubscribeChannelEvents,
  verifyKickSignature,
  verifyKickState,
  webhookTimestampOk,
  KickAuthError,
  type FetchLike,
} from '../src/lib/kick.ts';

const KEY = 'k'.repeat(40);
const cfg = { clientId: 'cid', clientSecret: 'cs', redirectUri: 'https://anvil.test/api/auth/kick/callback', tokenKey: KEY };

// ── Signatures ──────────────────────────────────────────────────────────────────────────────────

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const sign = (id: string, ts: string, body: string, key = privateKey) =>
  crypto.sign('sha256', Buffer.from(`${id}.${ts}.${body}`), key).toString('base64');

test('a Kick signature verifies over id.timestamp.body, and nothing else does', () => {
  const body = '{"a":1}';
  const ts = '2026-11-04T12:00:00Z';
  const sig = sign('01HMSG', ts, body);
  assert.equal(verifyKickSignature(PEM, '01HMSG', ts, body, sig), true);
  assert.equal(verifyKickSignature(PEM, '01HMSG', ts, '{"a":2}', sig), false, 'tampered body');
  assert.equal(verifyKickSignature(PEM, '01HMSX', ts, body, sig), false, 'another message id');
  assert.equal(verifyKickSignature(PEM, '01HMSG', '2026-11-04T12:00:01Z', body, sig), false, 'another timestamp');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal(verifyKickSignature(PEM, '01HMSG', ts, body, sign('01HMSG', ts, body, other)), false, 'someone else’s key');
  assert.equal(verifyKickSignature(PEM, '01HMSG', ts, body, 'not base64!!'), false);
  assert.equal(verifyKickSignature(PEM, '01HMSG', ts, body, ''), false);
  assert.equal(verifyKickSignature('not a pem', '01HMSG', ts, body, sig), false, 'never throws');
});

test('webhook timestamps: recent passes; old (replay) and far-future fail', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(webhookTimestampOk('2026-11-04T11:58:00Z', now), true);
  assert.equal(webhookTimestampOk('2026-11-04T11:40:00Z', now), false);
  assert.equal(webhookTimestampOk('2026-11-04T12:30:00Z', now), false);
  assert.equal(webhookTimestampOk('yesterday', now), false);
});

// ── OAuth ───────────────────────────────────────────────────────────────────────────────────────

test('config: all three plus a 32-char key; the key falls back to TWITCH_TOKEN_KEY', () => {
  assert.equal(kickConfig({}), null);
  assert.equal(kickConfig({ KICK_CLIENT_ID: 'a', KICK_CLIENT_SECRET: 'b', KICK_REDIRECT_URI: 'c', KICK_TOKEN_KEY: 'short' }), null);
  assert.equal(kickConfig({ KICK_CLIENT_ID: 'a', KICK_CLIENT_SECRET: 'b', KICK_REDIRECT_URI: 'c', TWITCH_TOKEN_KEY: KEY })?.tokenKey, KEY);
});

test('state: signed, bound to user + space, expires; PKCE verifier is derived and S256', () => {
  const s = { u: 7, c: 3, r: '/admin/clan', h: null, n: 'n'.repeat(24), e: Date.now() + 60_000 };
  const tok = signKickState(s, KEY);
  assert.deepEqual(verifyKickState(tok, KEY), s);
  assert.equal(verifyKickState(tok, 'x'.repeat(40)), null, 'another key');
  const [body, mac] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ ...s, u: 8 })).toString('base64url');
  assert.equal(verifyKickState(`${forged}.${mac}`, KEY), null, 'forged body');
  assert.equal(verifyKickState(`${body}.${mac}`, KEY, s.e + 1), null, 'expired');

  const v = pkceVerifier('nonce-abc-123456789', KEY);
  assert.match(v, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(pkceVerifier('nonce-abc-123456789', KEY), v);
  assert.notEqual(pkceVerifier('nonce-abc-123456780', KEY), v);
  assert.equal(pkceChallenge(v), crypto.createHash('sha256').update(v).digest('base64url'));

  const u = new URL(kickAuthorizeUrl(cfg, tok, pkceChallenge(v)));
  assert.equal(u.origin + u.pathname, 'https://id.kick.com/oauth/authorize');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('scope'), KICK_HOST_SCOPES.join(' '));
  assert.equal(u.searchParams.get('redirect_uri'), cfg.redirectUri);
  assert.equal(u.searchParams.get('state'), tok);
});

// ── Codes ───────────────────────────────────────────────────────────────────────────────────────

test('codes: ANVIL- plus six unambiguous symbols, found anywhere in a chat line', () => {
  for (let i = 0; i < 200; i++) {
    const c = makeKickCode((n) => crypto.randomBytes(n));
    assert.ok(isKickCode(c), c);
    assert.doesNotMatch(c.slice(6), /[01ILOU]/);
  }
  assert.equal(findKickCode('ANVIL-7F3K9Q'), 'ANVIL-7F3K9Q');
  assert.equal(findKickCode('hey here is mine anvil-7f3k9q :)'), 'ANVIL-7F3K9Q');
  assert.equal(findKickCode('ANVIL-7F3K9QX'), null, 'seven symbols');
  assert.equal(findKickCode('XANVIL-7F3K9Q'), null, 'glued to a word');
  assert.equal(findKickCode('ANVIL-7F3K9O'), null, 'O is not in the alphabet');
  assert.equal(findKickCode('!join'), null);
  assert.equal(findKickCode(42), null);
});

// ── Payloads ────────────────────────────────────────────────────────────────────────────────────

const B = { is_anonymous: false, user_id: 123456789, username: 'broadcaster_name', channel_slug: 'broadcaster_channel', identity: null };

test('chat: sender, subscriber badge, text; anonymous or malformed → null', () => {
  const body = {
    message_id: 'b6a5b1a2-1111-4c78-9e91-af35a172840e',
    broadcaster: B,
    sender: {
      is_anonymous: false,
      user_id: 987654321,
      username: 'sen‮der',
      identity: { badges: [{ type: 'moderator' }, { type: 'subscriber', count: 3 }] },
    },
    content: 'ANVIL-7F3K9Q',
  };
  const e = parseKickEvent('chat.message.sent', '1', body);
  assert.deepEqual(e, {
    type: 'chat',
    broadcasterId: '123456789',
    sender: { id: '987654321', name: 'sender' },
    subscriber: true,
    content: 'ANVIL-7F3K9Q',
    messageId: body.message_id,
  });
  const noSub = parseKickEvent('chat.message.sent', '1', { ...body, sender: { ...body.sender, identity: { badges: [{ type: 'sub_gifter' }] } } });
  assert.equal(noSub?.type === 'chat' && noSub.subscriber, false);
  assert.equal(parseKickEvent('chat.message.sent', '1', { ...body, sender: { ...body.sender, user_id: 'abc' } }), null);
  assert.equal(parseKickEvent('chat.message.sent', '2', body), null, 'unknown version');
  assert.equal(parseKickEvent('chat.message.sent', '1', { ...body, broadcaster: null }), null);
  assert.equal(parseKickEvent('kicks.gifted', '1', body), null);
});

test('follows, subs and gifts (anonymous gifter is fine; anonymous giftee is skipped)', () => {
  assert.deepEqual(parseKickEvent('channel.followed', '1', { broadcaster: B, follower: { user_id: 5, username: 'f' } }), {
    type: 'follow',
    broadcasterId: '123456789',
    follower: { id: '5', name: 'f' },
  });
  const sub = parseKickEvent('channel.subscription.renewal', '1', { broadcaster: B, subscriber: { user_id: 6, username: 's' }, expires_at: '2026-12-01T00:00:00Z' });
  assert.deepEqual(sub, { type: 'sub', broadcasterId: '123456789', subscribers: [{ id: '6', name: 's' }], expiresAt: '2026-12-01T00:00:00Z' });
  const gifts = parseKickEvent('channel.subscription.gifts', '1', {
    broadcaster: B,
    gifter: { is_anonymous: true, user_id: null },
    giftees: [{ user_id: 7, username: 'g1' }, { is_anonymous: true }, { user_id: 8, username: 'g2' }],
    expires_at: '2026-12-01T00:00:00Z',
  });
  assert.deepEqual(gifts?.type === 'sub' && gifts.subscribers.map((s) => s.id), ['7', '8']);
});

test('fact spans: a sub event lasts to Kick’s expiry + grace, a badge ~35 days; follows stand', () => {
  const now = Date.parse('2026-11-04T00:00:00Z');
  assert.equal(subUntilFrom('2026-12-04T00:00:00Z', now), Date.parse('2026-12-04T00:00:00Z') + KICK_SUB_GRACE_MS);
  assert.equal(subUntilFrom(null, now), now + KICK_BADGE_SUB_MS);
  assert.equal(subUntilFrom('2020-01-01T00:00:00Z', now), now + KICK_BADGE_SUB_MS, 'an expiry in the past is not trusted');
  assert.deepEqual(factsSay({ followedAt: 'x', subUntil: new Date(now + 1).toISOString() }, now), { follows: true, sub: true });
  assert.deepEqual(factsSay({ followedAt: null, subUntil: new Date(now - 1).toISOString() }, now), { follows: false, sub: false });
  assert.equal(cleanKickName('a\u0000b⁦c'), 'abc');
});

// ── Gates ───────────────────────────────────────────────────────────────────────────────────────

const ctx = { twitchLogin: null, hostName: 'Streamer', kickSlug: 'streamer' };
const noop = async () => ({ state: 'off' as const });
function probe(kick: KickAnswer): GateProbe {
  return { twitchFollows: noop, twitchSubTier: noop, discordMember: async () => ({ state: 'no-server' }), kickFacts: async () => kick };
}

test('parse: one of each Kick kind, kept after the others', () => {
  const g = parseGates({ anyOf: [{ kind: 'kick-sub' }, { kind: 'kick-follow' }, { kind: 'kick-sub' }, { kind: 'discord-booster' }] });
  assert.deepEqual(g, { anyOf: [{ kind: 'discord-booster' }, { kind: 'kick-follow' }, { kind: 'kick-sub' }] });
  assert.equal(gatesSummary({ anyOf: [{ kind: 'kick-follow' }, { kind: 'kick-sub' }] }, ctx), 'Open to followers of streamer on Kick or subscribers of streamer on Kick.');
});

test('validate: Kick rules need Kick configured and a working channel', () => {
  const base: GateOptions = { twitch: { configured: false, channel: null, connectUrl: null }, discord: { connected: false, roles: [] } };
  const g = { anyOf: [{ kind: 'kick-follow' as const }] };
  assert.equal(validateGatesFor(g, base).ok, false);
  assert.equal(validateGatesFor(g, { ...base, kick: { configured: true, channel: null, connectUrl: 'x' } }).ok, false);
  assert.equal(validateGatesFor(g, { ...base, kick: { configured: true, channel: { slug: 's', broken: true, followersOnlyChat: false }, connectUrl: 'x' } }).ok, false);
  assert.equal(validateGatesFor(g, { ...base, kick: { configured: true, channel: { slug: 's', broken: false, followersOnlyChat: false }, connectUrl: 'x' } }).ok, true);
});

test('check: unlinked → code; not following → follow (or code in a followers-only chat); sub → in', async () => {
  const follow = { anyOf: [{ kind: 'kick-follow' as const }] };
  const sub = { anyOf: [{ kind: 'kick-sub' as const }] };

  const v1 = await checkGates(follow, probe({ state: 'viewer-unlinked' }), ctx);
  assert.equal(v1.pass, false);
  if (!v1.pass) {
    assert.equal(v1.linkKick, true);
    assert.deepEqual(v1.steps, ['Link your Kick account: get a code and type it in streamer’s Kick chat']);
  }

  const v2 = await checkGates(follow, probe({ state: 'ok', follows: false, sub: false, followersOnlyChat: false }), ctx);
  assert.ok(!v2.pass && !v2.linkKick && /Unfollow and follow again/.test(v2.steps[0]));
  const v3 = await checkGates(follow, probe({ state: 'ok', follows: false, sub: false, followersOnlyChat: true }), ctx);
  assert.ok(!v3.pass && v3.linkKick && /fresh Anvil code/.test(v3.steps[0]));
  assert.deepEqual(await checkGates(follow, probe({ state: 'ok', follows: true, sub: false, followersOnlyChat: false }), ctx), { pass: true, via: 'kick-follow' });

  const v4 = await checkGates(sub, probe({ state: 'ok', follows: true, sub: false, followersOnlyChat: false }), ctx);
  assert.ok(!v4.pass && v4.linkKick);
  assert.deepEqual(await checkGates(sub, probe({ state: 'ok', follows: false, sub: true, followersOnlyChat: false }), ctx), { pass: true, via: 'kick-sub' });

  const v5 = await checkGates(sub, probe({ state: 'error' }), ctx);
  assert.ok(!v5.pass && v5.transient);
  const v6 = await checkGates(sub, probe({ state: 'host-missing' }), ctx);
  assert.ok(!v6.pass && !v6.transient && /let them know/.test(verdictMessage(v6)));
  // A probe without Kick at all (an older caller) reads as "host missing", never a pass.
  const bare: GateProbe = { twitchFollows: noop, twitchSubTier: noop, discordMember: async () => ({ state: 'no-server' }) };
  assert.equal((await checkGates(sub, bare, ctx)).pass, false);
});

// ── HTTP ────────────────────────────────────────────────────────────────────────────────────────

function mock(handler: (url: URL, init: RequestInit | undefined) => { status?: number; body?: unknown }) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const f: FetchLike = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  };
  return { f, calls };
}

test('token exchange sends the PKCE verifier; a 400 is a refusal; scope string is split', async () => {
  const m = mock(() => ({ body: { access_token: 'at', refresh_token: 'rt', expires_in: 7200, scope: 'user:read channel:read events:subscribe chat:write' } }));
  const t = await exchangeKickCode(cfg, 'the-code', 'the-verifier', m.f);
  assert.equal(t.accessToken, 'at');
  assert.ok(hasKickHostScopes(t.scope));
  const form = new URLSearchParams(String(m.calls[0].init?.body));
  assert.equal(m.calls[0].url.href, 'https://id.kick.com/oauth/token');
  assert.equal(form.get('code_verifier'), 'the-verifier');
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('redirect_uri'), cfg.redirectUri);

  const bad = mock(() => ({ status: 400, body: { error: 'Invalid request' } }));
  await assert.rejects(refreshKickToken(cfg, 'rt', bad.f), (e: unknown) => e instanceof KickAuthError && e.refused);
  const down = mock(() => ({ status: 503 }));
  await assert.rejects(refreshKickToken(cfg, 'rt', down.f), (e: unknown) => e instanceof KickAuthError && !e.refused);
});

test('own channel, subscribe, unsubscribe, chat', async () => {
  const m = mock((url, init) => {
    if (url.pathname === '/public/v1/channels') return { body: { data: [{ broadcaster_user_id: 42, slug: 'MyChan' }] } };
    if (url.pathname === '/public/v1/events/subscriptions' && init?.method === 'POST') {
      return { body: { data: KICK_EVENTS.map((name, i) => ({ name, version: 1, subscription_id: `sub${i}` })) } };
    }
    if (url.pathname === '/public/v1/events/subscriptions' && init?.method === 'DELETE') return { status: 204 };
    if (url.pathname === '/public/v1/events/subscriptions') {
      return { body: { data: [{ id: 'sA', broadcaster_user_id: 42 }, { id: 'sB', broadcaster_user_id: 43 }] } };
    }
    if (url.pathname === '/public/v1/chat') return { body: { data: { is_sent: true, message_id: 'x' } } };
    return { status: 404 };
  });
  assert.deepEqual(await fetchOwnChannel('tok', m.f), { userId: '42', slug: 'mychan' });
  assert.equal(new Headers(m.calls[0].init?.headers).get('authorization'), 'Bearer tok');

  const s = await subscribeChannelEvents('tok', m.f);
  assert.deepEqual(s, { ok: true, value: ['sub0', 'sub1', 'sub2', 'sub3', 'sub4'] });
  const sent = JSON.parse(String(m.calls[1].init?.body));
  assert.equal(sent.method, 'webhook');
  assert.deepEqual(sent.events.map((e: { name: string }) => e.name), [...KICK_EVENTS]);

  assert.equal(await unsubscribeChannelEvents('app', '42', m.f), true);
  const del = m.calls[m.calls.length - 1].url;
  assert.deepEqual(del.searchParams.getAll('id'), ['sA'], 'only this broadcaster’s subscriptions');

  const r = await postKickChat('tok', { type: 'bot', content: `line\none ${'x'.repeat(600)}`, replyTo: 'b6a5b1a2-1111-4c78-9e91-af35a172840e' }, m.f);
  assert.deepEqual(r, { ok: true, value: { sent: true } });
  const chat = JSON.parse(String(m.calls[m.calls.length - 1].init?.body));
  assert.equal(chat.type, 'bot');
  assert.equal(chat.broadcaster_user_id, undefined);
  assert.equal([...chat.content].length, 500);
  assert.ok(!chat.content.includes('\n'));
  assert.equal(chat.reply_to_message_id, 'b6a5b1a2-1111-4c78-9e91-af35a172840e');

  await postKickChat('tok', { type: 'user', content: 'hi', broadcasterUserId: '42', replyTo: 'not-a-uuid' }, m.f);
  const chat2 = JSON.parse(String(m.calls[m.calls.length - 1].init?.body));
  assert.deepEqual(chat2, { type: 'user', content: 'hi', broadcaster_user_id: 42 });

  const unauth = mock(() => ({ status: 401 }));
  assert.deepEqual(await postKickChat('tok', { type: 'bot', content: 'x' }, unauth.f), { ok: false, reason: 'unauthorized' });
});
