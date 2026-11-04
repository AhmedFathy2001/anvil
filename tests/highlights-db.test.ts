// Stream highlights against a real database, with Twitch (and its token endpoint) mocked at fetch:
// which beats are caught where (streamed only, opt-ins, live only), dedupe, rate limits, the clip's
// life, VOD links, the bot token at rest, a token without clips:edit, and who may see what.
//
// Run: npm run test:highlights   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('highlights');

process.env.TWITCH_BOT_CLIENT_ID = 'botcid';
process.env.TWITCH_BOT_CLIENT_SECRET = 'botsecret';
process.env.TWITCH_BOT_REFRESH_TOKEN = 'seed-rt';
process.env.TWITCH_TOKEN_KEY = 'tw-test-key-'.padEnd(48, 't');
process.env.HIGHLIGHTS_CLIPS = 'on';

const HOST_TW = '111';
const VIEWER_TW = '777';

// ── The fake Twitch ─────────────────────────────────────────────────────────────────────────────

const net = {
  scopes: ['user:read:chat', 'user:write:chat', 'clips:edit'],
  live: new Set<string>([HOST_TW]),
  /** GET /clips answers with the clip after this many looks (Infinity = never). */
  readyAfter: 1,
  looks: 0,
  clipsMade: [] as string[],
  refreshes: 0,
  calls: [] as string[],
  archives: new Map<string, { id: string; created_at: string; duration: string }[]>(),
};

const realFetch = globalThis.fetch;
function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  net.calls.push(`${init?.method ?? 'GET'} ${u.hostname}${u.pathname}`);
  if (u.hostname === 'id.twitch.tv' && u.pathname === '/oauth2/token') {
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get('client_id'), 'botcid');
    net.refreshes++;
    return reply({ access_token: `bot-at-${net.refreshes}`, refresh_token: form.get('refresh_token'), expires_in: 14_000 });
  }
  if (u.hostname === 'id.twitch.tv' && u.pathname === '/oauth2/validate') {
    return reply({ user_id: '424242', login: 'anvil_osrs', scopes: net.scopes, expires_in: 14_000 });
  }
  if (u.hostname === 'api.twitch.tv') {
    assert.equal(new Headers(init?.headers).get('client-id'), 'botcid');
    if (u.pathname === '/helix/streams') {
      const id = u.searchParams.get('user_id')!;
      return reply({ data: net.live.has(id) ? [{ type: 'live', started_at: new Date(Date.now() - 3_600_000).toISOString() }] : [] });
    }
    if (u.pathname === '/helix/clips' && init?.method === 'POST') {
      const b = u.searchParams.get('broadcaster_id')!;
      if (!net.live.has(b)) return reply({ message: 'not live' }, 404);
      const id = `Clip-${b}-${net.clipsMade.length + 1}`;
      net.clipsMade.push(id);
      return reply({ data: [{ id, edit_url: `https://clips.twitch.tv/${id}/edit` }] }, 202);
    }
    if (u.pathname === '/helix/clips') {
      net.looks++;
      const id = u.searchParams.get('id')!;
      if (net.looks < net.readyAfter) return reply({ data: [] });
      return reply({ data: [{ id, url: `https://clips.twitch.tv/${id}`, thumbnail_url: `https://static-cdn.jtvnw.net/twitch-clips/${id}.jpg`, duration: 30 }] });
    }
    if (u.pathname === '/helix/videos') {
      return reply({ data: net.archives.get(u.searchParams.get('user_id')!) ?? [] });
    }
  }
  throw new Error(`unexpected fetch ${u.href}`);
}) as typeof fetch;

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/highlights/store.ts');
let BT: typeof import('../src/lib/highlights/botToken.ts');
let R: typeof import('../src/lib/highlights/rules.ts');

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 86_400_000;

let n = 0;
async function person(name: string) {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase(), verifiedAt: iso(0) }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99600000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: u.id, playerId: pl.id, accountId: a.id };
}

