// 0114 removes stale pre-start roster rows left behind when an assigned sign-up withdrew.
//
// Run: npx tsx --test tests/withdrawn-roster-migration.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, migrateRest, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('withdrawn_roster_migration');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let staleParticipantId: number;
let pastParticipantId: number;
let activeParticipantId: number;

before(async () => {
  await resetDatabase(DB, '0113_clan_coffer_sync');
  ({ db, pool, schema: s } = await loadDb());

  const [host, guest] = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host' },
      { slug: 'guest', name: 'Guest' },
    ])
    .returning();
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString();
  // The imported schema includes 0115/0116 columns while this database deliberately stops at
  // 0113. Seed through the old table shape, then let migrateRest apply 0114 and everything after.
  const insertEvent = async (name: string, startDate: string, endDate: string) =>
    Number((await pool.query(
      'insert into events (clan_id, name, board_size, start_date, end_date) values ($1, $2, $3, $4, $5) returning id',
      [host.id, name, 5, startDate, endDate],
    )).rows[0].id);
  const upcomingId = await insertEvent('Upcoming', day(3), day(10));
  const pastId = await insertEvent('Already started', day(-10), day(3));

  const makeAccount = async (rsn: string) => {
    const [person] = await db.insert(s.players).values({ displayName: rsn }).returning();
    return (await db
      .insert(s.accounts)
      .values({ playerId: person.id, rsn, rsnNormalized: rsn.toLowerCase() })
      .returning())[0];
  };

  const staleAccount = await makeAccount('Amascuff');
  const [staleSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: host.id, accountId: staleAccount.id, kind: 'member' })
    .returning();
  await db.insert(s.eventSignups).values({
    eventId: upcomingId,
    clanMemberId: staleSeat.id,
    status: 'withdrawn',
  });
  staleParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: upcomingId, clanMemberId: staleSeat.id, accountId: staleAccount.id, name: 'Amascuff' })
    .returning())[0].id;

  const pastAccount = await makeAccount('Past Player');
  const [pastSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: host.id, accountId: pastAccount.id, kind: 'member' })
    .returning();
  await db.insert(s.eventSignups).values({
    eventId: pastId,
    clanMemberId: pastSeat.id,
    status: 'withdrawn',
  });
  pastParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: pastId, clanMemberId: pastSeat.id, accountId: pastAccount.id, name: 'Past Player' })
    .returning())[0].id;

  // One account can hold a host seat and a co-host seat. A stale withdrawn copy must not remove the
  // participant while the same account still has a separate active sign-up on this event.
  const activeAccount = await makeAccount('Still Playing');
  const [oldSeat, activeSeat] = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: host.id, accountId: activeAccount.id, kind: 'guest' },
      { clanId: guest.id, accountId: activeAccount.id, kind: 'member' },
    ])
    .returning();
  await db.insert(s.eventSignups).values([
    { eventId: upcomingId, clanMemberId: oldSeat.id, status: 'withdrawn' },
    { eventId: upcomingId, clanMemberId: activeSeat.id, status: 'approved' },
  ]);
  activeParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: upcomingId, clanMemberId: activeSeat.id, accountId: activeAccount.id, name: 'Still Playing' })
    .returning())[0].id;

  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('withdrawn players leave an upcoming roster without rewriting live history', async () => {
  const participant = async (id: number) =>
    db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, id) });

  assert.equal(await participant(staleParticipantId), undefined, 'the stale pre-start roster row is removed');
  assert.ok(await participant(pastParticipantId), 'an event that already started is historical and stays untouched');
  assert.ok(await participant(activeParticipantId), 'a separate active sign-up for the account keeps its participant');
});
