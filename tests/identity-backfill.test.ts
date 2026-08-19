// The identity backfill: what migration 0006 makes of the rosters that came before it.
//
// This is the migration the whole remodel turns on, and it runs exactly once per database, at
// migration time — so the only way to test it is to stop the chain at 0005, seed rows in the old
// single-clan shape, and then let 0006 transform them.
//
// The case it exists for is the one the old schema could not express at all: the SAME person, on
// TWO clans' rosters, playing a main and an alt. Before this migration that was four unrelated
// clan_members rows with no way to know they were one human. Every assertion below is a fact that
// was previously unrepresentable.
//
// Run: npm run test:identity

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';

import { useTestDatabase, resetDatabase, migrateRest, dropDatabase, loadDb } from './helpers/testDb.ts';

/**
 * `users` as it stood BEFORE the identity migrations — deliberately a frozen snapshot, not an
 * import from the live schema.
 *
 * Seeding here happens against the old shape, which is the one thing schema.ts can no longer
 * describe: it names every column it knows, including the player_id that 0007 is about to add, and
 * a table that does not have that column yet rejects the insert. Assertions still read through the
 * real schema, so what is pinned below is the migration's output, not this snapshot.
 *
 * This should NOT be updated to track schema.ts. It is a historical record; drifting it forward
 * would quietly stop testing the migration.
 */
/**
 * `clans` with only the columns that exist AT THIS POINT in the chain.
 *
 * Same hazard as the two below, from the other direction: this table is not dropped or reshaped by
 * the migration under test, it simply grows columns later (billing landed in 0014). Seeding through
 * schema.ts would name those columns against a database that is deliberately held at 0005, and the
 * insert fails. Only the columns this test actually sets are listed.
 */
const clansAtThisPoint = pgTable('clans', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
});

const usersBeforeIdentity = pgTable('users', {
  id: serial('id').primaryKey(),
  displayName: text('display_name').notNull(),
  discordId: text('discord_id'),
});

/**
 * `clan_members` as it stood before the split. Frozen for the same reason, and doubly so: the table
 * does not merely change shape, it is DROPPED by the migration under test. Nothing can read it once
 * the chain finishes, so what it held is captured below while it still exists.
 */
const clanMembersBeforeIdentity = pgTable('clan_members', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull(),
  rsn: text('rsn').notNull(),
  rsnNormalized: text('rsn_normalized').notNull(),
  userId: integer('user_id'),
  isGuest: integer('is_guest').notNull().default(1),
  source: text('source').notNull().default('manual'),
  status: text('status').notNull().default('active'),
  statusLastChecked: text('status_last_checked'),
  previousRsns: text('previous_rsns'),
  isPrimary: integer('is_primary').notNull().default(0),
  verifiedAt: text('verified_at'),
  verificationMethod: text('verification_method'),
  provisional: integer('provisional').notNull().default(0),
  claimedAt: text('claimed_at'),
  liveStats: text('live_stats'),
  liveStatsAt: text('live_stats_at'),
  statsLastSnapshot: text('stats_last_snapshot'),
  statsOverallXp: integer('stats_overall_xp'),
  statsMissStreak: integer('stats_miss_streak').notNull().default(0),
  statsNextDueAt: text('stats_next_due_at'),
});

/** What the roster held before the migration, captured while clan_members still exists. */
let seeded: { id: number; clanId: number }[] = [];

const DB = useTestDatabase('identity-backfill');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
/** Same schema handle, under a name the later tests can use without shadowing. */
let s2: Awaited<ReturnType<typeof loadDb>>['schema'];
// Imported inside before(), not at the top: src/db reads DATABASE_URL once at module load, so
// anything reaching it before useTestDatabase() has pointed the env at this suite's database boots
// against whatever was configured for the app.
let personOf: typeof import('../src/lib/roster.ts')['personOf'];
let personOfOrCreate: typeof import('../src/lib/roster.ts')['personOfOrCreate'];

/** Everything about one person, read back the way the app will read it. */
async function person(displayName: string) {
  const [p] = await db.select().from(s.players).where(eq(s.players.displayName, displayName));
  if (!p) return null;
  const accounts = await db.select().from(s.accounts).where(eq(s.accounts.playerId, p.id));
  const memberships = [];
  for (const a of accounts) {
    const rows = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, a.id));
    memberships.push(...rows.map((m) => ({ ...m, rsn: a.rsn })));
  }
  return { player: p, accounts, memberships };
}

