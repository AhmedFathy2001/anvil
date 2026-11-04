// YouTube entry gates against a real database, with Google mocked at fetch: the host's channel
// (encrypted, refreshed, broken), the subscriber proof from a viewer's token, the live-chat member
// code, proof expiry, and one YouTube channel per player per event.
//
// Run: npm run test:youtube   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('youtube-gates');

process.env.YOUTUBE_CLIENT_ID = 'ycid';
process.env.YOUTUBE_CLIENT_SECRET = 'ysecret';
process.env.YOUTUBE_REDIRECT_URI = 'https://anvil.test/api/auth/youtube/callback';
process.env.YOUTUBE_TOKEN_KEY = 'yt-test-key-'.padEnd(48, 'y');

const HOST_CH = 'UChostchannel0000000000a';
const CHAT = 'livechat123';

// ── The fake Google ─────────────────────────────────────────────────────────────────────────────

const net = {
  /** host access token the API accepts */
  hostToken: 'host-at-1',
  refresh: 'ok' as 'ok' | 'refused',
  refreshes: 0,
  /** viewer token → their channel + whether they subscribe to HOST_CH ('private' = forbidden) */
  viewers: new Map<string, { channel: string; title: string; sub: boolean | 'private' }>(),
  live: true,
  chat: [] as unknown[],
  chatReads: 0,
  broadcastReads: 0,
  revoked: [] as string[],
};

const realFetch = globalThis.fetch;
function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const token = (new Headers(init?.headers).get('authorization') ?? '').replace(/^Bearer /, '');
  if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/token') {
    net.refreshes++;
    if (net.refresh === 'refused') return reply({ error: 'invalid_grant' }, 400);
    net.hostToken = `host-at-${net.refreshes + 1}`;
    return reply({ access_token: net.hostToken, expires_in: 3599, scope: 'https://www.googleapis.com/auth/youtube.readonly' });
  }
  if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/revoke') {
    net.revoked.push(new URLSearchParams(String(init?.body)).get('token') ?? '');
    return reply({});
  }
  if (u.hostname === 'www.googleapis.com') {
    const viewer = net.viewers.get(token);
    if (u.pathname === '/youtube/v3/channels' && viewer) return reply({ items: [{ id: viewer.channel, snippet: { title: viewer.title } }] });
    if (u.pathname === '/youtube/v3/subscriptions' && viewer) {
      assert.equal(u.searchParams.get('forChannelId'), HOST_CH);
      if (viewer.sub === 'private') return reply({ error: { errors: [{ reason: 'subscriptionForbidden' }] } }, 403);
      return reply({ items: viewer.sub ? [{ id: 's' }] : [] });
    }
    if (token !== net.hostToken) return reply({ error: { code: 401 } }, 401);
    if (u.pathname === '/youtube/v3/liveBroadcasts') {
      net.broadcastReads++;
      return reply({ items: net.live ? [{ snippet: { liveChatId: CHAT } }] : [] });
    }
    if (u.pathname === '/youtube/v3/liveChat/messages') {
      net.chatReads++;
      assert.equal(u.searchParams.get('liveChatId'), CHAT);
      return reply({ items: net.chat, pollingIntervalMillis: 5000 });
    }
  }
  throw new Error(`unexpected fetch ${u.href}`);
}) as typeof fetch;

function chatMsg(text: string, channelId: string, sponsor: boolean) {
  return {
    snippet: { type: 'textMessageEvent', textMessageDetails: { messageText: text } },
    authorDetails: { channelId, displayName: 'Chatter', isChatSponsor: sponsor },
  };
}

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let E: typeof import('../src/lib/eventEntry.ts');
let G: typeof import('../src/lib/entryGatesDb.ts');
let Y: typeof import('../src/lib/gates/youtubeDb.ts');
let YT: typeof import('../src/lib/gates/youtube.ts');

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

let host: Awaited<ReturnType<typeof person>>;
let spaceId: number;

async function gatedEvent(name: string, gates: unknown): Promise<number> {
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: spaceId, name, boardSize: 5, entry: 'open', entryGates: JSON.stringify(gates) })
    .returning();
  return ev.id;
}

const enter = (p: Awaited<ReturnType<typeof person>>, eventId: number) =>
  E.enterEvent({ eventId, playerId: p.playerId, accountId: p.accountId, actorUserId: p.userId });

