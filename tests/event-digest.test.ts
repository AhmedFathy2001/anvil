// Daily digest + halfway report (lib/eventDigest) end to end against a real database: a clan-v-clan
// board (host + co-host), a few days of activity, and the posts both clans receive.
//
// Run: npx tsx --test tests/event-digest.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event_digest');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-10-14T18:00:00.000Z');
const END = START + 4 * DAY;
const at = (days: number) => new Date(START + days * DAY).toISOString();

let eventId: number;
let hostTeam: number;
let guestTeam: number;
let alice: number; // host clan
let bob: number; // guest clan
let killTile: number;
let dropTile: number;
let lotteryTile: number;

const posts: { url: string; body: { embeds?: { title?: string; description?: string; fields?: { name: string; value: string }[] }[] } }[] = [];
const realFetch = globalThis.fetch;

const stats = (xp: number, zulrah: number) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());

  const mk = async (slug: string, name: string) => (await db.insert(s.clans).values({ slug, name }).returning())[0].id;
  const hostClan = await mk('host', 'Iron Vanguard');
  const guestClan = await mk('guest', 'Gilded Few');

  const [ev] = await db
    .insert(s.events)
    .values({
      clanId: hostClan,
      name: 'Clan Clash',
      boardSize: 5,
      scoringMode: 'points',
      startDate: at(0),
      endDate: new Date(END).toISOString(),
      startNotified: 1,
    })
    .returning();
  eventId = ev.id;
  await db.insert(s.eventCohosts).values({ eventId, clanId: guestClan, status: 'accepted' });

  [{ id: hostTeam }] = await db.insert(s.teams).values({ eventId, name: 'Vanguard', color: '#ff0000', clanId: hostClan }).returning();
  [{ id: guestTeam }] = await db.insert(s.teams).values({ eventId, name: 'Gilded', color: '#00ff00', clanId: guestClan }).returning();

  [{ id: killTile }] = await db.insert(s.tiles).values({ eventId, position: 0, label: '500 slayer kills', tileType: 'kill', requiredAmount: 500, points: 5 }).returning();
  [{ id: dropTile }] = await db.insert(s.tiles).values({ eventId, position: 1, label: 'Tanzanite fang', tileType: 'drop', points: 10 }).returning();
  [{ id: lotteryTile }] = await db.insert(s.tiles).values({ eventId, position: 2, label: 'Jar of swamp', tileType: 'drop', points: 20, lottery: true }).returning();

  [{ id: alice }] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Alice', teamId: hostTeam, statsSnapshot: stats(1_000_000, 100), cachedStats: stats(1_400_000, 160), deaths: 7, lootGpGained: 30_000_000, minutesPlayed: 900 })
    .returning();
  [{ id: bob }] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Bob', teamId: guestTeam, statsSnapshot: stats(2_000_000, 0), cachedStats: stats(2_100_000, 0), deaths: 1, lootGpGained: 2_000_000, minutesPlayed: 300 })
    .returning();

  // Day 1: Alice grinds 500 slayer kills (one row per kill) and finishes the kill tile.
  await db.insert(s.submissions).values(
    Array.from({ length: 500 }, (_, i) => ({ tileId: killTile, teamId: hostTeam, creditPlayerId: alice, amount: 1, createdAt: new Date(START + 60_000 * (i + 1)).toISOString() })),
  );
  await db.insert(s.completions).values({ tileId: killTile, teamId: hostTeam, creditPlayerId: alice, completedAt: new Date(START + 60_000 * 500).toISOString() });
  // Day 2: Bob gets the fang AND the lottery jar.
  await db.insert(s.submissions).values([
    { tileId: dropTile, teamId: guestTeam, creditPlayerId: bob, amount: 1, createdAt: at(1.2) },
    { tileId: lotteryTile, teamId: guestTeam, creditPlayerId: bob, amount: 1, createdAt: at(1.5) },
  ]);
  await db.insert(s.completions).values([
    { tileId: dropTile, teamId: guestTeam, creditPlayerId: bob, completedAt: at(1.2) },
    { tileId: lotteryTile, teamId: guestTeam, creditPlayerId: bob, completedAt: at(1.5) },
  ]);

  await db.insert(s.settings).values([
    { clanId: hostClan, key: 'discord_webhook_bingo', value: 'https://discord.test/host' },
    { clanId: guestClan, key: 'discord_webhook_bingo', value: 'https://discord.test/guest' },
  ]);

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

