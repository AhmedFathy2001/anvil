// A completion in the plugin's team feed names the people who did it: a team KC/XP tile (no single
// finisher) lists its frozen split, a submission tile its finisher plus everyone else who submitted.
//
// Run: npx tsx --test tests/plugin-activity-participants.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-activity-participants');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let buildActivity: typeof import('../src/lib/pluginActivity.ts')['buildActivity'];
let eventId: number;
let teamId: number;
let ids: Record<string, number> = {};

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  const { db, schema: s } = loaded;
  pool = loaded.pool;
  ({ buildActivity } = await import('../src/lib/pluginActivity.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'War', boardSize: 5, startDate: new Date(Date.now() - 86_400_000).toISOString() })
    .returning();
  eventId = ev.id;
  [{ id: teamId }] = await db.insert(s.teams).values({ eventId, name: 'LFL', color: '#0f0' }).returning();
  for (const name of ['Kurrozive', 'Harlem', 'Minjoll']) {
    const [p] = await db.insert(s.eventParticipants).values({ eventId, name, teamId }).returning();
    ids[name] = p.id;
  }

  const [kc] = await db
    .insert(s.tiles)
    .values({ eventId, position: 0, label: 'Kill Brutus 500 times', tileType: 'stat', statType: 'boss', trackedStat: 'brutus', statGoal: 500 })
    .returning();
  await db.insert(s.completions).values({
    teamId,
    tileId: kc.id,
    statContributions: JSON.stringify({
      goal: 500,
      total: 517,
      split: [
        { playerId: ids.Harlem, gained: 300 },
        { playerId: ids.Kurrozive, gained: 200 },
        { playerId: ids.Minjoll, gained: 17 },
      ],
    }),
  });

  const [drop] = await db
    .insert(s.tiles)
    .values({ eventId, position: 1, label: 'Get 3 visages', tileType: 'drop', requiredAmount: 3 })
    .returning();
  await db.insert(s.submissions).values([
    { tileId: drop.id, teamId, playerId: ids.Kurrozive, creditPlayerId: ids.Kurrozive, amount: 2, createdAt: '2026-10-15 01:00:00' },
    { tileId: drop.id, teamId, playerId: ids.Minjoll, creditPlayerId: ids.Minjoll, amount: 1, createdAt: '2026-10-15 02:00:00' },
  ]);
  await db.insert(s.completions).values({ teamId, tileId: drop.id });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('completions carry who worked the tile', async () => {
  const feed = await buildActivity({ teamId, eventId, selfPlayerId: ids.Minjoll, selfRsn: 'Minjoll', since: { sub: 0, comp: 0, rev: 0 } });
  const done = feed.activity.filter((e) => e.kind === 'complete');
  const brutus = done.find((e) => e.tileLabel === 'Kill Brutus 500 times')!;
  assert.equal(brutus.player, null);
  assert.deepEqual(brutus.participants, ['Harlem', 'Kurrozive', 'Minjoll']);

  const visages = done.find((e) => e.tileLabel === 'Get 3 visages')!;
  assert.equal(visages.player, 'Minjoll'); // the last submission finished it
  assert.equal(visages.isSelf, true);
  assert.deepEqual(visages.participants, ['Kurrozive']);
});
