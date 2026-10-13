// Hourly progress rows (lib/eventHourly) and the event stats page data (lib/eventStats) against a real
// database: two teams, live plugin XP on top of a stale hiscores copy, drops, deaths and tiles across
// two days.
//
// Run: npx tsx --test tests/event-stats.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event_stats');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START = Date.parse('2026-10-14T18:00:00.000Z');
const END = START + 3 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

let eventId: number;
let red: number;
let blue: number;
let alice: number;
let bob: number;
let aliceAccount: number;

const stats = (attack: number, zulrah: number) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp: attack }, attack: { rank: 1, xp: attack } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const seat = async (n: string) => {
    const [player] = await db.insert(s.players).values({ displayName: n }).returning();
    const [account] = await db.insert(s.accounts).values({ playerId: player.id, rsn: n, rsnNormalized: n.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: account.id }).returning();
    return { member: m.id, account: account.id };
  };
  const a = await seat('Alice');
  const b = await seat('Bob');
  aliceAccount = a.account;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Stats Week', boardSize: 5, scoringMode: 'points', startDate: iso(START), endDate: iso(END), startNotified: 1, tilesRevealed: 1 })
    .returning();
  eventId = ev.id;
  [{ id: red }] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  [{ id: blue }] = await db.insert(s.teams).values({ eventId, name: 'Blue', color: '#0000ff' }).returning();
  [{ id: alice }] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Alice', teamId: red, clanMemberId: a.member, statsSnapshot: stats(1_000_000, 100), cachedStats: stats(1_000_000, 100), deaths: 2, lootGpGained: 5_000_000, minutesPlayed: 120 })
    .returning();
  [{ id: bob }] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Bob', teamId: blue, clanMemberId: b.member, statsSnapshot: stats(500_000, 0), cachedStats: stats(520_000, 0), deaths: 0, minutesPlayed: 60 })
    .returning();
  // Alice's hiscores copy is stale; the plugin's live overlay says she's 50k attack XP and 10 Zulrah up.
  const { eq } = await import('drizzle-orm');
  await db.update(s.accounts).set({ liveStats: JSON.stringify({ attack: 1_050_000, zulrah: 110 }) }).where(eq(s.accounts.id, a.account));

  const [tile] = await db.insert(s.tiles).values({ eventId, position: 0, label: 'Tanzanite fang', tileType: 'drop', points: 10 }).returning();
  await db.insert(s.submissions).values({ tileId: tile.id, teamId: red, creditPlayerId: alice, amount: 1, createdAt: iso(START + 2 * HOUR) });
  await db.insert(s.completions).values({ tileId: tile.id, teamId: red, creditPlayerId: alice, completedAt: iso(START + 2 * HOUR) });
  await db.insert(s.moments).values([
    { clanMemberId: a.member, rsn: 'Alice', kind: 'unique', eventId, teamId: red, itemName: 'Tanzanite fang', source: 'Zulrah', valueGp: 2_000_000, dedupKey: 'm1', occurredAt: iso(START + 2 * HOUR) },
    { clanMemberId: a.member, rsn: 'Alice', kind: 'death', eventId, teamId: red, source: 'Zulrah', dedupKey: 'm2', occurredAt: iso(START + 3 * HOUR) },
    { clanMemberId: b.member, rsn: 'Bob', kind: 'pet', eventId, teamId: blue, itemName: 'Pet snakeling', source: 'Zulrah', dedupKey: 'm3', occurredAt: iso(START + DAY + 5 * HOUR) },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('hourly rows: nothing in the first hour, one row per hour, live-merged XP, never twice', async () => {
  const { runHourlySnapshots } = await import('../src/lib/eventHourly.ts');
  await runHourlySnapshots(START + HOUR - 1000);
  let rows = await db.select().from(s.eventHourSnapshots);
  assert.equal(rows.length, 0);

  await runHourlySnapshots(START + 3 * HOUR + 5_000);
  await runHourlySnapshots(START + 3 * HOUR + 65_000);
  rows = await db.select().from(s.eventHourSnapshots);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hourIndex, 3);
  const data = JSON.parse(rows[0].data);
  // 50k XP and 10 KC from the live overlay, not the stale hiscores copy's zero.
  assert.deepEqual(data.p[String(alice)], [50_000, 10, 2, 5_000_000, 120]);
  assert.deepEqual(data.p[String(bob)], [20_000, 0, 0, 0, 60]);
  assert.equal(data.t[String(red)], 10);
});

test('stats, whole event: per member and per team, drops and deaths and tiles', async () => {
  const { getEventStats } = await import('../src/lib/eventStats.ts');
  const now = START + DAY + 6 * HOUR;
  const data = await getEventStats(eventId, { kind: 'all' }, now);
  assert.ok(data);
  assert.equal(data.event.currentDay, 2);
  const a = data.members.find((m) => m.id === alice)!;
  assert.deepEqual(a.counters, { xp: 50_000, kc: 10, deaths: 2, loot: 5_000_000, minutes: 120 });
  assert.equal(a.rares, 1);
  assert.equal(a.tiles, 1);
  assert.equal(a.turnIns, 1);
  const b = data.members.find((m) => m.id === bob)!;
  assert.equal(b.pets, 1);
  assert.equal(data.sides[0].name, 'Red');
  assert.equal(data.sides[0].score, 10);
  assert.equal(data.drops.length, 2);
  assert.equal(data.deaths.total, 1);
  assert.deepEqual(data.deaths.killers, [{ name: 'Zulrah', count: 1 }]);
  assert.equal(data.tiles[0].label, 'Tanzanite fang');
  // Hourly curve: the score steps to 10 at hour 2 and stays.
  const pts = data.hourly.series.points[red];
  assert.equal(pts[0], 0);
  assert.equal(pts[pts.length - 1], 10);
  // XP curve has the recorded hour-3 point and nulls for unrecorded hours.
  const hour3 = data.hourly.at.indexOf(START + 3 * HOUR);
  assert.equal(data.hourly.series.xp[red][hour3], 50_000);
  assert.equal(data.hourly.series.xp[red][1], null);
});

test('stats, one day: timestamped things split exactly; unrecorded boundaries say so', async () => {
  const { getEventStats } = await import('../src/lib/eventStats.ts');
  const now = START + DAY + 6 * HOUR;
  const day2 = await getEventStats(eventId, { kind: 'day', day: 2 }, now);
  assert.ok(day2);
  assert.equal(day2.window.live, true);
  // No row at hour 24, so the day-2 counters are unknown — but Bob's pet is on day 2.
  assert.equal(day2.members.find((m) => m.id === alice)!.counters, null);
  assert.equal(day2.members.find((m) => m.id === bob)!.pets, 1);
  assert.equal(day2.drops.length, 1);
  assert.equal(day2.tiles.length, 0);
  assert.equal(day2.sides.find((x) => x.teamId === red)!.scoreGained, 0);

  // With the hour-24 row recorded, day 2 diffs live against it.
  const { runHourlySnapshots } = await import('../src/lib/eventHourly.ts');
  await runHourlySnapshots(START + DAY + 1000);
  const { eq } = await import('drizzle-orm');
  await db.update(s.accounts).set({ liveStats: JSON.stringify({ attack: 1_080_000, zulrah: 115 }) }).where(eq(s.accounts.id, aliceAccount));
  const again = await getEventStats(eventId, { kind: 'day', day: 2 }, now);
  assert.deepEqual(again!.members.find((m) => m.id === alice)!.counters, { xp: 30_000, kc: 5, deaths: 0, loot: 0, minutes: 0 });

  // A day that hasn't started is no window at all.
  assert.equal(await getEventStats(eventId, { kind: 'day', day: 3 }, now), null);
});

test('hidden board: tile names stay hidden on the stats page', async () => {
  const { getEventStats } = await import('../src/lib/eventStats.ts');
  const { eq } = await import('drizzle-orm');
  await db.update(s.events).set({ tilesRevealed: 0 }).where(eq(s.events.id, eventId));
  const data = await getEventStats(eventId, { kind: 'all' }, START + DAY + 6 * HOUR);
  assert.equal(data!.tiles[0].label, 'Hidden tile');
  assert.equal(data!.tiles[0].points, null);
  await db.update(s.events).set({ tilesRevealed: 1 }).where(eq(s.events.id, eventId));
});