const fieldsOf = (p: (typeof posts)[number]) => Object.fromEntries((p.body.embeds?.[0]?.fields ?? []).map((f) => [f.name, f.value]));

test('nothing posts before the first 24h', async () => {
  const { runDailyDigests } = await import('../src/lib/eventDigest.ts');
  posts.length = 0;
  await runDailyDigests(START + DAY - 1000);
  assert.equal(posts.length, 0);
});

test('day 1 digest: both clans get it, kill pings count as one, standings + clan v clan', async () => {
  const { runDailyDigests } = await import('../src/lib/eventDigest.ts');
  posts.length = 0;
  await runDailyDigests(START + DAY + 1000);
  assert.deepEqual(posts.map((p) => p.url).sort(), ['https://discord.test/guest', 'https://discord.test/host']);
  const embed = posts[0].body.embeds![0];
  assert.match(embed.title!, /Day 1 recap/);
  const f = fieldsOf(posts[0]);
  assert.match(f['📊 Standings'], /🥇 \*\*Vanguard\*\* — 5 pts/);
  assert.match(f['🏆 MVP of the day'], /Alice/);
  assert.match(f['⚔️ Clan v clan today'], /Iron Vanguard\*\* 👑/);
  assert.match(f['⚔️ Clan v clan today'], /Days won: Iron Vanguard 1 – Gilded Few 0/);
  assert.match(embed.description!, /Iron Vanguard\*\* took the day/);
  // Day-1 counters diff against zero / the enrollment snapshot.
  assert.match(f['⚔️ Clan v clan today'], /400,000 XP · 60 KC/);

  // Second tick the same day is a no-op (the snapshot row is the latch).
  posts.length = 0;
  await runDailyDigests(START + DAY + 120_000);
  assert.equal(posts.length, 0);
});

test('day 2 digest: diffs against day 1, shows the climb and the lottery jackpot', async () => {
  const { runDailyDigests } = await import('../src/lib/eventDigest.ts');
  const { eq } = await import('drizzle-orm');
  // Overnight Alice gained 100k more XP and died 3 more times.
  await db.update(s.eventParticipants).set({ cachedStats: stats(1_500_000, 160), deaths: 10 }).where(eq(s.eventParticipants.id, alice));
  posts.length = 0;
  await runDailyDigests(START + 2 * DAY + 1000);
  assert.equal(posts.length, 2);
  const f = fieldsOf(posts[0]);
  assert.match(f['📊 Standings'], /🥇 \*\*Gilded\*\* — 30 pts ▲1 _\(\+30 today\)_/);
  assert.match(f['🏅 Today’s awards'], /Lottery Winner\*\* — Bob/);
  assert.match(f['⚔️ Clan v clan today'], /Iron Vanguard\*\* — 100,000 XP · 0 KC.*3 deaths/);
  assert.match(f['⚔️ Clan v clan today'], /Days won: Iron Vanguard 1 – Gilded Few 1/);
});

test('halfway report posts once at the midpoint, with awards so far', async () => {
  const { runHalfwayReports } = await import('../src/lib/eventDigest.ts');
  posts.length = 0;
  await runHalfwayReports(START + 2 * DAY - 1000);
  assert.equal(posts.length, 0);
  await runHalfwayReports(START + 2 * DAY + 1000);
  assert.equal(posts.length, 2);
  assert.match(posts[0].body.embeds![0].title!, /Halfway report/);
  const f = fieldsOf(posts[0]);
  assert.match(f['🏅 Awards so far'], /First Blood\*\* — Alice/);
  assert.match(f['🏅 Awards so far'], /Lottery Winner\*\* — Bob/);
  posts.length = 0;
  await runHalfwayReports(START + 2 * DAY + 60_000);
  assert.equal(posts.length, 0);
});

