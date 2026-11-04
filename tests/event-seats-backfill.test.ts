// 0203 turns a creator space's single-event guest seats into event seats, and nothing else.
//
//   guest seat in a creator space, sign-ups in ONE event  → kind 'event', event_id = that event
//   guest seat in a creator space, sign-ups in TWO events → stays a guest
//   guest seat in a creator space, no sign-ups           → stays a guest
//   the space's own staff                                 → stays a guest (staff play on a guest seat)
//   an ordinary clan's guest seat, one event              → stays a guest
//
// And it is safe to run twice.
//
// Run: npm run test:event-seats

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb, migrateRest, seedOldShape } from './helpers/testDb.ts';

const DB = useTestDatabase('event-seats-backfill');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const seat: Record<string, number> = {};
const ev: Record<string, number> = {};

before(async () => {
  await resetDatabase(DB, '0202_display_case_stat_pins');
  ({ pool } = await loadDb());
  const [space] = await seedOldShape(pool, 'clans', { slug: 'space', name: 'Space', kind: 'creator' });
  const [clan] = await seedOldShape(pool, 'clans', { slug: 'clan', name: 'Clan', inGameName: 'Clan' });
  const insertEvent = async (clanId: number, name: string) =>
    Number((await pool.query('insert into events (clan_id, name, board_size) values ($1, $2, 5) returning id', [clanId, name])).rows[0].id);
  ev.a = await insertEvent(space.id, 'A');
  ev.b = await insertEvent(space.id, 'B');
  ev.c = await insertEvent(clan.id, 'C');

  const person = async (name: string) => {
    const [p] = await seedOldShape(pool, 'players', { displayName: name });
    const [a] = await seedOldShape(pool, 'accounts', { playerId: p.id, rsn: name, rsnNormalized: name.toLowerCase() });
    return { playerId: p.id, accountId: a.id };
  };
  const signup = (eventId: number, seatId: number, status = 'approved') => seedOldShape(pool, 'event_signups', { eventId, clanMemberId: seatId, status });

  const one = await person('One');
  [{ id: seat.one }] = await seedOldShape(pool, 'clan_memberships', { clanId: space.id, accountId: one.accountId, kind: 'guest', source: 'application' });
  await signup(ev.a, seat.one);

  const two = await person('Two');
  [{ id: seat.two }] = await seedOldShape(pool, 'clan_memberships', { clanId: space.id, accountId: two.accountId, kind: 'guest', source: 'application' });
  await signup(ev.a, seat.two);
  await signup(ev.b, seat.two);

  const none = await person('None');
  [{ id: seat.none }] = await seedOldShape(pool, 'clan_memberships', { clanId: space.id, accountId: none.accountId, kind: 'guest', source: 'application' });

  const staff = await person('Staffer');
  const [u] = await seedOldShape(pool, 'users', { playerId: staff.playerId, displayName: 'Staffer', discordId: '994000000000009999' });
  await seedOldShape(pool, 'clan_staff', { clanId: space.id, userId: u.id, role: 'admin' });
  [{ id: seat.staff }] = await seedOldShape(pool, 'clan_memberships', { clanId: space.id, accountId: staff.accountId, kind: 'guest', source: 'admin' });
  await signup(ev.b, seat.staff);

  const clanGuest = await person('Clan Guest');
  [{ id: seat.clanGuest }] = await seedOldShape(pool, 'clan_memberships', { clanId: clan.id, accountId: clanGuest.accountId, kind: 'guest', source: 'application' });
  await signup(ev.c, seat.clanGuest);

  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function rowOf(id: number) {
  const { db, schema: s } = await loadDb();
  return db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, id) });
}

test('a creator-space guest seat with sign-ups in exactly one event becomes that event’s seat', async () => {
  const one = await rowOf(seat.one);
  assert.equal(one?.kind, 'event');
  assert.equal(one?.eventId, ev.a);
});

test('everything else stays a guest', async () => {
  for (const k of ['two', 'none', 'staff', 'clanGuest']) {
    const r = await rowOf(seat[k]);
    assert.equal(r?.kind, 'guest', k);
    assert.equal(r?.eventId, null, k);
  }
});

test('running 0203 again changes nothing', async () => {
  const sql = readFileSync('drizzle/0203_event_player_seats.sql', 'utf8');
  for (const stmt of sql.split('--> statement-breakpoint')) {
    if (stmt.trim()) await pool.query(stmt);
  }
  assert.equal((await rowOf(seat.one))?.kind, 'event');
  assert.equal((await rowOf(seat.two))?.kind, 'guest');
  // The partial unique index holds: a second event seat for another event is allowed…
  const acct = (await rowOf(seat.one))!.accountId;
  const clanId = (await rowOf(seat.one))!.clanId;
  await pool.query("insert into clan_memberships (clan_id, account_id, kind, event_id) values ($1, $2, 'event', $3)", [clanId, acct, ev.b]);
  // …a second seat for the same event is not, nor a second member/guest seat.
  await assert.rejects(pool.query("insert into clan_memberships (clan_id, account_id, kind, event_id) values ($1, $2, 'event', $3)", [clanId, acct, ev.a]));
  const two = (await rowOf(seat.two))!;
  await assert.rejects(pool.query("insert into clan_memberships (clan_id, account_id, kind) values ($1, $2, 'guest')", [two.clanId, two.accountId]));
});
