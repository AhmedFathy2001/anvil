// A captain is a USER; the seats they play on belong to the PLAYER behind that login. Seating a captain
// matched roster player ids against the user id, which only worked while the two numbers happened to be
// equal — on a live board both captains (user 1 / player 2, user 50 / player 51) read as "isn't on the
// roster" while sitting on it.
//
// Run: npx tsx --test tests/captain-seat.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('captain-seat');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let C: typeof import('../src/lib/teamCaptain.ts');
let eventId: number;
let teamId: number;
let captainUser: number;
let participantId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: pl, schema: s } = await loadDb();
  pool = pl;
  C = await import('../src/lib/teamCaptain.ts');

  // Push the player ids past the user ids so the two can't line up by accident.
  await db.insert(s.players).values([{ displayName: 'filler 1' }, { displayName: 'filler 2' }]);
  const [person] = await db.insert(s.players).values({ displayName: 'Drenvox' }).returning();
  const [user] = await db.insert(s.users).values({ displayName: 'Ahmed', playerId: person.id }).returning();
  captainUser = user.id;
  assert.notEqual(user.id, person.id);

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const [account] = await db.insert(s.accounts).values({ playerId: person.id, rsn: 'Drenvox', rsnNormalized: 'drenvox' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: account.id }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'War', boardSize: 5 }).returning();
  eventId = ev.id;
  const [team] = await db
    .insert(s.teams)
    .values({ eventId, name: 'The AFK Spot', color: '#f80', captainPassword: 'x', captainUserId: user.id })
    .returning();
  teamId = team.id;
  const [p] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'Drenvox', teamId, clanMemberId: seat.id, accountId: account.id })
    .returning();
  participantId = p.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a captain already on their team is found there, through the player behind the login', async () => {
  const seat = await C.placeCaptainOnTeam(eventId, teamId, captainUser);
  assert.deepEqual(seat, { playerId: participantId, reason: null });
});
