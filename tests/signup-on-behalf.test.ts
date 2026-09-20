// An admin signing a character up for someone (lib/signupOnBehalf — "Add member" on Sign-ups).
//
// The case this exists for is the id collision. A sign-up hangs off a LOGIN (users.id); a roster
// seat names a PERSON (players.id). They are separate sequences, and this path used to write the
// person id straight into the login column. On a fresh test database the two sequences line up, so
// a naive fixture passes for the wrong reason — the fixture below makes them disagree on purpose,
// with an unrelated login holding the number the person id would have pointed at.
//
// Run: npx tsx --test tests/signup-on-behalf.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('signup-on-behalf');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let signUpOnBehalf: typeof import('../src/lib/signupOnBehalf.ts')['signUpOnBehalf'];

type Board = { id: number; clanId: number; signupFee: number | null; maxAccountsPerPerson: number | null };

let clanId: number;
let otherClanId: number;
let board: Board;
/** The person's real login. */
let login: number;
/** A login belonging to nobody in this story, holding the id the PERSON id would collide with. */
let decoyLogin: number;
/** Two characters of the same person, both claimed. */
let mainSeat: number;
let altSeat: number;
/** A character nobody has claimed. */
let guestSeat: number;
/** A seat on another clan's roster. */
let foreignSeat: number;

let token = 0;
const add = (b: Board, clanMemberId: number, status: 'pending' | 'approved' = 'approved') =>
  signUpOnBehalf({ event: b, clanMemberId, profile: { notes: 'told me on Discord' }, status, playerToken: `t${++token}` });

async function seat(clan: number, playerId: number, rsn: string, claimed: boolean): Promise<number> {
  const [a] = await db
    .insert(s.accounts)
    .values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), claimedAt: claimed ? new Date().toISOString() : null })
    .returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId: clan, accountId: a.id, kind: 'member' }).returning();
  return m.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ signUpOnBehalf } = await import('../src/lib/signupOnBehalf.ts'));

  const [c] = await db.insert(s.clans).values({ slug: 'home', name: 'Home' }).returning();
  clanId = c.id;
  const [o] = await db.insert(s.clans).values({ slug: 'away', name: 'Away' }).returning();
  otherClanId = o.id;

  // The person first, then a decoy login that takes THE SAME NUMBER in the users sequence, then the
  // person's own login — so person id === decoy login id !== real login id.
  const [person] = await db.insert(s.players).values({ displayName: 'Zezima' }).returning();
  const [decoy] = await db.insert(s.users).values({ id: person.id, displayName: 'Somebody else' }).returning();
  decoyLogin = decoy.id;
  const [real] = await db.insert(s.users).values({ id: person.id + 1000, displayName: 'Zezima', playerId: person.id }).returning();
  login = real.id;
  assert.equal(decoyLogin, person.id, 'fixture: the decoy holds the person id');
  assert.notEqual(login, person.id, 'fixture: the real login does not');

  mainSeat = await seat(clanId, person.id, 'Zezima', true);
  altSeat = await seat(clanId, person.id, 'Zezima Alt', true);

  const [stranger] = await db.insert(s.players).values({ displayName: 'Unclaimed' }).returning();
  guestSeat = await seat(clanId, stranger.id, 'Unclaimed', false);

  const [away] = await db.insert(s.players).values({ displayName: 'Away Player' }).returning();
  foreignSeat = await seat(otherClanId, away.id, 'Away Player', true);

  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Summer Bingo', boardSize: 25, signupFee: 5_000_000 })
    .returning();
  board = { id: ev.id, clanId, signupFee: ev.signupFee, maxAccountsPerPerson: ev.maxAccountsPerPerson };
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the sign-up belongs to the person’s login, not whichever login shares their person id', async () => {
  const r = await add(board, mainSeat);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.signup.userId, login);
  assert.notEqual(r.signup.userId, decoyLogin);
  assert.equal(r.signup.status, 'approved');
});

test('it carries the self-serve side effects: a fee row and a draft-pool player', async () => {
  const [row] = await db
    .select()
    .from(s.eventSignups)
    .where(and(eq(s.eventSignups.eventId, board.id), eq(s.eventSignups.clanMemberId, mainSeat)));
  const fee = await db.query.signupFees.findFirst({ where: eq(s.signupFees.signupId, row.id) });
  assert.equal(fee?.amount, 5_000_000);
  assert.equal(fee?.status, 'pending');

  const players = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, board.id), eq(s.eventParticipants.clanMemberId, mainSeat)));
  assert.equal(players.length, 1);
});

test('the same character twice is refused', async () => {
  const r = await add(board, mainSeat);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 409);
});

test('a second character is refused on a one-per-person board', async () => {
  const r = await add(board, altSeat);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /another character/);
});

test('a second character is allowed where the board lets a person bring two', async () => {
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Alts Welcome', boardSize: 25, maxAccountsPerPerson: 2 })
    .returning();
  const two: Board = { id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 2 };
  const first = await add(two, mainSeat);
  const second = await add(two, altSeat);
  assert.ok(first.ok && second.ok);
  assert.equal(first.signup.userId, login);
  assert.equal(second.signup.userId, login);
  // No fee row on a free board.
  assert.equal(await db.query.signupFees.findFirst({ where: eq(s.signupFees.signupId, second.signup.id) }), undefined);
});