async function connectHost(accessToken = 'host-at-1') {
  await Y.saveHostYoutubeChannel({
    clanId: spaceId,
    userId: host.userId,
    cfg: YT.youtubeConfig()!,
    tokens: { accessToken, refreshToken: 'host-rt-1', expiresIn: 3600, scope: [YT.YOUTUBE_SCOPE] },
    channel: { id: HOST_CH, title: 'Cool Tube', handle: '@cooltube' },
  });
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  E = await import('../src/lib/eventEntry.ts');
  G = await import('../src/lib/entryGatesDb.ts');
  Y = await import('../src/lib/gates/youtubeDb.ts');
  YT = await import('../src/lib/gates/youtube.ts');
  const C = await import('../src/lib/clanCreate.ts');

  host = await person('Tuber');
  const r = await C.createCreatorSpace({ slug: 'yt-streamer', name: 'YT Streamer', ownerUserId: host.userId });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) return;
  spaceId = r.clanId;
  await connectHost();
});

beforeEach(() => {
  for (const k of [...Array(200).keys()]) G.gateCache.forgetUser(k);
  Y.clearYoutubeCachesForTests();
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

// ── Tests ───────────────────────────────────────────────────────────────────────────────────────

test('host tokens are stored encrypted; settings see title and handle only', async () => {
  const row = await db.query.clanYoutubeChannels.findFirst({ where: eq(s.clanYoutubeChannels.clanId, spaceId) });
  assert.ok(row!.accessToken.startsWith('enc1:') && !row!.accessToken.includes('host-at-1'));
  assert.ok(row!.refreshToken.startsWith('enc1:'));
  assert.deepEqual(await Y.hostYoutubeChannel(spaceId), { channelId: HOST_CH, title: 'Cool Tube', handle: '@cooltube', broken: false });
  const o = await G.gateOptions(spaceId);
  assert.deepEqual(o.youtube, {
    configured: true,
    channel: { title: 'Cool Tube', broken: false },
    connectUrl: `/api/auth/youtube/start?as=host&space=${spaceId}`,
  });
});

test('subscribers: unchecked → check button; a non-sub is told to subscribe; a sub gets in and the channel is claimed', async () => {
  const ev = await gatedEvent('Subs Bingo', { anyOf: [{ kind: 'youtube-sub' }] });
  const v = await person('Viewer Sub');

  const r1 = await enter(v, ev);
  assert.equal(r1.outcome, 'gated', JSON.stringify(r1));
  if (r1.outcome !== 'gated') return;
  assert.deepEqual(r1.gate.youtube, { verify: true });
  assert.deepEqual(r1.gate.steps, ['Check your YouTube subscription to Cool Tube']);
  assert.equal(r1.gate.summary, 'Open to subscribers of Cool Tube on YouTube.');

  net.viewers.set('viewer-tok-1', { channel: 'UCviewer1000000000000000', title: 'Viewer Chan', sub: false });
  assert.equal(await Y.proveSubscription({ userId: v.userId, hostChannelId: HOST_CH, token: 'viewer-tok-1' }), 'notsub');
  G.gateCache.forgetUser(v.userId);
  const r2 = await enter(v, ev);
  if (r2.outcome === 'gated') assert.deepEqual(r2.gate.steps, ['Subscribe to Cool Tube on YouTube, then check again']);
  else assert.fail(JSON.stringify(r2));

  net.viewers.set('viewer-tok-2', { channel: 'UCviewer1000000000000000', title: 'Viewer Chan', sub: true });
  assert.equal(await Y.proveSubscription({ userId: v.userId, hostChannelId: HOST_CH, token: 'viewer-tok-2' }), 'subscribed');
  G.gateCache.forgetUser(v.userId);
  assert.equal((await enter(v, ev)).outcome, 'seated');

  const claim = await db.query.eventYoutubeClaims.findFirst({
    where: and(eq(s.eventYoutubeClaims.eventId, ev), eq(s.eventYoutubeClaims.youtubeChannelId, 'UCviewer1000000000000000')),
  });
  assert.equal(claim?.userId, v.userId);

  const info = await G.entryGateInfo(ev, v.userId);
  assert.equal(info?.youtube?.checked, 'Viewer Chan');
  assert.equal(info?.youtube?.chatCode, null, 'no member rule, no code');
});

test('private subscriptions and channel-less accounts record nothing', async () => {
  const v = await person('Private Viewer');
  net.viewers.set('priv-tok', { channel: 'UCprivate000000000000000', title: 'P', sub: 'private' });
  assert.equal(await Y.proveSubscription({ userId: v.userId, hostChannelId: HOST_CH, token: 'priv-tok' }), 'private');
  assert.equal(await Y.freshProof(v.userId, HOST_CH, 'sub'), null);
});

test('one YouTube channel cannot get two Anvil logins into the same event', async () => {
  const ev = await gatedEvent('Shared Sub Bingo', { anyOf: [{ kind: 'youtube-sub' }] });
  const a = await person('Owner Login');
  const b = await person('Alt Login');
  net.viewers.set('shared-tok', { channel: 'UCshared0000000000000000', title: 'Shared', sub: true });
  assert.equal(await Y.proveSubscription({ userId: a.userId, hostChannelId: HOST_CH, token: 'shared-tok' }), 'subscribed');
  // One YouTube channel per Anvil login: the second sign-in is refused at the link.
  assert.equal(await Y.proveSubscription({ userId: b.userId, hostChannelId: HOST_CH, token: 'shared-tok' }), 'taken');
  assert.equal(await Y.viewerYoutube(b.userId), null);
  // Even with a proof somehow on file (e.g. linked before a's sign-in moved it), the event claim holds.
  await Y.recordProof({ userId: b.userId, hostChannelId: HOST_CH, kind: 'sub', channel: { id: 'UCshared0000000000000000', title: 'Shared' }, ok: true });

  assert.equal((await enter(a, ev)).outcome, 'seated');
  const r = await enter(b, ev);
  assert.equal(r.outcome, 'gated', JSON.stringify(r));
  if (r.outcome === 'gated') {
    assert.equal(r.gate.blocked, true);
    assert.deepEqual(r.gate.steps, [Y.YOUTUBE_ALREADY_USED]);
  }
});

test('a proof older than a day is asked for again', async () => {
  const ev = await gatedEvent('Stale Bingo', { anyOf: [{ kind: 'youtube-sub' }] });
  const v = await person('Stale Viewer');
  await Y.recordProof({ userId: v.userId, hostChannelId: HOST_CH, kind: 'sub', channel: { id: 'UCstale00000000000000000', title: 'S' }, ok: true });
  await db
    .update(s.userYoutubeProofs)
    .set({ checkedAt: new Date(Date.now() - Y.PROOF_TTL_MS - 1000).toISOString() })
    .where(eq(s.userYoutubeProofs.userId, v.userId));
  const r = await enter(v, ev);
  if (r.outcome === 'gated') assert.deepEqual(r.gate.youtube, { verify: true });
  else assert.fail(JSON.stringify(r));
});

test('members: the code in live chat from a member lets them in; a non-member and an unseen code do not', async () => {
  const ev = await gatedEvent('Members Bingo', { anyOf: [{ kind: 'youtube-member' }] });
  const m = await person('Member Viewer');
  const plain = await person('Plain Viewer');
  const quiet = await person('Quiet Viewer');

  const info = await G.entryGateInfo(ev, m.userId);
  const code = info?.youtube?.chatCode;
  assert.match(code ?? '', /^ANVIL-/);
  assert.equal(code, YT.chatCode(m.userId, HOST_CH, YT.youtubeConfig()!.tokenKey));

  const r1 = await enter(m, ev);
  if (r1.outcome === 'gated') assert.deepEqual(r1.gate.youtube, { chatCode: true });
  else assert.fail(JSON.stringify(r1));

  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: m.userId }), 'unlinked', 'no linked channel yet');
  await Y.linkViewerYoutube(m.userId, { id: 'UCmember0000000000000000', title: 'Member Chan' });
  await Y.linkViewerYoutube(plain.userId, { id: 'UCplain00000000000000000', title: 'Plain Chan' });
  await Y.linkViewerYoutube(quiet.userId, { id: 'UCquiet00000000000000000', title: 'Quiet Chan' });
  const plainCode = YT.chatCode(plain.userId, HOST_CH, YT.youtubeConfig()!.tokenKey);
  net.chat = [chatMsg(`hey ${code!.toLowerCase()}`, 'UCmember0000000000000000', true), chatMsg(plainCode, 'UCplain00000000000000000', false)];

  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: m.userId }), 'member');
  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: plain.userId }), 'not-member');
  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: quiet.userId }), 'not-seen');
  assert.equal(net.broadcastReads, 1, 'the live broadcast is looked up once');
  assert.equal(net.chatReads, 1, 'three checks within seconds share one chat read');

  G.gateCache.forgetUser(m.userId);
  assert.equal((await enter(m, ev)).outcome, 'seated');
  const p = await enter(plain, ev);
  if (p.outcome === 'gated') assert.deepEqual(p.gate.steps, ['Become a member of Cool Tube on YouTube, then type your code in a live chat again']);
  else assert.fail(JSON.stringify(p));
});