let host: Awaited<ReturnType<typeof person>>;
let viewer: Awaited<ReturnType<typeof person>>;
let spaceId: number;
let plainClanId: number;
let eventId: number;
let plainEventId: number;
let red: number;
let blue: number;
let viewerSeat: number;
let hostSeat: number;
let viewerParticipant: number;

async function seat(clanId: number, accountId: number, ev: number, teamId: number, name: string) {
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId, kind: 'event', eventId: ev }).returning();
  const [p] = await db.insert(s.eventParticipants).values({ eventId: ev, teamId, clanMemberId: m.id, accountId, name }).returning();
  return { seatId: m.id, participantId: p.id };
}

let mk = 0;
async function moment(clanMemberId: number, rsn: string, kind: string, teamId: number, extra: Partial<typeof s.moments.$inferInsert> = {}) {
  mk += 1;
  const [m] = await db
    .insert(s.moments)
    .values({ clanMemberId, rsn, kind, eventId, teamId, quantity: 1, occurredAt: iso(-5_000), dedupKey: `k${mk}`, ...extra })
    .returning();
  return { ...m, valueGp: m.valueGp ?? null };
}

const rows = (ev = eventId) => db.select().from(s.streamHighlights).where(eq(s.streamHighlights.eventId, ev));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/highlights/store.ts');
  BT = await import('../src/lib/highlights/botToken.ts');
  R = await import('../src/lib/highlights/rules.ts');

  host = await person('Streamer');
  viewer = await person('Viewer');
  const [c] = await db.insert(s.clans).values({ slug: 'streamer', name: 'Streamer', kind: 'creator', plan: 'creator_free', visibility: 'public' }).returning();
  spaceId = c.id;
  const [plain] = await db.insert(s.clans).values({ slug: 'plain', name: 'Plain Clan', visibility: 'public' }).returning();
  plainClanId = plain.id;
  // The host's connected channel. The highlights never use the host's token, so it's opaque here.
  await db.insert(s.clanTwitchChannels).values({
    clanId: spaceId,
    twitchUserId: HOST_TW,
    twitchLogin: 'streamer',
    accessToken: 'enc1:x:y:z',
    refreshToken: 'enc1:x:y:z',
    expiresAt: iso(DAY),
    scope: 'moderator:read:followers channel:read:subscriptions',
    linkedByUserId: host.userId,
  });
  await db.insert(s.clanTwitchChannels).values({
    clanId: plainClanId,
    twitchUserId: '222',
    twitchLogin: 'plainclan',
    accessToken: 'enc1:x:y:z',
    refreshToken: 'enc1:x:y:z',
    expiresAt: iso(DAY),
    scope: '',
    linkedByUserId: host.userId,
  });
  net.live.add('222');
  const [e] = await db
    .insert(s.events)
    .values({ clanId: spaceId, name: 'Stream Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  eventId = e.id;
  const [pe] = await db
    .insert(s.events)
    .values({ clanId: plainClanId, name: 'Clan Bingo', boardSize: 2, visibility: 'public', startDate: iso(-DAY), endDate: iso(5 * DAY), tilesRevealed: 1 })
    .returning();
  plainEventId = pe.id;
  const [r, b] = await db
    .insert(s.teams)
    .values([
      { eventId, name: 'Red', color: '#ff0000' },
      { eventId, name: 'Blue', color: '#0000ff' },
    ])
    .returning();
  red = r.id;
  blue = b.id;
  const vs = await seat(spaceId, viewer.accountId, eventId, red, 'Viewer');
  viewerSeat = vs.seatId;
  viewerParticipant = vs.participantId;
  hostSeat = (await seat(spaceId, host.accountId, eventId, blue, 'Streamer')).seatId;
  await db.insert(s.userTwitchLinks).values({ userId: viewer.userId, twitchUserId: VIEWER_TW, twitchLogin: 'viewer7' });

  H.setHighlightsTestHooks({ sleep: async () => {} });
});

