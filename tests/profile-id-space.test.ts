// A member's stats belong to their ACCOUNT, not to their seat.
//
// THE BUG. Every stats table — member_daily_stats, member_milestones, member_clog, member_progress,
// player_snapshots — is keyed by `account_id`, because Jagex tracks accounts. A member's place on a
// clan's roster is a SEAT, with its own id from its own sequence. The two are never equal.
//
// The profile stack passed the seat id to all of it. `getDailySeries(clanMemberId)` was the shape of
// the mistake: a parameter named for one id space, querying the other, and every caller obediently
// handing over the wrong one. On the preview, 456 of 456 live seats had an id differing from their
// account's, so this was wrong for every member of every clan:
//
//   Drenvox mdps' profile drew A Fish Taco's history.
//   Denoverse's drew a blank — the account whose id matched their seat had never been tracked.
//   The members scoreboard ranked everyone on somebody else's XP.
//
// NOTHING FAILED. Both ids are small positive integers from adjacent sequences, so the wrong row is
// always a plausible row. That is the entire hazard, and it is why the fixture below deliberately
// makes seat ids and account ids disagree: a test whose ids happen to line up proves nothing.
//
// Run: npx tsx --test tests/profile-id-space.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('profile-id-space');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let P: typeof import('../src/lib/memberProfile.ts');

let clanId: number;
/** Seat and account ids for two members, captured so the test can assert they differ. */
let alice: { seat: number; account: number };
let bob: { seat: number; account: number };

const TODAY = new Date().toISOString().slice(0, 10);
const ALICE_XP = 12_345_678;
const BOB_XP = 999;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  P = await import('../src/lib/memberProfile.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'idspace', name: 'Id Space' }).returning();
  clanId = clan.id;

  const people = await db
    .insert(s.players)
    .values([{ displayName: 'Alice' }, { displayName: 'Bob' }])
    .returning();

  // SPEND ACCOUNT IDS FIRST, so the two sequences are offset and no seat id can coincide with the
  // account it belongs to. Without this the whole suite would pass on the broken code.
  await db
    .insert(s.accounts)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        playerId: people[0].id,
        rsn: `Filler ${i}`,
        rsnNormalized: `filler ${i}`,
      })),
    );

  const accts = await db
    .insert(s.accounts)
    .values([
      { playerId: people[0].id, rsn: 'Alice Main', rsnNormalized: 'alice main' },
      { playerId: people[1].id, rsn: 'Bob Main', rsnNormalized: 'bob main' },
    ])
    .returning();

  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId, accountId: accts[0].id, kind: 'member', source: 'roster' },
      { clanId, accountId: accts[1].id, kind: 'member', source: 'roster' },
    ])
    .returning();

  alice = { seat: seats[0].id, account: accts[0].id };
  bob = { seat: seats[1].id, account: accts[1].id };

  // Alice's numbers are large, Bob's tiny — so reading the wrong one is unmistakable.
  await db.insert(s.memberDailyStats).values([
    { accountId: alice.account, day: TODAY, overallXp: ALICE_XP, xpGained: 500_000, ehpMilli: 900_000, ehbMilli: 400_000 },
    { accountId: bob.account, day: TODAY, overallXp: BOB_XP, xpGained: 1, ehpMilli: 10, ehbMilli: 5 },
  ]);

  await db.insert(s.memberMilestones).values([
    { accountId: alice.account, kind: 'level', metric: 'slayer', threshold: 99, noticedAt: `${TODAY}T00:00:00Z` },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The precondition ──────────────────────────────────────────────────────────────────────────

test('the fixture actually exercises the bug: no seat id equals its account id', () => {
  assert.notEqual(alice.seat, alice.account, 'if these matched, every assertion below would be vacuous');
  assert.notEqual(bob.seat, bob.account);
});

// ── The roster list ───────────────────────────────────────────────────────────────────────────

test('listMembers reports each member with THEIR OWN totals', async () => {
  const rows = await P.listMembers(clanId);
  const byRsn = Object.fromEntries(rows.map((r) => [r.rsn, r]));

  assert.equal(
    byRsn['Alice Main'].overallXp,
    ALICE_XP,
    'joined by seat id, this was whichever character held that number',
  );
  assert.equal(byRsn['Bob Main'].overallXp, BOB_XP);
});

test('and carries both ids, so callers can pick the right one deliberately', async () => {
  const rows = await P.listMembers(clanId);
  const a = rows.find((r) => r.rsn === 'Alice Main')!;
  assert.equal(a.id, alice.seat);
  assert.equal(a.accountId, alice.account);
});

// ── The profile ───────────────────────────────────────────────────────────────────────────────

test('getMemberProfile exposes the account id, not only the seat', async () => {
  const profile = await P.getMemberProfile(clanId, 'Alice Main');
  assert.ok(profile);
  assert.equal(profile.id, alice.seat, 'the seat, for standings and competition history');
  assert.equal(profile.accountId, alice.account, 'the account, for everything Jagex tracks');
});

test('history read with the ACCOUNT id is theirs; read with the seat it is not', async () => {
  const mine = await P.getDailySeries(alice.account, 30);
  assert.ok(
    mine.some((d) => d.overallXp === ALICE_XP),
    "Alice's own history",
  );

  // The old call. Kept as an assertion rather than a comment: it is the proof that the two ids
  // address different things, and it fails loudly if the sequences ever coincide.
  const wrong = await P.getDailySeries(alice.seat, 30);
  assert.ok(
    !wrong.some((d) => d.overallXp === ALICE_XP),
    'the seat id must not reach Alice — that it once did is the whole bug',
  );
});

test('milestones follow the account too', async () => {
  assert.equal((await P.getMilestones(alice.account)).length, 1);
  assert.equal((await P.getMilestones(alice.seat)).length, 0, 'the seat id names nobody here');
});

test('records are derived from the account series', async () => {
  const records = await P.getRecords(alice.account);
  assert.ok(records.length > 0, 'Alice gained XP today, so she has a day record');
  assert.equal((await P.getRecords(bob.seat)).length, 0);
});