test('members: not live → offline, and no chat is read', async () => {
  const v = await person('Offline Viewer');
  await Y.linkViewerYoutube(v.userId, { id: 'UCoffline000000000000000', title: 'Off' });
  net.live = false;
  const reads = net.chatReads;
  try {
    assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: v.userId }), 'offline');
    assert.equal(net.chatReads, reads);
  } finally {
    net.live = true;
  }
});

test('an expired host token is refreshed; a refused refresh marks the channel broken', async () => {
  const v = await person('Refresh Viewer');
  await Y.linkViewerYoutube(v.userId, { id: 'UCrefresh000000000000000', title: 'Ref' });
  await db
    .update(s.clanYoutubeChannels)
    .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    .where(eq(s.clanYoutubeChannels.clanId, spaceId));
  const before = net.refreshes;
  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: v.userId }), 'not-seen');
  assert.equal(net.refreshes, before + 1);
  const row = await db.query.clanYoutubeChannels.findFirst({ where: eq(s.clanYoutubeChannels.clanId, spaceId) });
  assert.ok(Date.parse(row!.expiresAt) > Date.now());

  Y.clearYoutubeCachesForTests();
  net.hostToken = 'revoked-elsewhere';
  net.refresh = 'refused';
  try {
    assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: v.userId }), 'host-missing');
    assert.equal((await Y.hostYoutubeChannel(spaceId))?.broken, true);
    const ev = await gatedEvent('Broken Members', { anyOf: [{ kind: 'youtube-member' }] });
    const r = await enter(v, ev);
    if (r.outcome === 'gated') assert.deepEqual(r.gate.steps, ['The host’s YouTube connection isn’t working — let them know']);
    else assert.fail(JSON.stringify(r));
  } finally {
    net.refresh = 'ok';
  }
  // Reconnecting clears it.
  net.hostToken = 'host-at-fresh';
  await connectHost('host-at-fresh');
  assert.equal((await Y.hostYoutubeChannel(spaceId))?.broken, false);
});