beforeEach(async () => {
  H.setHighlightsTestHooks({
    limiter: new R.ClipLimiter({ channelBurst: 50, channelRefillMs: 1, globalBurst: 50, globalRefillMs: 1 }),
    timing: { firstLookMs: 15_000, pollMs: 10_000, deadlineMs: 60_000 },
  });
  net.readyAfter = 1;
  net.looks = 0;
  await db.delete(s.streamHighlights);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

// ── Tests ───────────────────────────────────────────────────────────────────────────────────────

test('the bot token is refreshed from the seed and kept encrypted', async () => {
  const a = await BT.botAccess();
  assert.ok(a);
  assert.equal(a!.canClip, true);
  assert.equal(a!.botUserId, '424242');
  const row = await db.query.twitchBotTokens.findFirst();
  assert.ok(row!.accessToken!.startsWith('enc1:') && !row!.accessToken!.includes('bot-at'));
  assert.ok(row!.refreshToken.startsWith('enc1:') && !row!.refreshToken.includes('seed-rt'));
  assert.equal(row!.scope.includes('clips:edit'), true);
  const before = net.refreshes;
  await BT.botAccess();
  assert.equal(net.refreshes, before, 'a fresh cached token is reused');
});

test('a non-streamed event clips nothing', async () => {
  const before = net.clipsMade.length;
  H.queueStartHighlight(plainEventId, 'Clan Bingo');
  await H.settleHighlights();
  assert.equal((await rows(plainEventId)).length, 0);
  assert.equal(net.clipsMade.length, before);
});

test("the start: the host's live channel gets a clip; a second start is deduped", async () => {
  H.queueStartHighlight(eventId, 'Stream Bingo');
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  const r = await rows();
  assert.equal(r.length, 1);
  assert.equal(r[0].channelOwner, 'host');
  assert.equal(r[0].channelId, HOST_TW);
  assert.equal(r[0].clipStatus, 'ready');
  assert.match(r[0].clipUrl!, /^https:\/\/clips\.twitch\.tv\/Clip-111-/);
  assert.equal(r[0].title, 'Stream Bingo has started');
  assert.equal(net.calls.filter((c) => c === 'POST api.twitch.tv/helix/clips').length >= 1, true);
});

test('an offline channel gets nothing at all', async () => {
  net.live.delete(HOST_TW);
  H.clearHighlightCachesForTests();
  const before = net.clipsMade.length;
  try {
    H.queueBoardHighlight(eventId, red, 'Red');
    await H.settleHighlights();
  } finally {
    net.live.add(HOST_TW);
    H.clearHighlightCachesForTests();
  }
  assert.equal((await rows()).length, 0);
  assert.equal(net.clipsMade.length, before);
});

test("a viewer's drop: nothing until they opt in, then their own channel, never the host's", async () => {
  net.live.add(VIEWER_TW);
  const pet = await moment(viewerSeat, 'Viewer', 'pet', red, { itemName: 'Baby mole', source: 'Giant Mole' });
  H.queueMomentHighlights(viewerSeat, [pet]);
  await H.settleHighlights();
  assert.equal((await rows()).length, 0, 'not opted in');

  assert.equal(await H.setPlayerClipSetting(viewer.userId, true), true);
  const pet2 = await moment(viewerSeat, 'Viewer', 'pet', red, { itemName: 'Baby mole', source: 'Giant Mole' });
  H.queueMomentHighlights(viewerSeat, [pet2]);
  await H.settleHighlights();
  const r = await rows();
  assert.equal(r.length, 1);
  assert.equal(r[0].channelOwner, 'player');
  assert.equal(r[0].channelId, VIEWER_TW);
  assert.equal(r[0].userId, viewer.userId);
  assert.equal(r[0].momentId, pet2.id);
  assert.equal(r[0].title, 'Viewer got Baby mole from Giant Mole');
  assert.equal(r[0].clipStatus, 'ready');
  await H.setPlayerClipSetting(viewer.userId, false);
});

test("the host's own drop goes to the host's channel; a small drop goes nowhere", async () => {
  const cheap = await moment(hostSeat, 'Streamer', 'loot', blue, { itemName: 'Rune scimitar', valueGp: 15_000, itemId: 1333 });
  const big = await moment(hostSeat, 'Streamer', 'unique', blue, { itemName: 'Twisted bow', valueGp: 1_200_000_000, itemId: 20997, source: 'Chambers of Xeric' });
  H.queueMomentHighlights(hostSeat, [cheap, big]);
  await H.settleHighlights();
  const r = await rows();
  assert.deepEqual(r.map((x) => [x.momentId, x.channelOwner, x.channelId]), [[big.id, 'host', HOST_TW]]);
});

test('a stale moment is not clipped', async () => {
  const old = await moment(hostSeat, 'Streamer', 'pet', blue, { itemName: 'Olmlet', occurredAt: iso(-10 * 60_000) });
  H.queueMomentHighlights(hostSeat, [old]);
  await H.settleHighlights();
  assert.equal((await rows()).length, 0);
});

test('a finished tile is clipped for whoever finished it', async () => {
  await H.setPlayerClipSetting(viewer.userId, true);
  const [tile] = await db.insert(s.tiles).values({ eventId, position: 0, label: 'Fire cape' }).returning();
  await db.insert(s.completions).values({ tileId: tile.id, teamId: red, creditPlayerId: viewerParticipant });
  H.queueTileHighlight(tile.id, red);
  await H.settleHighlights();
  const r = await rows();
  assert.equal(r.length, 1);
  assert.equal(r[0].beat, 'tile');
  assert.equal(r[0].tileId, tile.id);
  assert.equal(r[0].channelId, VIEWER_TW);
  assert.equal(r[0].title, 'Viewer completed Fire cape');
  await H.setPlayerClipSetting(viewer.userId, false);
});

test('rate limit: past the burst the beat is kept (for its VOD link) but not clipped', async () => {
  H.setHighlightsTestHooks({ limiter: new R.ClipLimiter({ channelBurst: 1, channelRefillMs: 60_000, globalBurst: 50, globalRefillMs: 1 }) });
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  H.queueWinnerHighlight(eventId, red, 'Red', 'Stream Bingo');
  await H.settleHighlights();
  const byBeat = Object.fromEntries((await rows()).map((x) => [x.beat, x.clipStatus]));
  assert.deepEqual(byBeat, { start: 'ready', won: 'limited' });
});

test('a clip Twitch never finishes is marked failed; the VOD link still comes', async () => {
  net.readyAfter = Infinity;
  const start = Date.now() - 3_600_000;
  net.archives.set(HOST_TW, [{ id: '5550001', created_at: new Date(start).toISOString(), duration: '1h5m0s' }]);
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  const [r] = await rows();
  assert.equal(r.clipStatus, 'failed');
  assert.equal(r.clipUrl, null);
  assert.equal(r.vodStatus, 'pending');

  // The cron, a minute later.
  const found = await H.resolveDueVods(new Date(Date.now() + 61_000));
  assert.equal(found, 1);
  const [after] = await rows();
  assert.equal(after.vodStatus, 'ready');
  const offset = Math.floor((after.occurredAt.getTime() - start) / 1000) - R.VOD_LEAD_S;
  assert.equal(after.vodUrl, `https://www.twitch.tv/videos/5550001?t=${R.twitchTimestamp(offset)}`);

  // Shown on the event page: a VOD link alone is enough for a card.
  const shown = await H.highlightsForEvent(eventId, () => true);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].clipUrl, null);
  assert.equal(shown[0].vodUrl, after.vodUrl);
});