test('recap: kill pings are one submission; Busy Bee is gone, Jack of All Trades is in', async () => {
  const { getEventRecap } = await import('../src/lib/eventRecap.ts');
  const recap = await getEventRecap(eventId);
  assert.ok(recap);
  // 1 (Alice's 500 kill rows) + 2 (Bob's two drops) — not 502.
  assert.equal(recap.totals.submissions, 3);
  const keys = recap.awards.map((a) => a.key);
  assert.ok(!keys.includes('busy-bee'));
  assert.ok(keys.includes('jack-of-all-trades'));
  assert.equal(recap.awards.find((a) => a.key === 'jack-of-all-trades')?.winner.name, 'Bob');
});

test('the final day is never digested — the end post covers it', async () => {
  const { runDailyDigests } = await import('../src/lib/eventDigest.ts');
  posts.length = 0;
  await runDailyDigests(START + 3 * DAY + 1000);
  assert.equal(posts.length, 2); // day 3
  posts.length = 0;
  await runDailyDigests(END + 1000);
  assert.equal(posts.length, 0);
});

test('a 4-clan board: every clan gets the post, clans ranked by points gained that day', async () => {
  const { runDailyDigests } = await import('../src/lib/eventDigest.ts');
  const START2 = END + DAY; // the first event is over by now, so only this one is due
  const mk = async (slug: string, name: string) => (await db.insert(s.clans).values({ slug, name }).returning())[0].id;
  const [a, b, c, d] = [await mk('wa', 'Alpha'), await mk('wb', 'Bravo'), await mk('wc', 'Charlie'), await mk('wd', 'Delta')];
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: a, name: 'Clan War', boardSize: 5, scoringMode: 'points', startDate: new Date(START2).toISOString(), endDate: new Date(START2 + 3 * DAY).toISOString(), startNotified: 1 })
    .returning();
  await db.insert(s.eventCohosts).values([b, c, d].map((clanId) => ({ eventId: ev.id, clanId, status: 'accepted' })));
  const team = async (name: string, clanId: number) => (await db.insert(s.teams).values({ eventId: ev.id, name, color: '#fff', clanId }).returning())[0].id;
  const [tA, tB, tC] = [await team('A1', a), await team('B1', b), await team('C1', c)];
  await team('D1', d);
  const tile = async (pos: number, points: number) =>
    (await db.insert(s.tiles).values({ eventId: ev.id, position: pos, label: `T${pos}`, tileType: 'drop', points }).returning())[0].id;
  const [x, y, z] = [await tile(0, 10), await tile(1, 15), await tile(2, 20)];
  const done = (tileId: number, teamId: number) => ({ tileId, teamId, completedAt: new Date(START2 + DAY / 2).toISOString() });
  // Day 1: Bravo 10+15 = 25, Charlie 20, Alpha 10, Delta nothing.
  await db.insert(s.completions).values([done(x, tB), done(y, tB), done(z, tC), done(x, tA)]);
  await db.insert(s.settings).values([a, b, c, d].map((clanId, i) => ({ clanId, key: 'discord_webhook_bingo', value: `https://discord.test/war${i}` })));

  posts.length = 0;
  await runDailyDigests(START2 + DAY + 1000);
  assert.deepEqual(posts.map((p) => p.url).sort(), ['https://discord.test/war0', 'https://discord.test/war1', 'https://discord.test/war2', 'https://discord.test/war3']);
  const f = fieldsOf(posts[0]);
  const section = f['⚔️ Clan war today (4 clans)'];
  assert.ok(section, `no clan war field in ${Object.keys(f).join(', ')}`);
  const order = section.split('\n');
  assert.match(order[0], /Bravo\*\* 👑 _\(\+25\)_/);
  assert.match(order[1], /Charlie\*\* _\(\+20\)_/);
  assert.match(order[2], /Alpha\*\* _\(\+10\)_/);
  assert.match(order[3], /Delta\*\* _\(\+0\)_ — quiet day/);
  assert.match(order[0], /^🥇/);
  assert.match(order[3], /^4\. /);
  assert.match(order[4], /^Days won: Bravo 1 · /);
  assert.match(posts[0].body.embeds![0].description!, /Bravo\*\* took the day \(\+25/);
});
