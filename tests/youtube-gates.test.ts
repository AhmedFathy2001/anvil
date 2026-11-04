// YouTube entry gates — the pure half: the rules in lib/entryGates as they concern YouTube, and the
// Google/YouTube client in lib/gates/youtube against a mocked fetch. No database, no network.
//
// Run: npm run test:youtube

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkGates,
  gatesSummary,
  parseGates,
  serializeGates,
  validateGatesFor,
  type EntryGates,
  type GateOptions,
  type GateProbe,
} from '../src/lib/entryGates.ts';
import {
  YOUTUBE_SCOPE,
  YoutubeAuthError,
  activeLiveChatId,
  authorizeUrl,
  chatCode,
  exchangeCode,
  fetchMyChannel,
  findCodeInChat,
  messageHasCode,
  recentChat,
  refreshToken,
  signState,
  subscribesTo,
  verifyState,
  youtubeConfig,
  type FetchLike,
  type YoutubeAnswer,
  type YoutubeState,
} from '../src/lib/gates/youtube.ts';

const HOST = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const VIEWER = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const KEY = 'k'.repeat(48);
const cfg = { clientId: 'cid', clientSecret: 'cs', redirectUri: 'https://anvil.test/api/auth/youtube/callback', tokenKey: KEY };
const ctx = { twitchLogin: null, hostName: 'Cool Streamer', youtubeTitle: 'Cool Tube' };

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function apiError(status: number, reason: string): Response {
  return reply({ error: { code: status, errors: [{ reason }] } }, status);
}

// ── Rules ───────────────────────────────────────────────────────────────────────────────────────

test('parseGates keeps the YouTube kinds once each, after the others', () => {
  const g = parseGates({
    anyOf: [{ kind: 'youtube-member', x: 1 }, { kind: 'youtube-sub' }, { kind: 'youtube-sub' }, { kind: 'twitch-follow' }],
  });
  assert.deepEqual(g, { anyOf: [{ kind: 'twitch-follow' }, { kind: 'youtube-sub' }, { kind: 'youtube-member' }] });
  assert.deepEqual(parseGates(serializeGates(g)), g);
});

test('labels and summary name the host’s YouTube channel', () => {
  const g: EntryGates = { anyOf: [{ kind: 'youtube-sub' }, { kind: 'youtube-member' }] };
  assert.equal(gatesSummary(g, ctx), 'Open to subscribers of Cool Tube on YouTube or members of Cool Tube on YouTube.');
  assert.equal(gatesSummary(g, { ...ctx, youtubeTitle: null }), 'Open to subscribers of the host on YouTube or members of the host on YouTube.');
});

const OPTS: GateOptions = {
  twitch: { configured: false, channel: null, connectUrl: null },
  discord: { connected: false, roles: [] },
  youtube: { configured: true, channel: { title: 'Cool Tube', broken: false }, connectUrl: '/x' },
};

test('a host can only pick YouTube rules with YouTube configured and a working channel', () => {
  const g: EntryGates = { anyOf: [{ kind: 'youtube-member' }] };
  assert.deepEqual(validateGatesFor(g, OPTS), { ok: true });
  assert.equal(validateGatesFor(g, { ...OPTS, youtube: undefined }).ok, false);
  assert.equal(validateGatesFor(g, { ...OPTS, youtube: { configured: true, channel: null, connectUrl: '/x' } }).ok, false);
  const broken = validateGatesFor(g, { ...OPTS, youtube: { configured: true, channel: { title: 'a', broken: true }, connectUrl: '/x' } });
  assert.deepEqual(broken, { ok: false, error: 'Connect your YouTube channel first.' });
});

function ytProbe(sub: YoutubeAnswer, member: YoutubeAnswer): GateProbe {
  return {
    twitchFollows: async () => ({ state: 'ok', value: false }),
    twitchSubTier: async () => ({ state: 'ok', value: 0 }),
    discordMember: async () => ({ state: 'ok', member: false }),
    youtubeSub: async () => sub,
    youtubeMember: async () => member,
  };
}

test('checkGates: a proof on file passes; none asks for the check (sub) or the chat code (member)', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'youtube-sub' }, { kind: 'youtube-member' }] };
  assert.deepEqual(await checkGates(g, ytProbe({ state: 'ok', value: true }, { state: 'unchecked' }), ctx), { pass: true, via: 'youtube-sub' });
  assert.deepEqual(await checkGates(g, ytProbe({ state: 'ok', value: false }, { state: 'ok', value: true }), ctx), {
    pass: true,
    via: 'youtube-member',
  });

  const v = await checkGates(g, ytProbe({ state: 'unchecked' }, { state: 'unchecked' }), ctx);
  assert.equal(v.pass, false);
  if (v.pass) return;
  assert.equal(v.transient, false);
  assert.deepEqual(v.youtube, { verify: true, chatCode: true });
  assert.deepEqual(v.steps, [
    'Check your YouTube subscription to Cool Tube',
    'While Cool Tube is live, type your Anvil code in the YouTube chat from your linked account (members only)',
  ]);

  const no = await checkGates({ anyOf: [{ kind: 'youtube-sub' }] }, ytProbe({ state: 'ok', value: false }, { state: 'unchecked' }), ctx);
  if (!no.pass) assert.deepEqual(no.steps, ['Subscribe to Cool Tube on YouTube, then check again']);
});

