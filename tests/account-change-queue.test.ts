// Asking to be scored on another of your own characters, end to end.
//
// A REQUEST NEVER MOVES A ROSTER ROW — approving does, through the same `swapTrackedAccount` the
// approver could already have run by hand. So what these tests pin is the asking: that only your own
// characters can be named, that asking twice is one ask, and that approving actually repoints the
// row the board follows.
//
// The ownership check runs twice, when the request is filed and again when it is answered, because
// an account can be unlinked in between and a stale request becoming a repoint onto somebody else's
// character is the one thing this must never do.
//
// Run: npx tsx --test tests/account-change-queue.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('account-change-queue');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/accountChangeRequests.ts');

let clanId: number;
let eventId: number;
let teamId: number;
/** One person, two characters — the shape the whole feature exists for. */
let personId: number;
let userId: number;
let mainSeat: number;
let altSeat: number;
let participantId: number;
/** Somebody else entirely, for the "not yours" case. */
let strangerSeat: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/accountChangeRequests.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning();
  clanId = clan.id;

  const [person] = await db.insert(s.players).values({ displayName: 'Switcher' }).returning();
  personId = person.id;
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Switcher', discordId: 'switch-1' })
    .returning();
  userId = u.id;

  const [main] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Main Guy', rsnNormalized: 'main guy' })
    .returning();
  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Alt Guy', rsnNormalized: 'alt guy' })
    .returning();

  const [other] = await db.insert(s.players).values({ displayName: 'Somebody Else' }).returning();
  const [otherAcct] = await db
    .insert(s.accounts)
    .values({ playerId: other.id, rsn: 'Not Yours', rsnNormalized: 'not yours' })
    .returning();

  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId, accountId: main.id, kind: 'member' },
      { clanId, accountId: alt.id, kind: 'member' },
      { clanId, accountId: otherAcct.id, kind: 'member' },
    ])
    .returning();
  [mainSeat, altSeat, strangerSeat] = seats.map((m) => m.id);

  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'September Bingo', boardSize: 5, startDate: '2026-09-01T00:00:00.000Z' })
    .returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Team One', color: '#d4a017' }).returning();
  teamId = team.id;

  const [participant] = await db
    .insert(s.eventParticipants)
    .values({ eventId, teamId, clanMemberId: mainSeat, name: 'Main Guy' })
    .returning();
  participantId = participant.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a player may ask to be scored on another of their own characters', async () => {
  const r = await A.requestAccountChange({
    participantId,
    userId,
    playerId: personId,
    toSeatId: altSeat,
    note: 'main is getting a rename',
  });
  assert.equal(r.ok, true);
});

test('asking twice is the same ask', async () => {
  // A queue holding two contradictory pending requests for one player is one somebody has to
  // reconcile by hand — the partial unique index is what stops it.
  const again = await A.requestAccountChange({
    participantId,
    userId,
    playerId: personId,
    toSeatId: altSeat,
  });
  assert.equal(again.ok, false);
  assert.equal(again.ok === false && again.status, 409);
});

test('it is waiting on the host, who holds the cash by default', async () => {
  const open = await A.openRequestsForClan(clanId);
  assert.equal(open.length, 1);
  assert.equal(open[0].approver, 'host', 'no cash policy set means host-holds');
  assert.equal(open[0].fromRsn, 'Main Guy');
  assert.equal(open[0].toRsn, 'Alt Guy');
  assert.equal(open[0].note, 'main is getting a rename');
});

test('approving actually repoints the row the board follows', async () => {
  const { db, schema: s } = await loadDb();
  const open = await A.openRequestsForClan(clanId);

  const decided = await A.decideAccountChange({
    requestId: open[0].id,
    actorUserId: userId,
    decision: 'approved',
  });
  assert.equal(decided.ok, true);
  assert.equal(decided.ok === true && decided.changed, true);

  const participant = await db.query.eventParticipants.findFirst({
    where: eq(s.eventParticipants.id, participantId),
  });
  assert.equal(participant?.clanMemberId, altSeat, 'the board follows the alt now');
  assert.equal(participant?.name, 'Alt Guy');

  assert.equal((await A.openRequestsForClan(clanId)).length, 0, 'and the queue is empty again');
});

test('answering twice is refused', async () => {
  const { db, schema: s } = await loadDb();
  const row = await db.query.accountChangeRequests.findFirst({
    where: eq(s.accountChangeRequests.participantId, participantId),
  });
  const again = await A.decideAccountChange({
    requestId: row!.id,
    actorUserId: userId,
    decision: 'rejected',
  });
  assert.equal(again.ok, false);
  assert.equal(again.ok === false && again.status, 409);
});

test('somebody else’s character cannot be asked for', async () => {
  // The check that matters most: a request naming a seat the asker does not own must never be filed,
  // because approving one would repoint the board onto a stranger.
  const r = await A.requestAccountChange({
    participantId,
    userId,
    playerId: personId,
    toSeatId: strangerSeat,
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 403);
});

test('you cannot ask about somebody else’s player row', async () => {
  const { db, schema: s } = await loadDb();
  const [other] = await db
    .select()
    .from(s.clanMemberships)
    .where(eq(s.clanMemberships.id, strangerSeat));
  const [theirs] = await db
    .insert(s.eventParticipants)
    .values({ eventId, teamId, clanMemberId: other.id, name: 'Not Yours' })
    .returning();

  const r = await A.requestAccountChange({
    participantId: theirs.id,
    userId,
    playerId: personId,
    toSeatId: altSeat,
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 403);
});

test('asking for the character already being followed is refused', async () => {
  const r = await A.requestAccountChange({
    participantId,
    userId,
    playerId: personId,
    toSeatId: altSeat,
  });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : '', /already follows/);
});
