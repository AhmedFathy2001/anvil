// How someone gets a seat in a clan, and the ways they must not.
//
// Four paths created a guest seat as a side effect — a plugin login, an account link, a verification
// check, a manual-review request — so turning up once put you on a roster nobody had agreed to. That
// makes "membership is granted, never assumed" false at the guest tier, and a clan's roster is not a
// log of who has visited.
//
// The other half is exclusivity: OSRS lets an account be in exactly one clan, so the site should not
// be able to say otherwise. Joining clan B demotes the seat in clan A rather than failing, because
// the in-game roster is the evidence and a sync that refused to import a transferring player would
// break on the common case.
//
// Run: npm run test:guests

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('guest-admission');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let G: typeof import('../src/lib/guestAdmission.ts');
let banFromClan: typeof import('../src/lib/clanBans.ts')['banFromClan'];

let approvalClan: number;
let openClan: number;
let closedClan: number;
let staffUser: number;
let person: number;
let accountId: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  G = await import('../src/lib/guestAdmission.ts');
  ({ banFromClan } = await import('../src/lib/clanBans.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'approval', name: 'By Approval' },
      { slug: 'open', name: 'Open Doors', guestPolicy: 'open' },
      { slug: 'closed', name: 'Closed Shop', guestPolicy: 'closed' },
    ])
    .returning();
  [approvalClan, openClan, closedClan] = clans.map((c) => c.id);

  const [pl] = await db.insert(s.players).values({ displayName: 'Visitor' }).returning();
  person = pl.id;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: 'Staff', discordId: '9910000000000001' })
    .returning();
  staffUser = u.id;

  const [a] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Visitor', rsnNormalized: 'visitor' })
    .returning();
  accountId = a.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Policy ────────────────────────────────────────────────────────────────────────────────────

test('approval is the default, and it creates a REQUEST rather than a seat', async () => {
  // The whole point: turning up is not joining.
  const { db, schema: s } = await loadDb();
  assert.equal(await G.guestPolicyOf(approvalClan), 'approval');

  const r = await G.admit({ clanId: approvalClan, accountId, source: 'plugin' });
  assert.equal(r.outcome, 'requested');

  const seats = await db
    .select()
    .from(s.clanMemberships)
    .where(and(eq(s.clanMemberships.clanId, approvalClan), eq(s.clanMemberships.accountId, accountId)));
  assert.equal(seats.length, 0, 'no seat until somebody says so');
});

test('asking twice does not queue twice', async () => {
  // Every caller is something that repeats — a login, a poll.
  const again = await G.admit({ clanId: approvalClan, accountId });
  assert.equal(again.outcome, 'pending');

  const { db, schema: s } = await loadDb();
  const rows = await db
    .select()
    .from(s.clanJoinRequests)
    .where(and(eq(s.clanJoinRequests.clanId, approvalClan), eq(s.clanJoinRequests.status, 'pending')));
  assert.equal(rows.length, 1);
});

test('an open clan seats them there and then', async () => {
  const r = await G.admit({ clanId: openClan, accountId });
  assert.equal(r.outcome, 'seated');
});

test('a closed clan takes nobody, and does not queue them either', async () => {
  const r = await G.admit({ clanId: closedClan, accountId });
  assert.deepEqual(r, { outcome: 'refused', reason: 'closed' });

  const { db, schema: s } = await loadDb();
  const rows = await db
    .select()
    .from(s.clanJoinRequests)
    .where(eq(s.clanJoinRequests.clanId, closedClan));
  assert.equal(rows.length, 0, 'a closed door is not a waiting list');
});

// ── Deciding ──────────────────────────────────────────────────────────────────────────────────

test('approving is the only thing that creates the seat', async () => {
  const { db, schema: s } = await loadDb();
  const req = await db.query.clanJoinRequests.findFirst({
    where: and(eq(s.clanJoinRequests.clanId, approvalClan), eq(s.clanJoinRequests.status, 'pending')),
  });
  const r = await G.approveRequest(req!.id, approvalClan, staffUser);
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const seat = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, r.seatId) });
  assert.equal(seat?.kind, 'guest', 'a guest, not a member — that is the roster sync’s to say');
  assert.equal(seat?.leftAt, null);
});

test('a decided request cannot be decided again', async () => {
  const { db, schema: s } = await loadDb();
  const req = await db.query.clanJoinRequests.findFirst({
    where: eq(s.clanJoinRequests.clanId, approvalClan),
  });
  const again = await G.approveRequest(req!.id, approvalClan, staffUser);
  assert.equal(again.ok, false);
});

test('rejecting does not block asking again later', async () => {
  // People fall out with clans and make up. The unique index is partial on status for this.
  const { db, schema: s } = await loadDb();
  const [other] = await db
    .insert(s.accounts)
    .values({ playerId: person, rsn: 'Second Try', rsnNormalized: 'second try' })
    .returning();

  const first = await G.admit({ clanId: approvalClan, accountId: other.id });
  assert.equal(first.outcome, 'requested');
  if (first.outcome !== 'requested') return;

  assert.equal(await G.rejectRequest(first.requestId, approvalClan, staffUser, 'not now'), true);

  const second = await G.admit({ clanId: approvalClan, accountId: other.id });
  assert.equal(second.outcome, 'requested', 'a rejection is not a permanent bar');
});