test('no archive yet: the VOD lookup backs off, then gives up', async () => {
  net.archives.set(HOST_TW, []);
  net.readyAfter = Infinity; // and no clip either
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  let now = Date.now() + 61_000;
  assert.equal(await H.resolveDueVods(new Date(now)), 0);
  let [r] = await rows();
  assert.equal(r.vodAttempts, 1);
  assert.ok(r.vodNextAt!.getTime() >= now + 4 * 60_000 - 1000);
  for (let i = 0; i < R.VOD_MAX_ATTEMPTS + 2; i++) {
    now += 3 * 60 * 60_000;
    await H.resolveDueVods(new Date(now));
  }
  [r] = await rows();
  assert.equal(r.vodStatus, 'none');
  assert.deepEqual(await H.highlightsForEvent(eventId, () => true), [], 'nothing to show: no clip, no VOD');
});

test('hidden standings and event visibility decide who sees which highlights', async () => {
  H.queueStartHighlight(eventId, 'Stream Bingo');
  H.queueWinnerHighlight(eventId, red, 'Red', 'Stream Bingo');
  H.queueBoardHighlight(eventId, blue, 'Blue');
  await H.settleHighlights();
  assert.equal((await rows()).length, 3);

  // Behind the curtain on the event page: your own team (Red) and the start.
  const redOnly = await H.highlightsForEvent(eventId, (t) => t === red);
  assert.deepEqual(redOnly.map((h) => h.beat).sort(), ['start', 'won']);
  const publicView = await H.highlightsForEvent(eventId, () => false);
  assert.deepEqual(publicView.map((h) => h.beat), ['start']);

  // The space's page: an event the viewer may not see shows nothing at all.
  assert.equal((await H.highlightsForSpace(spaceId, async () => false)).length, 0);
  assert.equal((await H.highlightsForSpace(spaceId, async () => true)).length, 3);
  // While the event hides its standings, the page shows nothing team-specific.
  await db.update(s.events).set({ rules: JSON.stringify({ standings: { visibility: 'at-end' } }) }).where(eq(s.events.id, eventId));
  try {
    assert.deepEqual((await H.highlightsForSpace(spaceId, async () => true)).map((h) => h.beat), ['start']);
  } finally {
    await db.update(s.events).set({ rules: null }).where(eq(s.events.id, eventId));
  }
});

