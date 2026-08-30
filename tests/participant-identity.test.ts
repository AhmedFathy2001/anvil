// A person is on a board once, whichever door they came through.
//
// `event_participants.clan_member_id` is a SEAT — (clan, account). While one deployment served one
// clan that was a faithful stand-in for the person, because an account had exactly one seat. Putting
// clans on one platform pulls the two apart: a player keeps a member seat in their own clan and
// picks up a guest seat in whichever clan is hosting, so a co-hosted board can see two seat ids for
// one human.
//
// That mattered because there are two doors onto such a board, and nine call sites behind them:
//
//   - the player enters the event themselves, and is admitted as a GUEST of the host clan
//   - their own clan's staff roster them onto the co-host's team, on their HOME seat
//
// Every one of those call sites de-duplicated on the seat, so the two doors could not see each
// other's work. The same player got two rows: their stat gains counted for their team twice, two
// entries on the roster, two fees owed — and nothing errored, because from where any single call
// site stood nothing was wrong.
//
// Run: npx tsx --test tests/participant-identity.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('participant-identity');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let P: typeof import('../src/lib/participants.ts');
let E: typeof import('../src/lib/enroll.ts');

let hostClan: number;
let visitingClan: number;
let eventId: number;
/** One human, one account, two seats: a member at home and a guest of the host. */
let travellerAccount: number;
let homeSeat: number;
let guestSeat: number;
/** Somebody with a single seat, to prove the ordinary path is unchanged. */
let localSeat: number;
let localAccount: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: pl, schema: s } = await loadDb();
  pool = pl;
  P = await import('../src/lib/participants.ts');
  E = await import('../src/lib/enroll.ts');

  const cs = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'visitor', name: 'Visiting Clan' },
    ])
    .returning();
  hostClan = cs[0].id;
  visitingClan = cs[1].id;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId: hostClan, name: 'Co-hosted Bingo', boardSize: 25 })
    .returning();
  eventId = ev.id;

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'Traveller' }, { displayName: 'Local' }])
    .returning();

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: people[0].id, rsn: 'Traveller', rsnNormalized: 'traveller' },
      { playerId: people[1].id, rsn: 'Local', rsnNormalized: 'local' },
    ])
    .returning();
  travellerAccount = accts[0].id;
  localAccount = accts[1].id;

  // The two seats one account legitimately holds: a member seat at home, and a guest seat in the
  // clan hosting the board. `clan_memberships_one_member_seat` permits exactly this — one MEMBER
  // seat anywhere, guest seats unlimited — which is what makes the collision reachable.
  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: visitingClan, accountId: travellerAccount, kind: 'member', source: 'roster' },
      { clanId: hostClan, accountId: travellerAccount, kind: 'guest', source: 'application' },
      { clanId: hostClan, accountId: localAccount, kind: 'member', source: 'roster' },
    ])
    .returning();
  homeSeat = seats[0].id;
  guestSeat = seats[1].id;
  localSeat = seats[2].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The seat is not the person ────────────────────────────────────────────────────────────────

test('two seats, one account', async () => {
  assert.notEqual(homeSeat, guestSeat);
  assert.equal(await P.accountOfSeat(homeSeat), travellerAccount);
  assert.equal(await P.accountOfSeat(guestSeat), travellerAccount);
});

test('a seat that has gone resolves to nobody rather than throwing', async () => {
  assert.equal(await P.accountOfSeat(999_999), null);
  assert.equal(await P.accountOfSeat(null), null);
});

// ── The rule ──────────────────────────────────────────────────────────────────────────────────

