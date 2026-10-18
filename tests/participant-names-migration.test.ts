// 0111 re-syncs event entries' names to their characters' current names — live/upcoming events only.
//
// Run: npx tsx --test tests/participant-names-migration.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb, migrateRest, seedOldShape } from './helpers/testDb.ts';

const DB = useTestDatabase('participantnames');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let liveEntry: number;
let pastEntry: number;
let seatOnlyEntry: number;

before(async () => {
  await resetDatabase(DB, '0110_event_rulebook');
  const { pool: p } = await loadDb();
  pool = p;
  const clan = (await seedOldShape(pool, 'clans', { slug: 'mig', name: 'Mig' }))[0].id;
  const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  // The imported schema includes columns added after this deliberately old database shape. Seed
  // through the old SQL shape so a later nullable events column does not make this 0111 data-
  // migration test fail before the migration it is meant to exercise can run.
  const insertEvent = async (name: string, startDate: string, endDate: string) => Number((await pool.query(
    'insert into events (clan_id, name, board_size, start_date, end_date) values ($1, $2, $3, $4, $5) returning id',
    [clan, name, 5, startDate, endDate],
  )).rows[0].id);
  const live = await insertEvent('Live', day(-1), day(5));
  const past = await insertEvent('Past', day(-20), day(-10));
  const person = (await seedOldShape(pool, 'players', { displayName: 'P' }))[0].id;
  const [acct] = await seedOldShape(pool, 'accounts', { playerId: person, rsn: 'Luderwasblue', rsnNormalized: 'luderwasblue' });
  const [seat] = await seedOldShape(pool, 'clan_memberships', { clanId: clan, accountId: acct.id, kind: 'member' });
  liveEntry = (await seedOldShape(pool, 'event_participants', { eventId: live, clanMemberId: seat.id, accountId: acct.id, name: 'aromatluder' }))[0].id;
  pastEntry = (await seedOldShape(pool, 'event_participants', { eventId: past, clanMemberId: seat.id, accountId: acct.id, name: 'aromatluder' }))[0].id;
  // An older row with only the seat (no account_id) is matched through it.
  const [acct2] = await seedOldShape(pool, 'accounts', { playerId: person, rsn: 'NewAlt', rsnNormalized: 'newalt' });
  const [seat2] = await seedOldShape(pool, 'clan_memberships', { clanId: clan, accountId: acct2.id, kind: 'guest' });
  seatOnlyEntry = (await seedOldShape(pool, 'event_participants', { eventId: live, clanMemberId: seat2.id, accountId: null, name: 'OldAlt' }))[0].id;
  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('live entries take the character’s current name; finished ones keep theirs', async () => {
  const { db, schema: s } = await loadDb();
  const name = async (id: number) => (await db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, id) }))?.name;
  assert.equal(await name(liveEntry), 'Luderwasblue');
  assert.equal(await name(seatOnlyEntry), 'NewAlt', 'matched through the seat');
  assert.equal(await name(pastEntry), 'aromatluder', 'the record of a finished event is left alone');
});