// ── Bans outrank policy ───────────────────────────────────────────────────────────────────────

test('a banned person cannot request, even from an open clan', async () => {
  const { db, schema: s } = await loadDb();
  const [banned] = await db.insert(s.players).values({ displayName: 'Barred' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: banned.id, rsn: 'Barred', rsnNormalized: 'barred' })
    .returning();
  await db
    .insert(s.clanMemberships)
    .values({ clanId: openClan, accountId: acct.id, kind: 'guest', source: 'application' });

  await banFromClan({ clanId: openClan, playerId: banned.id, byUserId: staffUser });

  const r = await G.admit({ clanId: openClan, accountId: acct.id });
  assert.deepEqual(r, { outcome: 'refused', reason: 'banned' }, 'the ban outranks an open door');
});

test('a departed seat is not quietly resurrected by turning up again', async () => {
  // Otherwise a removal lasts until the person's next login, which is no removal at all.
  const { db, schema: s } = await loadDb();
  const [gone] = await db.insert(s.players).values({ displayName: 'Removed' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: gone.id, rsn: 'Removed', rsnNormalized: 'removed' })
    .returning();
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({
      clanId: approvalClan,
      accountId: acct.id,
      kind: 'guest',
      source: 'application',
      leftAt: new Date().toISOString(),
    })
    .returning();

  const r = await G.admit({ clanId: approvalClan, accountId: acct.id });
  assert.notEqual(r.outcome, 'seated');

  const after = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, seat.id) });
  assert.ok(after!.leftAt, 'still departed');
});

// ── One member seat ───────────────────────────────────────────────────────────────────────────

test('an account is a member of one clan; joining another demotes the first', async () => {
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'Transfer' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Transfer', rsnNormalized: 'transfer' })
    .returning();

  const [oldSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: approvalClan, accountId: acct.id, kind: 'member', source: 'roster' })
    .returning();

  const { demotedFrom } = await G.claimMemberSeat(openClan, acct.id);
  assert.equal(demotedFrom, approvalClan);

  const was = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, oldSeat.id) });
  assert.equal(was?.kind, 'guest', 'demoted, not deleted');
  assert.equal(was?.leftAt, null, 'and not removed — their history there is the clan’s record too');
});

test('the database refuses a second member seat outright', async () => {
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'Doubler' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Doubler', rsnNormalized: 'doubler' })
    .returning();

  await db
    .insert(s.clanMemberships)
    .values({ clanId: approvalClan, accountId: acct.id, kind: 'member', source: 'roster' });

  await assert.rejects(
    () =>
      db
        .insert(s.clanMemberships)
        .values({ clanId: openClan, accountId: acct.id, kind: 'member', source: 'roster' }),
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
    'two clans both claiming a member is not a state that should exist',
  );
});

test('but guest seats are unlimited — guesting is not membership', async () => {
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'Wanderer' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Wanderer', rsnNormalized: 'wanderer' })
    .returning();

  await db.insert(s.clanMemberships).values([
    { clanId: approvalClan, accountId: acct.id, kind: 'guest', source: 'application' },
    { clanId: openClan, accountId: acct.id, kind: 'guest', source: 'application' },
    { clanId: closedClan, accountId: acct.id, kind: 'guest', source: 'application' },
  ]);

  const seats = await db
    .select()
    .from(s.clanMemberships)
    .where(and(eq(s.clanMemberships.accountId, acct.id), isNull(s.clanMemberships.leftAt)));
  assert.equal(seats.length, 3);
});

test('a departed member seat does not block a new one', async () => {
  // The index is partial on left_at, so leaving a clan properly frees the account to join another.
  const { db, schema: s } = await loadDb();
  const [pl] = await db.insert(s.players).values({ displayName: 'Rejoiner' }).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: pl.id, rsn: 'Rejoiner', rsnNormalized: 'rejoiner' })
    .returning();

  await db.insert(s.clanMemberships).values({
    clanId: approvalClan,
    accountId: acct.id,
    kind: 'member',
    source: 'roster',
    leftAt: new Date().toISOString(),
  });

  await db
    .insert(s.clanMemberships)
    .values({ clanId: openClan, accountId: acct.id, kind: 'member', source: 'roster' });
  // No throw is the assertion.
});

// ── Leaving ───────────────────────────────────────────────────────────────────────────────────

test('a person can leave a clan themselves, and only their own seat', async () => {
  const { db, schema: s } = await loadDb();
  const [mine] = await db
    .select({ id: s.clanRoster.id })
    .from(s.clanRoster)
    .where(and(eq(s.clanRoster.clanId, openClan), eq(s.clanRoster.playerId, person), isNull(s.clanRoster.leftAt)))
    .limit(1);
  assert.ok(mine, 'the fixture seated them in the open clan earlier');

  const [stranger] = await db.insert(s.players).values({ displayName: 'Somebody Else' }).returning();
  assert.equal(await G.leaveClan(mine.id, stranger.id), false, "not theirs to leave");

  assert.equal(await G.leaveClan(mine.id, person), true);
  const after = await db.query.clanMemberships.findFirst({ where: eq(s.clanMemberships.id, mine.id) });
  assert.ok(after!.leftAt);
});
