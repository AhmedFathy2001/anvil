// The plugin schedule, per CHARACTER (lib/pluginConfig buildSchedule): your main entered, your alt
// not — two answers for one person. Plus: a co-host's schedule lists the board it co-hosts, and an
// unrevealed board gives away neither its tile count nor its size.
//
// Run: npx tsx --test tests/plugin-schedule-entry.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('schedentry');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let P: typeof import('../src/lib/pluginConfig.ts');
let host: number;
let guestClan: number;
let person: number;
let eventId: number;

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  P = await import('../src/lib/pluginConfig.ts');
  host = (await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning())[0].id;
  guestClan = (await db.insert(s.clans).values({ slug: 'cohost', name: 'Cohost' }).returning())[0].id;
  person = (await db.insert(s.players).values({ displayName: 'Two Accounts' }).returning())[0].id;
  const start = new Date(Date.now() + 86_400_000).toISOString();
  const end = new Date(Date.now() + 8 * 86_400_000).toISOString();
  eventId = (
    await db.insert(s.events).values({ clanId: host, name: 'Upcoming', boardSize: 5, startDate: start, endDate: end, tilesRevealed: 0 }).returning()
  )[0].id;
  await db.insert(s.tiles).values([{ eventId, label: 'A', points: 1, position: 0 }, { eventId, label: 'B', points: 1, position: 1 }]);
  await db.insert(s.eventCohosts).values({ eventId, clanId: guestClan, status: 'accepted' });

  const [main] = await db.insert(s.accounts).values({ playerId: person, rsn: 'Mainy', rsnNormalized: 'mainy', accountHash: 'hm' }).returning();
  await db.insert(s.accounts).values({ playerId: person, rsn: 'Alty', rsnNormalized: 'alty', accountHash: 'ha' });
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: guestClan, accountId: main.id, kind: 'member' }).returning();
  const login = (await db.insert(s.users).values({ displayName: 'Two', playerId: person }).returning())[0].id;
  await db.insert(s.eventSignups).values({ eventId, userId: login, clanMemberId: seat.id, status: 'approved', profileData: '{}', signedUpAt: start, updatedAt: start });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the co-host lists the board, hiding its size until revealed', async () => {
  const sched = await P.buildSchedule(guestClan, { member: true, viewerPlayerId: person, viewerRsn: 'Mainy', viewerAccountHash: 'hm' });
  const b = sched.bingos.find((x) => x.id === eventId);
  assert.ok(b, 'a co-hosted board is on the co-host’s schedule');
  assert.equal(b!.tileCount, null);
  assert.equal(b!.boardSize, null);
});

test('main entered, alt not — per character, not per person', async () => {
  const onMain = await P.buildSchedule(guestClan, { member: true, viewerPlayerId: person, viewerRsn: 'Mainy', viewerAccountHash: 'hm' });
  const onAlt = await P.buildSchedule(guestClan, { member: true, viewerPlayerId: person, viewerRsn: 'Alty', viewerAccountHash: 'ha' });
  assert.equal(onMain.bingos.find((x) => x.id === eventId)?.yourEntry, 'entered');
  assert.equal(onAlt.bingos.find((x) => x.id === eventId)?.yourEntry, null);
});

test('a header naming someone else’s character says nothing about them', async () => {
  const sched = await P.buildSchedule(guestClan, { member: true, viewerPlayerId: person, viewerRsn: 'SomebodyElse', viewerAccountHash: 'zz' });
  assert.equal(sched.bingos.find((x) => x.id === eventId)?.yourEntry, undefined);
});