test('checkGates: no YouTube probe (or a host without a channel) fails closed with the host’s step', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'youtube-sub' }] };
  const bare: GateProbe = {
    twitchFollows: async () => ({ state: 'ok', value: false }),
    twitchSubTier: async () => ({ state: 'ok', value: 0 }),
    discordMember: async () => ({ state: 'ok', member: false }),
  };
  const v = await checkGates(g, bare, ctx);
  assert.equal(v.pass, false);
  if (!v.pass) {
    assert.deepEqual(v.steps, ['The host’s YouTube connection isn’t working — let them know']);
    assert.equal(v.youtube, undefined);
  }
  const thrown = await checkGates(g, { ...bare, youtubeSub: async () => Promise.reject(new Error('boom')) }, ctx);
  assert.equal(thrown.pass, false);
});

// ── Chat code ───────────────────────────────────────────────────────────────────────────────────

test('chat code: stable per (user, host), different across users and hosts, unambiguous letters', () => {
  const a = chatCode(1, HOST, KEY);
  assert.match(a, /^ANVIL-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(chatCode(1, HOST, KEY), a);
  assert.notEqual(chatCode(2, HOST, KEY), a);
  assert.notEqual(chatCode(1, VIEWER, KEY), a);
  assert.notEqual(chatCode(1, HOST, 'z'.repeat(48)), a, 'keyed: not guessable without the server key');
});

test('messageHasCode forgives case, spaces and the dash; findCodeInChat takes the newest sighting', () => {
  const code = 'ANVIL-AB2CD3';
  assert.equal(messageHasCode('hi anvil ab2cd3 pls', code), true);
  assert.equal(messageHasCode('ANVIL-AB2CD', code), false);
  assert.equal(messageHasCode(42, code), false);

  const msg = (text: string, channelId: string, sponsor: boolean, type = 'textMessageEvent') => ({
    snippet: { type, textMessageDetails: { messageText: text } },
    authorDetails: { channelId, displayName: 'Viewer\u0007', isChatSponsor: sponsor },
  });
  const items = [
    msg('ANVIL-AB2CD3', VIEWER, true),
    msg('ANVIL-AB2CD3', 'not-a-channel', true),
    msg('ANVIL-AB2CD3', 'UCcccccccccccccccccccccc', false),
    msg('ANVIL-AB2CD3', VIEWER, true, 'superChatEvent'),
  ];
  assert.deepEqual(findCodeInChat(items, code), { channelId: 'UCcccccccccccccccccccccc', displayName: 'Viewer', member: false });
  assert.deepEqual(findCodeInChat(items.slice(0, 2), code), { channelId: VIEWER, displayName: 'Viewer', member: true });
  assert.equal(findCodeInChat([], code), null);
  assert.equal(findCodeInChat('nope', code), null);
});

// ── OAuth ───────────────────────────────────────────────────────────────────────────────────────

test('config needs all four values and a long key', () => {
  const env = { YOUTUBE_CLIENT_ID: 'a', YOUTUBE_CLIENT_SECRET: 'b', YOUTUBE_REDIRECT_URI: 'c', YOUTUBE_TOKEN_KEY: KEY };
  assert.ok(youtubeConfig(env));
  assert.equal(youtubeConfig({ ...env, YOUTUBE_TOKEN_KEY: 'short' }), null);
  assert.equal(youtubeConfig({ ...env, YOUTUBE_CLIENT_SECRET: '' }), null);
});

test('state: signed, expiring, well-formed — tampering or another key fails', () => {
  const s: YoutubeState = { u: 7, m: 'viewer', c: 12, r: '/events/12', h: null, n: 'n'.repeat(24), e: Date.now() + 60_000 };
  const tok = signState(s, KEY);
  assert.deepEqual(verifyState(tok, KEY), s);
  assert.equal(verifyState(tok, 'x'.repeat(48)), null);
  const [body, mac] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ ...s, u: 8 })).toString('base64url');
  assert.equal(verifyState(`${forged}.${mac}`, KEY), null);
  assert.equal(verifyState(`${body}.${mac}x`, KEY), null);
  assert.equal(verifyState(signState({ ...s, e: Date.now() - 1 }, KEY), KEY), null);
  assert.equal(verifyState(signState({ ...s, c: 0 }, KEY), KEY), null);
  assert.equal(verifyState(signState({ ...s, m: 'admin' as never }, KEY), KEY), null);
});

