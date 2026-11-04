// Stream highlights — the pure rules and the Twitch calls, with Twitch mocked at fetch. No database.
//
// Run: npm run test:highlights

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ClipLimiter,
  TokenBucket,
  cleanTitle,
  freshEnough,
  momentClippable,
  parseTwitchDuration,
  pickTwitchVod,
  pickYoutubeVod,
  planTargets,
  safeClipUrl,
  safeThumbnailUrl,
  twitchTimestamp,
  visibleToScope,
  vodRetryDelayMs,
  youtubeLiveNow,
  type HostChannels,
} from '../src/lib/highlights/rules.ts';
import { botConfig, canClip, makeClip, type BotConfig } from '../src/lib/highlights/twitchApi.ts';

// ── Whose channel ───────────────────────────────────────────────────────────────────────────────

const HOST: HostChannels = {
  autoClip: true,
  twitch: { broadcasterId: '111', login: 'hoststreams', ownerPlayerId: 1, broken: false },
  youtube: null,
};
const viewer = (optIn: boolean) => ({ playerId: 7, userId: 70, twitch: { id: '777', login: 'viewer7', clipOptIn: optIn } });

test('nothing on an event that is not streamed', () => {
  assert.deepEqual(planTargets({ streamed: false, beat: 'start', host: HOST, actor: null }), []);
  assert.deepEqual(planTargets({ streamed: false, beat: 'moment', host: HOST, actor: viewer(true) }), []);
});

test('event beats go to the host channel only', () => {
  for (const beat of ['start', 'board', 'won'] as const) {
    const t = planTargets({ streamed: true, beat, host: HOST, actor: viewer(true) });
    assert.deepEqual(t.map((x) => [x.owner, x.channelId]), [['host', '111']], beat);
  }
});

test("a player's beat: their own channel only when opted in; the host's only for the host's own characters", () => {
  assert.deepEqual(planTargets({ streamed: true, beat: 'moment', host: HOST, actor: viewer(false) }), []);
  const opted = planTargets({ streamed: true, beat: 'tile', host: HOST, actor: viewer(true) });
  assert.deepEqual(opted.map((x) => [x.owner, x.channelId, x.userId]), [['player', '777', 70]]);
  const hostsOwn = planTargets({ streamed: true, beat: 'moment', host: HOST, actor: { playerId: 1, userId: 10, twitch: null } });
  assert.deepEqual(hostsOwn.map((x) => [x.owner, x.channelId]), [['host', '111']]);
  // The host also linked the same Twitch as a viewer and opted in: one target, not two.
  const both = planTargets({ streamed: true, beat: 'moment', host: HOST, actor: { playerId: 1, userId: 10, twitch: { id: '111', login: 'hoststreams', clipOptIn: true } } });
  assert.equal(both.length, 1);
});

test('auto-clip off, or a broken channel, keeps the host channel out', () => {
  assert.deepEqual(planTargets({ streamed: true, beat: 'start', host: { ...HOST, autoClip: false }, actor: null }), []);
  assert.deepEqual(planTargets({ streamed: true, beat: 'start', host: { ...HOST, twitch: { ...HOST.twitch!, broken: true } }, actor: null }), []);
  // A player's own opt-in does not depend on the host's switch.
  assert.equal(planTargets({ streamed: true, beat: 'moment', host: { ...HOST, autoClip: false }, actor: viewer(true) }).length, 1);
});

test('a YouTube host gets a YouTube target for event beats', () => {
  const host: HostChannels = { autoClip: true, twitch: null, youtube: { channelId: 'UCx', title: 'Tube', ownerPlayerId: 1, broken: false } };
  assert.deepEqual(planTargets({ streamed: true, beat: 'won', host, actor: null }).map((t) => t.platform), ['youtube']);
});

test('which moments are big enough', () => {
  assert.equal(momentClippable('pet', false), true);
  assert.equal(momentClippable('unique', true), true);
  assert.equal(momentClippable('loot', false), false);
  assert.equal(momentClippable('death', true), false);
  assert.equal(momentClippable('level', true), false);
});

