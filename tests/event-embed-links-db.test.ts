// The event posts, sent for real (Discord stubbed): each one's title links to the event, a tile post
// to that tile, and a competition post to the competition under the channel's own clan.
//
// Run: TESTS_OK=1 npx tsx --test tests/event-embed-links-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event_embed_links');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let clanId: number;
let spaceId: number;
let eventId: number;
let compId: number;

const posts: { url: string; body: { embeds?: { url?: string; title?: string; author?: { url?: string } }[] } }[] = [];
const realFetch = globalThis.fetch;
const realUri = process.env.DISCORD_REDIRECT_URI;
const BASE = 'https://anvil.test';

before(async () => {
  process.env.DISCORD_REDIRECT_URI = `${BASE}/api/auth/callback`;
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  clanId = (await db.insert(s.clans).values({ slug: 'irons', name: 'Irons' }).returning())[0].id;
  spaceId = (await db.insert(s.clans).values({ slug: 'ironstv', name: 'Irons TV', kind: 'creator', plan: 'creator_free' }).returning())[0].id;
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Rumble', boardSize: 5, startDate: '2020-01-01T00:00:00.000Z', endDate: '2099-01-01T00:00:00.000Z' })
    .returning();
  eventId = ev.id;
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'skill', metric: 'attack', title: 'Attack week', startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-01-08T00:00:00.000Z' })
    .returning();
  compId = comp.id;
  await db.insert(s.settings).values([
    { clanId, key: 'discord_webhook_bingo', value: 'https://discord.com/api/webhooks/1/bingo' },
    { clanId, key: 'discord_webhook_weekly', value: 'https://discord.com/api/webhooks/1/weekly' },
    { clanId: spaceId, key: 'discord_webhook_weekly', value: 'https://discord.com/api/webhooks/1/space-weekly' },
  ]);
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (realUri === undefined) delete process.env.DISCORD_REDIRECT_URI;
  else process.env.DISCORD_REDIRECT_URI = realUri;
  await pool.end();
  await dropDatabase(DB);
});

/** The one embed the call posted. */
async function sent(send: () => Promise<unknown>) {
  posts.length = 0;
  await send();
  assert.equal(posts.length, 1, 'one post');
  return posts[0].body.embeds![0];
}

test('the event posts link their title to the event page', async () => {
  const D = await import('../src/lib/discord.ts');
  const page = `${BASE}/events/${eventId}`;
  const cases: [string, () => Promise<unknown>][] = [
    ['bounty claim', () => D.notifyBountyClaim({ clanId, eventId, eventName: 'Rumble', tileLabel: 'Zulrah', points: 5, rsn: 'Olive' })],
    ['mission prize', () => D.notifyMissionPrize({ clanId, eventId, eventName: 'Rumble', tileLabel: 'Zulrah', rsn: 'Olive', place: 1, offeredGp: 1_000_000, funded: true, points: 5 })],
    ['draft start', () => D.notifyDraftStart({ clanId, eventId, eventName: 'Rumble', teamCount: 2 })],
    ['draft complete', () => D.notifyDraftComplete({ clanId, eventId, eventName: 'Rumble', teams: [{ name: 'Red', color: '#f00', players: ['Olive'] }] })],
    ['blackout', () => D.notifyTeamWin({ clanId, eventId, eventName: 'Rumble', teamName: 'Red', teamColor: '#f00', totalTiles: 25 })],
    ['start held', () => D.notifyEventStartHeld({ clanId, eventId, eventName: 'Rumble', scheduledStart: '2020-01-01T00:00:00.000Z', blockers: [] })],
    ['submission removed', () => D.notifySubmissionDeleted({ clanId, eventId, eventName: 'Rumble', tileLabel: 'Zulrah', teamName: 'Red', teamColor: '#f00', creditPlayerName: 'Olive', amount: 1, deletedBy: 'Mod', deletedByRole: 'moderator', reason: 'dupe' })],
  ];
  for (const [name, send] of cases) {
    const e = await sent(send);
    assert.equal(e.url, page, name);
    assert.equal(e.author?.url, page, `${name}: author line too`);
  }
});

test('a tile post keeps its more exact link: the tile opened on the board', async () => {
  const D = await import('../src/lib/discord.ts');
  const e = await sent(() =>
    D.notifyTileCompletion({ clanId, eventId, eventName: 'Rumble', tileLabel: 'Zulrah', teamName: 'Red', teamColor: '#f00', tileType: 'drop', tile: { id: 77, tileType: 'drop' } as never }),
  );
  assert.equal(e.url, `${BASE}/events/${eventId}?tile=77`);
  assert.equal(e.author?.url, `${BASE}/events/${eventId}`);
});

test('a competition post links under its clan; a space has no weekly page, so no link', async () => {
  const D = await import('../src/lib/discord.ts');
  const results = (id: number) =>
    D.notifyWeeklyResults({ clanId: id, competitionId: compId, type: 'skill', title: 'Attack week', metric: 'attack', standings: [{ rsn: 'Olive', gained: 10 }] });
  assert.equal((await sent(() => results(clanId))).url, `${BASE}/c/irons/weekly/${compId}`);
  assert.equal((await sent(() => results(spaceId))).url, undefined);
  const start = await sent(() =>
    D.notifyWeeklyStart({ clanId, competitionId: compId, type: 'skill', title: 'Attack week', metric: 'attack', endDate: '2020-01-08T00:00:00.000Z' }),
  );
  assert.equal(start.url, `${BASE}/c/irons/weekly/${compId}`);
});
