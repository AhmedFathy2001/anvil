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
  const [upcoming, past] = await db
    .insert(s.events)
    .values([
      { clanId: host.id, name: 'Upcoming', boardSize: 5, startDate: day(3), endDate: day(10) },
      { clanId: host.id, name: 'Already started', boardSize: 5, startDate: day(-10), endDate: day(3) },
    ])
    .returning();

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
    eventId: upcoming.id,
    clanMemberId: staleSeat.id,
    status: 'withdrawn',
  });
  staleParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: upcoming.id, clanMemberId: staleSeat.id, accountId: staleAccount.id, name: 'Amascuff' })
    .returning())[0].id;

  const pastAccount = await makeAccount('Past Player');
  const [pastSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: host.id, accountId: pastAccount.id, kind: 'member' })
    .returning();
  await db.insert(s.eventSignups).values({
    eventId: past.id,
    clanMemberId: pastSeat.id,
    status: 'withdrawn',
  });
  pastParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: past.id, clanMemberId: pastSeat.id, accountId: pastAccount.id, name: 'Past Player' })
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
    { eventId: upcoming.id, clanMemberId: oldSeat.id, status: 'withdrawn' },
    { eventId: upcoming.id, clanMemberId: activeSeat.id, status: 'approved' },
  ]);
  activeParticipantId = (await db
    .insert(s.eventParticipants)
    .values({ eventId: upcoming.id, clanMemberId: activeSeat.id, accountId: activeAccount.id, name: 'Still Playing' })
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