test('a stale beat is not clipped (a clip is the last ~30 s)', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(freshEnough(now - 30_000, now), true);
  assert.equal(freshEnough(now - 10 * 60_000, now), false);
  assert.equal(freshEnough(NaN, now), false);
});

// ── Titles ──────────────────────────────────────────────────────────────────────────────────────

test('titles are one clean bounded line', () => {
  assert.equal(cleanTitle('Zezima\n got <b>Twisted bow</b>\u202e'), 'Zezima got bTwisted bow/b');
  assert.equal(cleanTitle('a'.repeat(300)).length, 100);
  assert.ok(cleanTitle('a'.repeat(300)).endsWith('…'));
});

// ── Rate limits ─────────────────────────────────────────────────────────────────────────────────

test('per channel: a burst of three, then one a minute', () => {
  const t0 = 1_000_000;
  const lim = new ClipLimiter({ channelBurst: 3, channelRefillMs: 60_000, globalBurst: 100, globalRefillMs: 1 }, t0);
  assert.deepEqual([1, 2, 3, 4].map(() => lim.allow('a', t0)), [true, true, true, false]);
  assert.equal(lim.allow('b', t0), true, 'another channel has its own bucket');
  assert.equal(lim.allow('a', t0 + 30_000), false);
  assert.equal(lim.allow('a', t0 + 60_000), true);
  assert.equal(lim.allow('a', t0 + 60_001), false);
});

test('globally: a refused channel spends nothing; the global cap holds across channels', () => {
  const t0 = 5_000_000;
  const lim = new ClipLimiter({ channelBurst: 1, channelRefillMs: 60_000, globalBurst: 2, globalRefillMs: 60_000 }, t0);
  assert.equal(lim.allow('a', t0), true);
  assert.equal(lim.allow('a', t0), false); // channel says no — global keeps its token
  assert.equal(lim.allow('b', t0), true);
  assert.equal(lim.allow('c', t0), false); // global is spent
  const b = new TokenBucket(1, 1000, 0);
  assert.equal(b.peek(0), true);
  assert.equal(b.take(0), true);
  assert.equal(b.peek(500), false);
});

// ── VOD offsets ─────────────────────────────────────────────────────────────────────────────────

test("Twitch's duration and t= formats", () => {
  assert.equal(parseTwitchDuration('3h8m33s'), 3 * 3600 + 8 * 60 + 33);
  assert.equal(parseTwitchDuration('45m2s'), 2702);
  assert.equal(parseTwitchDuration('59s'), 59);
  assert.equal(parseTwitchDuration('soon'), null);
  assert.equal(parseTwitchDuration(''), null);
  assert.equal(twitchTimestamp(3723), '1h2m3s');
  assert.equal(twitchTimestamp(3600), '1h0m0s');
  assert.equal(twitchTimestamp(245), '4m5s');
  assert.equal(twitchTimestamp(6), '6s');
  assert.equal(twitchTimestamp(-4), '0s');
});

test('the Twitch archive covering the moment, with a 15 s lead-in', () => {
  const start = Date.parse('2026-11-04T10:00:00Z');
  const videos = [
    { id: '900', createdAt: '2026-11-03T10:00:00Z', duration: '2h0m0s' },
    { id: '901', createdAt: '2026-11-04T10:00:00Z', duration: '1h30m0s' },
  ];
  const at = start + (3600 + 2 * 60 + 30) * 1000; // 1h2m30s in
  assert.deepEqual(pickTwitchVod(videos, at), { url: 'https://www.twitch.tv/videos/901?t=1h2m15s', offsetS: 3735 });
  // Seconds in: the lead-in never goes below zero.
  assert.equal(pickTwitchVod(videos, start + 5_000)?.url, 'https://www.twitch.tv/videos/901?t=0s');
  // Before the stream, or long after it: nothing.
  assert.equal(pickTwitchVod(videos, start - 60_000), null);
  assert.equal(pickTwitchVod(videos, start + 3 * 3600 * 1000), null);
  // A live archive a little behind the moment still matches (slack).
  assert.ok(pickTwitchVod(videos, start + (90 * 60 + 60) * 1000));
  // Odd ids from the API never become links.
  assert.equal(pickTwitchVod([{ id: 'x/../1', createdAt: '2026-11-04T10:00:00Z', duration: '1h0m0s' }], start + 1000), null);
});

