// 0111 re-syncs event entries' names to their characters' current names — live/upcoming events only.
//
// Run: npx tsx --test tests/participant-names-migration.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb, migrateRest } from './helpers/testDb.ts';

const DB = useTestDatabase('participantnames');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let liveEntry: number;
let pastEntry: number;
let seatOnlyEntry: number;

before(async () => {
  await resetDatabase(DB, '0110_event_rulebook');
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  const clan = (await db.insert(s.clans).values({ slug: 'mig', name: 'Mig' }).returning())[0].id;
  const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const live = (await db.insert(s.events).values({ clanId: clan, name: 'Live', boardSize: 5, startDate: day(-1), endDate: day(5) }).returning())[0].id;
  const past = (await db.insert(s.events).values({ clanId: clan, name: 'Past', boardSize: 5, startDate: day(-20), endDate: day(-10) }).returning())[0].id;
  const person = (await db.insert(s.players).values({ displayName: 'P' }).returning())[0].id;
  const [acct] = await db.insert(s.accounts).values({ playerId: person, rsn: 'Luderwasblue', rsnNormalized: 'luderwasblue' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan, accountId: acct.id, kind: 'member' }).returning();
  liveEntry = (await db.insert(s.eventParticipants).values({ eventId: live, clanMemberId: seat.id, accountId: acct.id, name: 'aromatluder' }).returning())[0].id;
  pastEntry = (await db.insert(s.eventParticipants).values({ eventId: past, clanMemberId: seat.id, accountId: acct.id, name: 'aromatluder' }).returning())[0].id;
  // An older row with only the seat (no account_id) is matched through it.
  const [acct2] = await db.insert(s.accounts).values({ playerId: person, rsn: 'NewAlt', rsnNormalized: 'newalt' }).returning();
  const [seat2] = await db.insert(s.clanMemberships).values({ clanId: clan, accountId: acct2.id, kind: 'guest' }).returning();
  seatOnlyEntry = (await db.insert(s.eventParticipants).values({ eventId: live, clanMemberId: seat2.id, accountId: null, name: 'OldAlt' }).returning())[0].id;
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
