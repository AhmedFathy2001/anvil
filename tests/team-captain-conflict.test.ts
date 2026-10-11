// One person captains at most one team per event.
//
// Two teams with the same captain hand that person both teams' picks on draft day, and the seating
// logic can only put them on one of the two rosters. Every route that names a captain asks
// lib/teamCaptain#captainConflict first and turns a non-null answer into a 409.
//
// Run: npx tsx --test tests/team-captain-conflict.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('team-captain-conflict');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let C: typeof import('../src/lib/teamCaptain.ts');

let eventId: number;
let otherEventId: number;
let alice: number;
let bob: number;
let redTeam: number;
let blueTeam: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: pl, schema: s } = await loadDb();
  pool = pl;
  C = await import('../src/lib/teamCaptain.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning();
  const evs = await db
    .insert(s.events)
    .values([
      { clanId: clan.id, name: 'Bingo', boardSize: 25 },
      { clanId: clan.id, name: 'Other Bingo', boardSize: 25 },
    ])
    .returning();
  eventId = evs[0].id;
  otherEventId = evs[1].id;

  const us = await db
    .insert(s.users)
    .values([{ displayName: 'Alice' }, { displayName: 'Bob' }])
    .returning();
  alice = us[0].id;
  bob = us[1].id;

  const ts = await db
    .insert(s.teams)
    .values([
      { eventId, name: 'Red', color: '#ff0000', captainPassword: 'x', captainUserId: alice },
      { eventId, name: 'Blue', color: '#0000ff', captainPassword: 'x', captainUserId: null },
    ])
    .returning();
  redTeam = ts[0].id;
  blueTeam = ts[1].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a second captaincy in the same event is refused, naming the person and the team', async () => {
  assert.equal(await C.captainConflict(eventId, alice), 'Alice already captains Red in this event.');
  assert.equal(await C.captainConflict(eventId, alice, blueTeam), 'Alice already captains Red in this event.');
});

test('re-saving a team with its own captain is not a conflict', async () => {
  assert.equal(await C.captainConflict(eventId, alice, redTeam), null);
});

test('someone captaining nothing here is free', async () => {
  assert.equal(await C.captainConflict(eventId, bob), null);
  assert.equal(await C.captainConflict(eventId, bob, blueTeam), null);
});

test('a captaincy in another event does not count', async () => {
  assert.equal(await C.captainConflict(otherEventId, alice), null);
});