test('the YouTube broadcast covering the moment, t= in seconds', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const list = [
    { id: 'oldbroadcast1', actualStartTime: '2026-11-01T10:00:00Z', actualEndTime: '2026-11-01T12:00:00Z' },
    { id: 'livebroadcast', actualStartTime: '2026-11-04T11:00:00Z', actualEndTime: null },
    { id: 'scheduled0001', actualStartTime: null, actualEndTime: null },
  ];
  assert.deepEqual(pickYoutubeVod(list, Date.parse('2026-11-04T11:10:00Z'), now), { url: 'https://youtu.be/livebroadcast?t=585', offsetS: 585 });
  assert.equal(pickYoutubeVod(list, Date.parse('2026-11-01T10:00:10Z'), now)?.url, 'https://youtu.be/oldbroadcast1?t=0');
  assert.equal(pickYoutubeVod(list, Date.parse('2026-11-02T11:00:00Z'), now), null);
  assert.equal(youtubeLiveNow(list), true);
  assert.equal(youtubeLiveNow([list[0], list[2]]), false);
});

test('VOD retries back off and cap', () => {
  assert.equal(vodRetryDelayMs(0), 2 * 60_000);
  assert.equal(vodRetryDelayMs(1), 4 * 60_000);
  assert.equal(vodRetryDelayMs(20), 2 * 60 * 60_000);
});

// ── What Twitch sends back ──────────────────────────────────────────────────────────────────────

test("only Twitch's own hosts survive as links", () => {
  assert.equal(safeClipUrl('https://clips.twitch.tv/FunnyClip-abc'), 'https://clips.twitch.tv/FunnyClip-abc');
  assert.equal(safeClipUrl('https://evil.example/clip'), null);
  assert.equal(safeClipUrl('javascript:alert(1)'), null);
  assert.equal(safeClipUrl('http://clips.twitch.tv/x'), null);
  assert.equal(safeThumbnailUrl('https://static-cdn.jtvnw.net/twitch-clips/x.jpg'), 'https://static-cdn.jtvnw.net/twitch-clips/x.jpg');
  assert.equal(safeThumbnailUrl('https://jtvnw.net.evil.example/x.jpg'), null);
});

// ── Visibility ──────────────────────────────────────────────────────────────────────────────────

test('hidden standings: only your own team, and the start (which names no side)', () => {
  const rows = [
    { id: 1, beat: 'start', teamId: null },
    { id: 2, beat: 'moment', teamId: 5 },
    { id: 3, beat: 'moment', teamId: 6 },
    { id: 4, beat: 'h2h', teamId: null },
  ];
  const mine = (t: number | null) => t === 5;
  assert.deepEqual(visibleToScope(rows, mine).map((r) => r.id), [1, 2]);
  assert.deepEqual(visibleToScope(rows, () => true).map((r) => r.id), [1, 2, 3, 4]);
});

// ── The clip's life (Twitch mocked) ─────────────────────────────────────────────────────────────