test('authorize URL: read-only scope; host asks offline + consent, viewer does not', () => {
  const host = new URL(authorizeUrl(cfg, 'host', 'st'));
  assert.equal(host.origin + host.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(host.searchParams.get('scope'), YOUTUBE_SCOPE);
  assert.equal(host.searchParams.get('access_type'), 'offline');
  assert.match(host.searchParams.get('prompt')!, /consent/);
  assert.equal(host.searchParams.get('redirect_uri'), cfg.redirectUri);
  const viewer = new URL(authorizeUrl(cfg, 'viewer', 'st'));
  assert.equal(viewer.searchParams.get('access_type'), 'online');
  assert.doesNotMatch(viewer.searchParams.get('prompt')!, /consent/);
});

test('token exchange: scope parsed, a 400 is a refusal, a 5xx is not', async () => {
  const ok: FetchLike = async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get('client_secret'), 'cs');
    return reply({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: `${YOUTUBE_SCOPE} openid` });
  };
  const set = await exchangeCode(cfg, 'code', ok);
  assert.deepEqual(set, { accessToken: 'at', refreshToken: 'rt', expiresIn: 3599, scope: [YOUTUBE_SCOPE, 'openid'] });

  await assert.rejects(refreshToken(cfg, 'rt', async () => reply({ error: 'invalid_grant' }, 400)), (e: unknown) => e instanceof YoutubeAuthError && e.refused);
  await assert.rejects(refreshToken(cfg, 'rt', async () => reply({}, 503)), (e: unknown) => e instanceof YoutubeAuthError && !e.refused);
});

// ── Data API ────────────────────────────────────────────────────────────────────────────────────

test('fetchMyChannel: the channel, its handle, or null when the account has none', async () => {
  const f: FetchLike = async (url, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer tok');
    assert.match(url, /\/youtube\/v3\/channels\?part=snippet&mine=true/);
    return reply({ items: [{ id: VIEWER, snippet: { title: ' My Chan ', customUrl: '@mychan' } }] });
  };
  assert.deepEqual(await fetchMyChannel('tok', f), { ok: true, value: { id: VIEWER, title: 'My Chan', handle: '@mychan' } });
  assert.deepEqual(await fetchMyChannel('tok', async () => reply({ items: [] })), { ok: true, value: null });
  assert.deepEqual(await fetchMyChannel('tok', async () => reply({ items: [{ id: 'bogus' }] })), { ok: false, reason: 'error' });
});

test('subscribesTo: one item = yes, none = no; private, quota, 401 and outages are told apart', async () => {
  const f: FetchLike = async (url) => {
    const u = new URL(url);
    assert.equal(u.pathname, '/youtube/v3/subscriptions');
    assert.equal(u.searchParams.get('mine'), 'true');
    assert.equal(u.searchParams.get('forChannelId'), HOST);
    return reply({ items: [{ id: 'sub1' }] });
  };
  assert.deepEqual(await subscribesTo('tok', HOST, f), { ok: true, value: true });
  assert.deepEqual(await subscribesTo('tok', HOST, async () => reply({ items: [] })), { ok: true, value: false });
  assert.deepEqual(await subscribesTo('tok', HOST, async () => apiError(403, 'subscriptionForbidden')), {
    ok: false,
    reason: 'forbidden',
    detail: 'subscriptionForbidden',
  });
  assert.deepEqual(await subscribesTo('tok', HOST, async () => apiError(403, 'quotaExceeded')), { ok: false, reason: 'quota' });
  assert.deepEqual(await subscribesTo('tok', HOST, async () => reply({}, 401)), { ok: false, reason: 'unauthorized' });
  assert.deepEqual(await subscribesTo('tok', HOST, async () => Promise.reject(new Error('net'))), { ok: false, reason: 'error' });
  assert.deepEqual(await subscribesTo('tok', 'not-a-channel', f), { ok: false, reason: 'error' }, 'never sends a bad id');
});

test('activeLiveChatId and recentChat read the host’s live broadcast and its chat', async () => {
  const f: FetchLike = async (url) => {
    const u = new URL(url);
    if (u.pathname === '/youtube/v3/liveBroadcasts') {
      assert.equal(u.searchParams.get('broadcastStatus'), 'active');
      return reply({ items: [{ snippet: { liveChatId: 'Cg0KC2xpdmVjaGF0' } }] });
    }
    assert.equal(u.pathname, '/youtube/v3/liveChat/messages');
    assert.equal(u.searchParams.get('liveChatId'), 'Cg0KC2xpdmVjaGF0');
    assert.equal(u.searchParams.get('part'), 'snippet,authorDetails');
    return reply({ items: [{ id: 'm1' }], pollingIntervalMillis: 5000 });
  };
  assert.deepEqual(await activeLiveChatId('tok', f), { ok: true, value: 'Cg0KC2xpdmVjaGF0' });
  assert.deepEqual(await activeLiveChatId('tok', async () => reply({ items: [] })), { ok: true, value: null });
  assert.deepEqual(await recentChat('tok', 'Cg0KC2xpdmVjaGF0', f), { ok: true, value: [{ id: 'm1' }] });
});
