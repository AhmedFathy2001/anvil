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
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let seatId: number;
let accountId: number;

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  db = loaded.db;
  s = loaded.schema;
  pool = loaded.pool;
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
  seatId = seat.id;
  accountId = account.id;
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

// The pool case: a captain who signed up sits on the event with no team, and naming them must move
// THAT row onto the team. The update keyed on `players.id` — the person table — with no join, which
// Postgres rejects ("missing FROM-clause entry"). Captain assignment 500'd after saving, and draft
// start (which re-seats every captain first) failed outright for any board whose captain was pooled.
test('a captain sitting unassigned in the pool is moved onto their team', async () => {
  const { eq } = await import('drizzle-orm');
  const [ev] = await db.insert(s.events).values({ clanId: (await db.query.events.findFirst({ where: eq(s.events.id, eventId) }))!.clanId, name: 'Pool', boardSize: 5 }).returning();
  const [team] = await db
    .insert(s.teams)
    .values({ eventId: ev.id, name: 'Pooled', color: '#0af', captainPassword: 'x', captainUserId: captainUser })
    .returning();
  const [p] = await db
    .insert(s.eventParticipants)
    .values({ eventId: ev.id, name: 'Drenvox', teamId: null, clanMemberId: seatId, accountId })
    .returning();

  const seat = await C.placeCaptainOnTeam(ev.id, team.id, captainUser);
  assert.deepEqual(seat, { playerId: p.id, reason: null });
  const row = await db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, p.id) });
  assert.equal(row?.teamId, team.id);

  // And draft start's pass over every captain doesn't throw.
  await C.seatEventCaptains(ev.id);
});