before(async () => {
  // Stop before the identity migration, so the database is in the shape 0006 has to transform.
  await resetDatabase(DB, '0005_clan_staff');
  ({ db, pool, schema: s } = await loadDb());
  s2 = s;
  ({ personOf, personOfOrCreate } = await import('../src/lib/roster.ts'));

  const clans = await db
    .insert(clansAtThisPoint)
    .values([
      { slug: 'alpha', name: 'Alpha Clan' },
      { slug: 'bravo', name: 'Bravo Clan' },
    ])
    .returning();
  const alpha = clans.find((c) => c.slug === 'alpha')!.id;
  const bravo = clans.find((c) => c.slug === 'bravo')!.id;

  const users = await db
    .insert(usersBeforeIdentity)
    .values([
      { displayName: 'Ahmed', discordId: '111' },
      { displayName: 'Woox', discordId: '222' },
    ])
    .returning();
  const ahmed = users.find((u) => u.discordId === '111')!.id;
  const woox = users.find((u) => u.discordId === '222')!.id;

  await db.insert(clanMembersBeforeIdentity).values([
    // One person, a main and an alt, on BOTH rosters. Four rows that must become one human.
    { clanId: alpha, rsn: 'AhmedMain', rsnNormalized: 'ahmedmain', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: alpha, rsn: 'AhmedAlt', rsnNormalized: 'ahmedalt', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: bravo, rsn: 'AhmedMain', rsnNormalized: 'ahmedmain', userId: ahmed, isGuest: 0, source: 'plugin-roster' },
    { clanId: bravo, rsn: 'AhmedAlt', rsnNormalized: 'ahmedalt', userId: ahmed, isGuest: 1, source: 'manual' },
    // Never logged in: a roster entry that is still a person.
    { clanId: alpha, rsn: 'Zezima', rsnNormalized: 'zezima', userId: null, isGuest: 0, source: 'plugin-roster' },
    // Unclaimed on one roster, claimed on the other — ownership must find the real person.
    // The two clans also DISAGREE about everything each of them tracked for this account, which is
    // what the merge rules have to resolve.
    {
      clanId: alpha, rsn: 'Woox', rsnNormalized: 'woox', userId: null, isGuest: 1, source: 'plugin-self',
      // alpha knows less: behind on XP, backed off after failed polls, never verified, still on
      // the watchlist.
      statsOverallXp: 100, statsMissStreak: 5, statsNextDueAt: '2026-09-01 00:00:00',
      provisional: 1, isPrimary: 0, previousRsns: '["Wooox"]',
      liveStats: '{"overall":100}', liveStatsAt: '2026-08-01 00:00:00', statsLastSnapshot: '{"snap":100}',
      statusLastChecked: '2026-08-01 00:00:00',
    },
    {
      clanId: bravo, rsn: 'Woox', rsnNormalized: 'woox', userId: woox, isGuest: 0, source: 'plugin-roster',
      statsOverallXp: 900, statsMissStreak: 0, statsNextDueAt: '2026-08-20 00:00:00',
      provisional: 0, isPrimary: 1, previousRsns: '["Wooox","Woox2"]',
      verifiedAt: '2026-07-01 00:00:00', verificationMethod: 'plugin', claimedAt: '2026-07-01 00:00:00',
      liveStats: '{"overall":900}', liveStatsAt: '2026-08-10 00:00:00', statsLastSnapshot: '{"snap":900}',
      statusLastChecked: '2026-08-10 00:00:00',
    },
  ]);

  seeded = await db
    .select({ id: clanMembersBeforeIdentity.id, clanId: clanMembersBeforeIdentity.clanId })
    .from(clanMembersBeforeIdentity);

  migrateRest(DB); // 0006 onwards run here — and 0008 drops clan_members
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a main and an alt across two clans collapse to one person', async () => {
  const ahmed = await person('Ahmed');
  assert.ok(ahmed);
  assert.equal(ahmed.accounts.length, 2, 'two OSRS accounts');
  assert.deepEqual(ahmed.accounts.map((a) => a.rsn).sort(), ['AhmedAlt', 'AhmedMain']);
  assert.equal(ahmed.memberships.length, 4, 'four roster rows');
  assert.equal(new Set(ahmed.memberships.map((m) => m.clanId)).size, 2, 'across two clans');
});

test('the same RSN on two rosters is ONE account, not two', async () => {
  const rows = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));
  assert.equal(rows.length, 1);
  const memberships = await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.accountId, rows[0].id));
  assert.equal(memberships.length, 2, 'one account, two clan rosters');
});