test('an unclaimed character becomes a guest sign-up', async () => {
  const r = await add(board, guestSeat);
  assert.ok(r.ok);
  assert.equal(r.signup.userId, null);
});

test('another clan’s member cannot be seated on this board', async () => {
  const r = await add(board, foreignSeat);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 404);
});

test('reviving a withdrawn sign-up repairs a login written by the old bug', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Rerun', boardSize: 25 }).returning();
  // What the old code left behind: the person id in the login column, since withdrawn.
  await db.insert(s.eventSignups).values({
    eventId: ev.id,
    userId: decoyLogin,
    clanMemberId: mainSeat,
    status: 'withdrawn',
    signedUpAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const r = await add({ id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 1 }, mainSeat);
  assert.ok(r.ok);
  assert.equal(r.signup.userId, login);
  assert.equal(r.signup.status, 'approved');
  const rows = await db.select().from(s.eventSignups).where(eq(s.eventSignups.eventId, ev.id));
  assert.equal(rows.length, 1, 'revived in place, not duplicated');
});

// ── Seating them straight onto a team ─────────────────────────────────────────
// The pool is still the default; a team is something the admin asks for explicitly.

test('a team can be named, and the player lands on it instead of the pool', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Teamed', boardSize: 25 }).returning();
  const [red] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#dc2626' }).returning();
  const board2: Board = { id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 1 };

  const r = await signUpOnBehalf({
    event: board2,
    clanMemberId: mainSeat,
    profile: {},
    status: 'approved',
    teamId: red.id,
    playerToken: `t${++token}`,
  });
  assert.ok(r.ok, JSON.stringify(r));

  const [p] = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, ev.id), eq(s.eventParticipants.clanMemberId, mainSeat)));
  assert.equal(p.teamId, red.id);
});

test('naming no team leaves them in the pool, as it always did', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Pooled', boardSize: 25 }).returning();
  await db.insert(s.teams).values({ eventId: ev.id, name: 'Blue', color: '#2563eb' });
  const r = await add({ id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 1 }, mainSeat);
  assert.ok(r.ok);
  const [p] = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, ev.id), eq(s.eventParticipants.clanMemberId, mainSeat)));
  assert.equal(p.teamId, null);
});

test('a team from another board is refused', async () => {
  const [mine] = await db.insert(s.events).values({ clanId, name: 'Mine', boardSize: 25 }).returning();
  const [theirs] = await db.insert(s.events).values({ clanId, name: 'Theirs', boardSize: 25 }).returning();
  const [strayTeam] = await db.insert(s.teams).values({ eventId: theirs.id, name: 'Stray', color: '#16a34a' }).returning();

  const r = await signUpOnBehalf({
    event: { id: mine.id, clanId, signupFee: null, maxAccountsPerPerson: 1 },
    clanMemberId: mainSeat,
    profile: {},
    status: 'approved',
    teamId: strayTeam.id,
    playerToken: `t${++token}`,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 404);
  // Refused before anything was written — no sign-up, no player.
  assert.equal((await db.select().from(s.eventSignups).where(eq(s.eventSignups.eventId, mine.id))).length, 0);
  assert.equal((await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, mine.id))).length, 0);
});

test('someone already on a team is not moved by re-running their sign-up', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Settled', boardSize: 25 }).returning();
  const [red] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#dc2626' }).returning();
  const [blue] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Blue', color: '#2563eb' }).returning();
  const board2: Board = { id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 1 };

  const first = await signUpOnBehalf({
    event: board2, clanMemberId: mainSeat, profile: {}, status: 'approved', teamId: red.id, playerToken: `t${++token}`,
  });
  assert.ok(first.ok);
  // Withdraw, so the sign-up itself would be revived rather than refused as a duplicate.
  await db.update(s.eventSignups).set({ status: 'withdrawn' }).where(eq(s.eventSignups.id, first.signup.id));

  const second = await signUpOnBehalf({
    event: board2, clanMemberId: mainSeat, profile: {}, status: 'approved', teamId: blue.id, playerToken: `t${++token}`,
  });
  assert.equal(second.ok, false);
  assert.match(!second.ok ? second.error : '', /already on another team/);

  // The refusal stands for the whole call: they are still on Red, and still withdrawn.
  const [p] = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, ev.id), eq(s.eventParticipants.clanMemberId, mainSeat)));
  assert.equal(p.teamId, red.id);
  const row = await db.query.eventSignups.findFirst({ where: eq(s.eventSignups.id, first.signup.id) });
  assert.equal(row?.status, 'withdrawn');
});

test('a player sitting in the pool is seated when a team is named', async () => {
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Late pick', boardSize: 25 }).returning();
  const [green] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Green', color: '#16a34a' }).returning();
  const board2: Board = { id: ev.id, clanId, signupFee: null, maxAccountsPerPerson: 1 };

  const first = await add(board2, mainSeat);
  assert.ok(first.ok);
  await db.update(s.eventSignups).set({ status: 'withdrawn' }).where(eq(s.eventSignups.id, first.signup.id));

  const second = await signUpOnBehalf({
    event: board2, clanMemberId: mainSeat, profile: {}, status: 'approved', teamId: green.id, playerToken: `t${++token}`,
  });
  assert.ok(second.ok, JSON.stringify(second));
  const [p] = await db
    .select()
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, ev.id), eq(s.eventParticipants.clanMemberId, mainSeat)));
  assert.equal(p.teamId, green.id);
});