test('host switches: auto-clip off stops host clips; promo marks clips featurable for staff', async () => {
  assert.deepEqual(await H.hostHighlightSettings(spaceId), { autoClip: true, promo: false });
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  assert.equal((await H.highlightsForStaff({ featurable: true })).length, 0);
  await H.setHostHighlightSettings(spaceId, { promo: true });
  const feat = await H.highlightsForStaff({ featurable: true });
  assert.equal(feat.length, 1);
  assert.equal(feat[0].featurable, true);

  await db.delete(s.streamHighlights);
  await H.setHostHighlightSettings(spaceId, { autoClip: false });
  H.queueStartHighlight(eventId, 'Stream Bingo');
  await H.settleHighlights();
  assert.equal((await rows()).length, 0);
  await H.setHostHighlightSettings(spaceId, { autoClip: true, promo: false });
});

test('a bot token without clips:edit: no clip, VOD kept, staff told to re-authorize', async () => {
  net.scopes = ['user:read:chat', 'user:write:chat'];
  await db.delete(s.twitchBotTokens);
  BT.forgetBotTokenForTests();
  const before = net.clipsMade.length;
  try {
    H.queueStartHighlight(eventId, 'Stream Bingo');
    await H.settleHighlights();
    const [r] = await rows();
    assert.equal(r.clipStatus, 'off');
    assert.equal(r.vodStatus, 'pending');
    assert.equal(net.clipsMade.length, before, 'no clip was asked for');
    assert.deepEqual(await BT.botClipStatus(), { configured: true, needsReauth: true });
  } finally {
    net.scopes = ['user:read:chat', 'user:write:chat', 'clips:edit'];
    await db.delete(s.twitchBotTokens);
    BT.forgetBotTokenForTests();
  }
  await BT.botAccess();
  assert.deepEqual(await BT.botClipStatus(), { configured: true, needsReauth: false });
});

test("a player's switch needs a Twitch link", async () => {
  assert.equal(await H.setPlayerClipSetting(host.userId, true), false);
  assert.equal(await H.playerClipSetting(host.userId), null);
  assert.deepEqual(await H.playerClipSetting(viewer.userId), { login: 'viewer7', on: false });
  const link = await db.query.userTwitchLinks.findFirst({ where: and(eq(s.userTwitchLinks.userId, viewer.userId)) });
  assert.equal(link!.clipMyMoments, false);
});