test('ownership prefers the claimed roster row over the unclaimed one', async () => {
  // Woox is unclaimed on alpha and claimed on bravo. The account must land on the real person, and
  // must not mint a second, ownerless "Woox" alongside them.
  const people = await db.select().from(s.players).where(eq(s.players.displayName, 'Woox'));
  assert.equal(people.length, 1, 'exactly one Woox');
  const [account] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));
  assert.equal(account.playerId, people[0].id);
});

test('a roster entry that never logged in still becomes a person', async () => {
  const zezima = await person('Zezima');
  assert.ok(zezima, 'unclaimed accounts have an owner from the moment they are seen');
  assert.equal(zezima.accounts.length, 1);
  assert.equal(zezima.memberships.length, 1);
});

test('membership kind carries the granted/guest distinction', async () => {
  const ahmed = await person('Ahmed');
  const byKind = ahmed!.memberships.map((m) => `${m.rsn}:${m.kind}:${m.source}`).sort();
  assert.deepEqual(byKind, [
    'AhmedAlt:guest:admin', // added by hand on bravo — a guest, not a member
    'AhmedAlt:member:roster',
    'AhmedMain:member:roster',
    'AhmedMain:member:roster',
  ]);
});

test('every account has an owner, and no person is left owning nothing', async () => {
  const accounts = await db.select().from(s.accounts);
  assert.ok(accounts.length > 0);
  assert.equal(accounts.filter((a) => a.playerId == null).length, 0, 'no ownerless accounts');

  // A person with no accounts is a ghost in the directory — the shape produced by minting a person
  // per unclaimed ROSTER ROW instead of per unclaimed ACCOUNT.
  const people = await db.select().from(s.players);
  const owned = new Set(accounts.map((a) => a.playerId));
  assert.deepEqual(
    people.filter((p) => !owned.has(p.id)).map((p) => p.displayName),
    [],
    'no people without accounts',
  );
});

test('a membership keeps the seat id its history already points at', async () => {
  // Fifteen tables carry a clan_member_id. The seat did not change when the row describing it split,
  // so every one of those references must still land on the same seat.
  const memberships = await db.select().from(s.clanMemberships);
  assert.deepEqual(
    memberships.map((m) => m.id).sort((a, b) => a - b),
    seeded.map((m) => m.id).sort((a, b) => a - b),
  );
  for (const seat of seeded) {
    const m = memberships.find((x) => x.id === seat.id)!;
    assert.equal(m.clanId, seat.clanId, `seat ${seat.id} stayed in its clan`);
  }
});

test('no roster row is lost in translation', async () => {
  const after = await db.select().from(s.clanMemberships);
  assert.equal(after.length, seeded.length);
});

test('one account, one hiscores identity — merged by what each number means', async () => {
  const [woox] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));

  // Total XP only goes up, so the highest reading any clan saw is the truest one.
  assert.equal(woox.statsOverallXp, 900);

  // A clan that polled successfully proves the account is reachable. Inheriting another clan's
  // backoff would park a healthy account at the back of the sweep queue for no reason.
  assert.equal(woox.statsMissStreak, 0);
  assert.equal(woox.statsNextDueAt, '2026-08-20 00:00:00');

  // Ownership does not expire and is not per clan: proved once, proved everywhere.
  assert.equal(woox.verifiedAt, '2026-07-01 00:00:00');
  assert.equal(woox.verificationMethod, 'plugin');
  assert.equal(woox.claimedAt, '2026-07-01 00:00:00');
  assert.equal(woox.provisional, 0, 'confirmed in one clan is confirmed, full stop');
  assert.equal(woox.isPrimary, 1);

  // Name history is append-only, so the longest record is the most complete.
  assert.equal(woox.previousRsns, '["Wooox","Woox2"]');
});

test('the stat blobs come from one moment, not spliced from several', async () => {
  const [woox] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'woox'));
  // Taking each column independently would pair bravo's live_stats with alpha's snapshot and
  // describe a state the account was never in. The freshest observation wins as a whole.
  assert.equal(woox.liveStatsAt, '2026-08-10 00:00:00');
  assert.equal(woox.liveStats, '{"overall":900}');
  assert.equal(woox.statsLastSnapshot, '{"snap":900}');
  assert.equal(woox.statusLastChecked, '2026-08-10 00:00:00');
});