const CFG: BotConfig = { clientId: 'botcid', clientSecret: 's', refreshSeed: 'r', tokenKey: null };

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeTwitch(opts: { create: number; readyAfter: number; clipUrl?: string }) {
  const calls: string[] = [];
  let looks = 0;
  const f = async (input: string, init?: RequestInit) => {
    const u = new URL(input);
    assert.equal(u.hostname, 'api.twitch.tv');
    assert.equal(new Headers(init?.headers).get('client-id'), 'botcid');
    calls.push(`${init?.method ?? 'GET'} ${u.pathname}`);
    if (init?.method === 'POST') {
      assert.equal(u.searchParams.get('broadcaster_id'), '111');
      if (opts.create !== 202) return reply({ message: 'no' }, opts.create);
      return reply({ data: [{ id: 'AwkwardClip-1', edit_url: 'https://clips.twitch.tv/AwkwardClip-1/edit' }] }, 202);
    }
    looks++;
    if (looks < opts.readyAfter) return reply({ data: [] });
    return reply({
      data: [{ id: 'AwkwardClip-1', url: opts.clipUrl ?? 'https://clips.twitch.tv/AwkwardClip-1', thumbnail_url: 'https://static-cdn.jtvnw.net/twitch-clips/t.jpg', duration: 29.9 }],
    });
  };
  return { f, calls };
}

test('clip lifecycle: create, wait ~15 s, look until ready', async () => {
  const slept: number[] = [];
  const tw = fakeTwitch({ create: 202, readyAfter: 2 });
  const out = await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '111', f: tw.f, sleep: async (ms) => void slept.push(ms) });
  assert.deepEqual(out, {
    ok: true,
    clip: { id: 'AwkwardClip-1', url: 'https://clips.twitch.tv/AwkwardClip-1', thumbnailUrl: 'https://static-cdn.jtvnw.net/twitch-clips/t.jpg', durationS: 29.9 },
  });
  assert.deepEqual(slept, [15_000, 10_000]);
  assert.deepEqual(tw.calls, ['POST /helix/clips', 'GET /helix/clips', 'GET /helix/clips']);
});

test('clip lifecycle: never ready → timeout after ~60 s', async () => {
  const slept: number[] = [];
  const tw = fakeTwitch({ create: 202, readyAfter: 99 });
  const out = await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '111', f: tw.f, sleep: async (ms) => void slept.push(ms) });
  assert.deepEqual(out, { ok: false, reason: 'timeout' });
  assert.ok(slept.reduce((a, b) => a + b, 0) <= 60_000);
});

test('clip lifecycle: offline, restricted, or a clip URL off Twitch', async () => {
  const sleep = async () => {};
  assert.deepEqual(await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '111', f: fakeTwitch({ create: 404, readyAfter: 1 }).f, sleep }), { ok: false, reason: 'not-live' });
  assert.deepEqual(await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '111', f: fakeTwitch({ create: 403, readyAfter: 1 }).f, sleep }), { ok: false, reason: 'forbidden' });
  assert.deepEqual(await makeClip({ cfg: CFG, token: async () => null, broadcasterId: '111', f: fakeTwitch({ create: 202, readyAfter: 1 }).f, sleep }), { ok: false, reason: 'unauthorized' });
  const evil = await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '111', f: fakeTwitch({ create: 202, readyAfter: 1, clipUrl: 'https://evil.example/x' }).f, sleep });
  assert.deepEqual(evil, { ok: false, reason: 'timeout' });
  // A broadcaster id that isn't digits never reaches the network.
  assert.deepEqual(await makeClip({ cfg: CFG, token: async () => 'tok', broadcasterId: '1&x=2', f: () => assert.fail('no fetch'), sleep }), { ok: false, reason: 'error' });
});

test('bot config and the clips scope', () => {
  assert.equal(botConfig({}), null);
  assert.deepEqual(botConfig({ TWITCH_BOT_CLIENT_ID: 'a', TWITCH_BOT_CLIENT_SECRET: 'b', TWITCH_BOT_REFRESH_TOKEN: 'c', TWITCH_TOKEN_KEY: 'short' }), {
    clientId: 'a',
    clientSecret: 'b',
    refreshSeed: 'c',
    tokenKey: null,
  });
  assert.equal(canClip(['user:read:chat', 'user:write:chat']), false);
  assert.equal(canClip(['user:read:chat', 'clips:edit']), true);
});
