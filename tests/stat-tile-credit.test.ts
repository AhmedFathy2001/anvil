// A stat tile a team has already passed completes when it is re-checked, off every member's live gain
// (hiscores or the plugin overlay over their baseline). This is what the admin "Recompute completions"
// now runs for stat tiles: a pushing account the sweep leaves to the plugin, whose push couldn't find
// its board, left a co-host's KC tile at 517/500 with no completion.
//
// Run: npx tsx --test tests/stat-tile-credit.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';
import { parseContributionSnapshot } from '../src/lib/statTracking.ts';

const DB = useTestDatabase('stat-tile-credit');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let creditStatTilesForTeam: typeof import('../src/lib/statTileCredit.ts')['creditStatTilesForTeam'];

let eventId: number;
let teamId: number;
let reached: Awaited<ReturnType<typeof loadDb>>['schema']['tiles']['$inferSelect'];
let notReached: Awaited<ReturnType<typeof loadDb>>['schema']['tiles']['$inferSelect'];

const stats = (zulrah: number) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp: 1_000_000 } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ creditStatTilesForTeam } = await import('../src/lib/statTileCredit.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const seat = async (n: string) => {
    const [player] = await db.insert(s.players).values({ displayName: n }).returning();
    const [account] = await db.insert(s.accounts).values({ playerId: player.id, rsn: n, rsnNormalized: n.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: account.id }).returning();
    return { member: m.id, account: account.id };
  };
  const a = await seat('Alice');
  const b = await seat('Bob');

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Clan war', boardSize: 5, scoringMode: 'points', startDate: new Date(Date.now() - 86_400_000).toISOString(), startNotified: 1, tilesRevealed: 1 })
    .returning();
  eventId = ev.id;
  [{ id: teamId }] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  // Alice's hiscores copy is stale (100 → 100); the plugin overlay says 400. Bob's hiscores say +220.
  await db.insert(s.eventParticipants).values([
    { eventId, name: 'Alice', teamId, clanMemberId: a.member, statsSnapshot: stats(100), cachedStats: stats(100) },
    { eventId, name: 'Bob', teamId, clanMemberId: b.member, statsSnapshot: stats(0), cachedStats: stats(220) },
  ]);
  await db.update(s.accounts).set({ liveStats: JSON.stringify({ zulrah: 400 }) }).where(eq(s.accounts.id, a.account));

  [reached] = await db
    .insert(s.tiles)
    .values({ eventId, position: 0, label: 'Kill Zulrah 500 times', tileType: 'stat', statType: 'boss', trackedStat: 'zulrah', statGoal: 500, points: 300 })
    .returning();
  [notReached] = await db
    .insert(s.tiles)
    .values({ eventId, position: 1, label: 'Kill Zulrah 1000 times', tileType: 'stat', statType: 'boss', trackedStat: 'zulrah', statGoal: 1000, points: 500 })
    .returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const completionFor = (tileId: number) =>
  db.select().from(s.completions).where(and(eq(s.completions.tileId, tileId), eq(s.completions.teamId, teamId)));

test('a team past its goal (300 live + 220 hiscores = 520 / 500) gets the completion', async () => {
  const done = await creditStatTilesForTeam({ eventId, teamId, statTiles: [reached, notReached], notify: false });
  assert.deepEqual(done, ['Kill Zulrah 500 times']);
  const [row] = await completionFor(reached.id);
  assert.ok(row, 'completion written');
  // First look already past the goal: no order to go on, so the split scales to exactly 500.
  const snap = parseContributionSnapshot(row.statContributions)!;
  assert.equal(snap.total, 500);
  assert.equal(snap.split.reduce((n, r) => n + r.gained, 0), 500);
  assert.equal((await completionFor(notReached.id)).length, 0);
});

test('re-running adds nothing', async () => {
  const done = await creditStatTilesForTeam({ eventId, teamId, statTiles: [reached, notReached], notify: false });
  assert.deepEqual(done, []);
  assert.equal((await completionFor(reached.id)).length, 1);
});

test('two members who logged out with 50 each on an 80 tile split it 40 / 40, whoever was fetched first', async () => {
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Blue', color: '#00f' }).returning();
  const [a] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Ann', teamId: team.id, statsSnapshot: stats(0), cachedStats: stats(0), lastStatsFetch: '2026-10-15T06:00:00.000Z' })
    .returning();
  const [b] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Ben', teamId: team.id, statsSnapshot: stats(0), cachedStats: stats(0), lastStatsFetch: '2026-10-15T06:00:00.000Z' })
    .returning();
  const [tile] = await db
    .insert(s.tiles)
    .values({ eventId, position: 2, label: 'Kill Zulrah 80 times', tileType: 'stat', statType: 'boss', trackedStat: 'zulrah', statGoal: 80, points: 50 })
    .returning();
  const check = () => creditStatTilesForTeam({ eventId, teamId: team.id, statTiles: [tile], notify: false });

  assert.deepEqual(await check(), []); // 06:00 — nothing yet
  await db.update(s.eventParticipants).set({ cachedStats: stats(50), lastStatsFetch: '2026-10-15T10:00:00.000Z' }).where(eq(s.eventParticipants.id, a.id));
  assert.deepEqual(await check(), []); // 10:00 — Ann fetched: 50 / 80
  await db.update(s.eventParticipants).set({ cachedStats: stats(50), lastStatsFetch: '2026-10-15T10:05:00.000Z' }).where(eq(s.eventParticipants.id, b.id));
  assert.deepEqual(await check(), ['Kill Zulrah 80 times']); // 10:05 — Ben fetched: 100 / 80

  const [row] = await db.select().from(s.completions).where(and(eq(s.completions.tileId, tile.id), eq(s.completions.teamId, team.id)));
  const split = Object.fromEntries(parseContributionSnapshot(row.statContributions)!.split.map((r) => [r.playerId, r.gained]));
  assert.deepEqual(split, { [a.id]: 40, [b.id]: 40 });
  // Done with: the ledger goes once the tile completes.
  assert.equal((await db.select().from(s.statTileProgress).where(eq(s.statTileProgress.tileId, tile.id))).length, 0);
});