test('per-seat facts stay on the seat', async () => {
  // notes and last_seen_in_clan are one clan's view of one seat. Merging them onto the account
  // would leak a clan's private note about someone into every other clan they play in.
  const seats = await db.select().from(s.clanMemberships);
  assert.ok(seats.length > 0);
  assert.ok('notes' in seats[0] && 'lastSeenInClan' in seats[0] && 'pendingRole' in seats[0]);
});

test('a login points at the person behind it', async () => {
  const logins = await db.select().from(s.users);
  assert.ok(logins.length > 0);
  for (const u of logins) assert.ok(u.playerId != null, `${u.displayName} has a person`);
});


// ── A login is not a person, and their ids are not interchangeable ────────────────────────────
// users.id and players.id come from separate sequences. They coincide only for rows this migration
// created together, so a NEW login gets a number that already belongs to some unrelated person —
// and comparing it against account ownership silently hands them that person's accounts.
//
// This was live: a fresh sign-in on a clan the user had never joined was shown as an existing member
// of it, because user #1 met player #1.
test('a new login gets its own person, not the one that shares its number', async () => {
  // Ahmed and Woox already exist as logins from the fixture; the next login is a fresh number in the
  // users sequence, and the accounts backfill has already used the low numbers in the players one.
  const [login] = await db
    .insert(s2.users)
    .values({ displayName: 'Newcomer', discordId: '333' })
    .returning();

  // The number this login shares with an existing person, if any.
  const [collision] = await db.select().from(s2.players).where(eq(s2.players.id, login.id));
  assert.ok(collision, 'the fixture is only meaningful while some person shares the number');
  assert.notEqual(collision.displayName, 'Newcomer', 'and it is somebody else');

  // Nothing may be inferred from the shared number: this login owns no accounts until it claims one.
  const seatsByUserId = await db.select().from(s2.clanRoster).where(eq(s2.clanRoster.playerId, login.id));
  const ownedByCollision = seatsByUserId.length;
  assert.ok(
    ownedByCollision > 0,
    'the collision really would have matched — which is what made the bug silent rather than empty',
  );

  // The login has no person yet, so it can own nothing. personOf must say so rather than guess.
  const person = await personOf(login.id);
  assert.equal(person, null, 'a login with no player_id resolves to no person');
});

test('claiming resolves a login to its own person before writing ownership', async () => {
  const [login] = await db
    .insert(s2.users)
    .values({ displayName: 'Claimer', discordId: '444' })
    .returning();

  const before = await db.select().from(s2.players);
  const personId = await personOfOrCreate(login.id);
  const after = await db.select().from(s2.players);

  // A real person row, created for this login — not the login's own number handed back, which is
  // what "they're the same id anyway" would have produced.
  assert.equal(after.length, before.length + 1, 'a person row was created');
  assert.equal(after.find((p) => p.id === personId)?.displayName, 'Claimer');

  const [refreshed] = await db.select().from(s2.users).where(eq(s2.users.id, login.id));
  assert.equal(refreshed.playerId, personId, 'and the link is recorded on the login');

  // Asking twice is the same person, not a second one.
  assert.equal(await personOfOrCreate(login.id), personId);
});


// ── "Unclaimed" is not "has no person" ────────────────────────────────────────────────────────
// Every account gets a person the moment it exists, so an unclaimed roster entry has an identity to
// accumulate history against and a later claim MERGES two people instead of filling in a blank.
//
// That makes `player_id IS NULL` permanently false, and it was the test for "has anyone claimed
// this?" in a dozen places — five SQL predicates and seven JavaScript ones. Two of the SQL ones
// guarded the auto-link paths against a concurrent claim, so instead of refusing a racing write they
// would have refused every write; the JS ones gated auto-linking itself, which simply stopped.
//
// The honest test is claimed_at: the moment a LOGIN asserted ownership.
test('an unclaimed account still has a person', async () => {
  const [zezima] = await db.select().from(s2.accounts).where(eq(s2.accounts.rsnNormalized, 'zezima'));
  assert.ok(zezima.playerId != null, 'nobody has claimed Zezima, and it still has an owner');
  assert.equal(zezima.claimedAt, null, 'which is exactly why claimed_at is the test, not player_id');
});

test('a claimed account is told apart from an unclaimed one by claimed_at alone', async () => {
  const all = await db.select().from(s2.accounts);
  assert.ok(all.length > 1);

  // If player_id could still answer this, every account would look claimed.
  assert.equal(
    all.filter((a) => a.playerId != null).length,
    all.length,
    'every account has a person, claimed or not',
  );
  assert.ok(
    all.some((a) => a.claimedAt == null),
    'and some are unclaimed, which only claimed_at reveals',
  );
});