test('entering by one seat and being rostered by the other seats the player once', async () => {
  const { db, schema: s } = await loadDb();

  // Door one: the player enters the host's event themselves and is admitted as a guest.
  const first = await P.enrolParticipant({ eventId, clanMemberId: guestSeat, name: 'Traveller' });
  assert.equal(first.created, true);

  // Door two: their own clan's staff roster them onto the co-host team, on their HOME seat. This is
  // the call that used to make a second row, because the seat ids differ.
  const second = await P.enrolParticipant({ eventId, clanMemberId: homeSeat, name: 'Traveller' });
  assert.equal(second.created, false, 'the second door must not create a second player');
  assert.equal(second.row.id, first.row.id, 'both doors lead to the same player');

  const rows = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, eventId), eq(s.eventParticipants.accountId, travellerAccount)));
  assert.equal(rows.length, 1, 'one account, one row on the board');
});

test('the board finds the player from either seat', async () => {
  const viaGuest = await P.participantForSeat(eventId, guestSeat);
  const viaHome = await P.participantForSeat(eventId, homeSeat);
  assert.ok(viaGuest, 'found from the seat they entered on');
  assert.ok(viaHome, 'found from the seat their own clan knows them by');
  assert.equal(viaGuest.id, viaHome.id);
});

test('the database refuses a duplicate even when the code forgets to ask', async () => {
  const { db, schema: s } = await loadDb();
  // Not a redundant test of the one above: that proves the helper is careful, this proves the rule
  // survives a tenth call site that is not. The constraint is the part that cannot be forgotten.
  await assert.rejects(
    () =>
      db.insert(s.eventParticipants).values({
        eventId,
        clanMemberId: homeSeat,
        accountId: travellerAccount,
        name: 'Traveller (again)',
      }),
    (err: unknown) => {
      // Drizzle wraps the driver error in one carrying the failed SQL, so the index name is on the
      // cause rather than the message. Assert the Postgres facts — 23505 is unique_violation — so
      // this keeps meaning what it says if the wrapper's wording ever changes.
      const cause = (err as { cause?: { code?: string; constraint?: string } }).cause;
      assert.equal(cause?.code, '23505');
      assert.equal(cause?.constraint, 'event_participants_event_account_unique');
      return true;
    },
  );
});

// ── What must NOT change ──────────────────────────────────────────────────────────────────────

test('a player with no account at all is still allowed on, as many as there are', async () => {
  const { db, schema: s } = await loadDb();
  // The index is partial for this: a participant can exist before any seat does, and one unseated
  // row must not block the next.
  const a = await P.enrolParticipant({ eventId, name: 'Nobody' });
  const b = await P.enrolParticipant({ eventId, name: 'Nobody Else' });
  assert.equal(a.created, true);
  assert.equal(b.created, true);
  assert.notEqual(a.row.id, b.row.id);
  const rows = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, eventId));
  assert.ok(rows.length >= 3);
});

test('the ordinary single-seat enrolment is unchanged', async () => {
  const first = await E.upsertPlayers(eventId, [{ clanMemberId: localSeat, name: 'Local', discord: null, timezone: null }], null);
  assert.equal(first.length, 1);
  assert.equal(first[0].accountId, localAccount);

  // Re-running it returns the same player rather than a second one — the property this path always
  // had, now held by the account rather than by the seat.
  const again = await E.upsertPlayers(eventId, [{ clanMemberId: localSeat, name: 'Local', discord: null, timezone: null }], null);
  assert.equal(again.length, 1);
  assert.equal(again[0].id, first[0].id);
});

test('bulk enrolment naming one person by both their seats enrols them once', async () => {
  const { db, schema: s } = await loadDb();
  const [ev2] = await db.insert(s.events).values({ clanId: hostClan, name: 'Second Board', boardSize: 25 }).returning();

  const out = await E.upsertPlayers(
    ev2.id,
    [
      { clanMemberId: homeSeat, name: 'Traveller', discord: null, timezone: null },
      { clanMemberId: guestSeat, name: 'Traveller', discord: null, timezone: null },
    ],
    null,
  );
  const ids = new Set(out.map((p) => p.id));
  assert.equal(ids.size, 1, 'named twice, enrolled once');

  const rows = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, ev2.id), eq(s.eventParticipants.accountId, travellerAccount)));
  assert.equal(rows.length, 1);
});