test('disconnecting forgets the channel and revokes its grant; gates then fail closed', async () => {
  const ev = await gatedEvent('Disconnected Bingo', { anyOf: [{ kind: 'youtube-sub' }] });
  const v = await person('After Disconnect');
  await Y.disconnectHostYoutube(spaceId);
  assert.equal(await Y.hostYoutubeChannel(spaceId), null);
  assert.ok(net.revoked.includes('host-rt-1'));
  const r = await enter(v, ev);
  if (r.outcome === 'gated') assert.deepEqual(r.gate.steps, ['The host’s YouTube connection isn’t working — let them know']);
  else assert.fail(JSON.stringify(r));
  await connectHost(net.hostToken);
});

test('members: a member friend typing MY code does not make me a member; my own linked channel does', async () => {
  const ev = await gatedEvent('Friend Bingo', { anyOf: [{ kind: 'youtube-member' }] });
  const me = await person('Not A Member');
  await Y.linkViewerYoutube(me.userId, { id: 'UCnotmember0000000000000', title: 'My Chan' });
  const code = YT.chatCode(me.userId, HOST_CH, YT.youtubeConfig()!.tokenKey);

  // The friend (a member) types my code; I never did.
  net.chat = [chatMsg(code, 'UCfriend0000000000000000', true)];
  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: me.userId }), 'wrong-account');
  assert.equal(await Y.freshProof(me.userId, HOST_CH, 'member'), null, 'nothing recorded');
  const r = await enter(me, ev);
  assert.equal(r.outcome, 'gated', JSON.stringify(r));

  // Now I am a member and type it myself — after the friend's message, and with theirs still newer.
  Y.clearYoutubeCachesForTests();
  net.chat = [chatMsg(code, 'UCnotmember0000000000000', true), chatMsg(code, 'UCfriend0000000000000000', true)];
  assert.equal(await Y.checkChatCode({ clanId: spaceId, userId: me.userId }), 'member');
  G.gateCache.forgetUser(me.userId);
  assert.equal((await enter(me, ev)).outcome, 'seated');
  const claim = await db.query.eventYoutubeClaims.findFirst({ where: eq(s.eventYoutubeClaims.eventId, ev) });
  assert.equal(claim?.youtubeChannelId, 'UCnotmember0000000000000', 'the claim is on MY channel');
});

test('member-only events: the Google sign-in links the channel without a subscription check', async () => {
  const v = await person('Link Only');
  net.viewers.set('link-tok', { channel: 'UClinkonly00000000000000', title: 'Link Only', sub: false });
  assert.equal(await Y.proveSubscription({ userId: v.userId, hostChannelId: HOST_CH, token: 'link-tok', checkSub: false }), 'linked');
  assert.deepEqual(await Y.viewerYoutube(v.userId), { channelId: 'UClinkonly00000000000000', title: 'Link Only' });
  assert.equal(await Y.freshProof(v.userId, HOST_CH, 'sub'), null);
});
