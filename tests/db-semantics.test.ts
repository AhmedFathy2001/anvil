// The database contract: SQL behaviours the app depends on for correctness.
//
// This suite exists because of a specific gap. Of the test files in this repo, one executed SQL —
// everything else tests pure functions. So the suite could be fully green against a database layer
// that did not work at all, which is exactly the situation you must not be in when swapping SQLite
// for Postgres. These tests are the safety net for that port: they must pass unchanged on both.
//
// Every assertion here is about SEMANTICS, not syntax — what the database must guarantee, phrased
// so it is dialect-independent. The rules pinned below are the ones where a wrong answer is silent:
// nothing errors, a leaderboard is just quietly incorrect.
//
// Run: npm run test:db

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('db-semantics');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let savePersonalBests: typeof import('../src/lib/personalBests.ts')['savePersonalBests'];
let applyWeeklyValue: typeof import('../src/lib/weekly.ts')['applyWeeklyValue'];
let eq: typeof import('drizzle-orm')['eq'];
let and: typeof import('drizzle-orm')['and'];
let count: typeof import('drizzle-orm')['count'];
let sum: typeof import('drizzle-orm')['sum'];

const NOW = '2026-08-17T12:00:00.000Z';

// Every clan-scoped table needs an owning clan now, so the suite mints one.
let clanId: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ savePersonalBests } = await import('../src/lib/personalBests.ts'));
  ({ applyWeeklyValue } = await import('../src/lib/weekly.ts'));
  ({ eq, and, count, sum } = await import('drizzle-orm'));

  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'semantics', name: 'Semantics Clan' })
    .returning({ id: s.clans.id });
  clanId = clan!.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/**
 * A person with one account, seated on the test clan's roster.
 *
 * Returns the SEAT id, and `makeAccount` returns the account behind it — the two are different
 * things now, and the history tables want the account.
 */
async function makeMember(rsn: string): Promise<number> {
  const [person] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person!.id, rsn, rsnNormalized: rsn.toLowerCase() })
    .returning();
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: account!.id, kind: 'member', source: 'roster' })
    .returning({ id: s.clanMemberships.id });
  return seat!.id;
}

/** The account behind a fresh member — what personal bests, daily stats and the clog hang off. */
async function makeAccount(rsn: string): Promise<number> {
  const seatId = await makeMember(rsn);
  const [seat] = await db.select().from(s.clanRoster).where(eq(s.clanRoster.id, seatId));
  return seat!.accountId;
}

// ── Generated keys come back from the insert ──────────────────────────────────────────────────
// .returning() is used at ~93 call sites; a dialect where it came back empty or without the
// generated id would break inserts everywhere, so it is worth pinning on its own.
test('insert returns the generated primary key', async () => {
  const id = await makeMember('Returning Test');
  assert.ok(Number.isInteger(id) && id > 0, `expected a generated id, got ${id}`);

  const [row] = await db.select().from(s.clanRoster).where(eq(s.clanRoster.id, id));
  assert.equal(row?.rsn, 'Returning Test');
});

// ── Conflicting insert reports that it did nothing ────────────────────────────────────────────
// This is load-bearing beyond deduplication: tile-completion Discord notifications fire only on a
// real insert, detected by .returning() coming back EMPTY on conflict. A dialect that returned the
// existing row instead would double-post every completion the sweep and a live push both saw.
test('onConflictDoNothing returns nothing when it did nothing', async () => {
  const rsn = 'Conflict Probe';
  const [person] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const values = { playerId: person!.id, rsn, rsnNormalized: rsn.toLowerCase() };

  const first = await db.insert(s.accounts).values(values).onConflictDoNothing().returning({ id: s.accounts.id });
  assert.equal(first.length, 1, 'first insert should report a row');

  const second = await db.insert(s.accounts).values(values).onConflictDoNothing().returning({ id: s.accounts.id });
  assert.equal(second.length, 0, 'conflicting insert must report NO row, or notifications double-fire');
});

// ── Personal bests keep the fastest, whatever the order ───────────────────────────────────────
// The rule lives in a scalar min() inside the conflict clause (lib/personalBests). On Postgres that
// becomes LEAST(). If the port got it wrong the endpoint would still 200 and simply record whichever
// time arrived last, quietly overwriting real records with slower ones.
test('a slower personal best never overwrites a faster one', async () => {
  const memberId = await makeAccount('PB Runner');
  const best = (activity: string, centis: number) => [{ activity, teamSize: 0, centis }];

  await savePersonalBests(memberId, best('zulrah', 12_000), NOW);
  await savePersonalBests(memberId, best('zulrah', 9_500), NOW); // improvement
  await savePersonalBests(memberId, best('zulrah', 20_000), NOW); // slower — must be ignored

  const rows = await db
    .select()
    .from(s.memberPersonalBests)
    .where(and(eq(s.memberPersonalBests.accountId, memberId), eq(s.memberPersonalBests.activity, 'zulrah')));

  assert.equal(rows.length, 1, 'the unique index must collapse these to one row');
  assert.equal(rows[0]!.centis, 9_500, 'the fastest time must survive regardless of push order');
});

test('personal bests are per (account, activity, team size)', async () => {
  const memberId = await makeAccount('PB Sizes');
  await savePersonalBests(
    memberId,
    [
      { activity: 'tob', teamSize: 0, centis: 30_000 },
      { activity: 'tob', teamSize: 3, centis: 25_000 },
      { activity: 'tob', teamSize: 5, centis: 22_000 },
    ],
    NOW,
  );

  const rows = await db
    .select()
    .from(s.memberPersonalBests)
    .where(and(eq(s.memberPersonalBests.accountId, memberId), eq(s.memberPersonalBests.activity, 'tob')));

  assert.equal(rows.length, 3, 'team sizes are distinct records, not competing ones');
  assert.deepEqual(rows.map((r) => r.centis).sort((a, b) => a - b), [22_000, 25_000, 30_000]);
});

// ── Weekly values only ever climb ─────────────────────────────────────────────────────────────
// currentValue is written with an atomic scalar max() (lib/weekly) so a 15-minute sweep and a live
// plugin push writing between each other's read and write cannot lose an update. On Postgres this
// becomes GREATEST(). A broken port shows up as a competition leaderboard that jitters downward.
test('a weekly value is monotonic under interleaved writes', async () => {
  const memberId = await makeMember('Weekly Climber');
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'skill',
      metric: 'mining',
      title: 'Mining SOTW',
      startDate: '2026-08-10T00:00:00.000Z',
      endDate: '2026-08-24T00:00:00.000Z',
      status: 'active',
    })
    .returning({ id: s.weeklyCompetitions.id });

  const [participant] = await db
    .insert(s.weeklyParticipants)
    .values({
      competitionId: comp!.id,
      clanMemberId: memberId,
      rsn: 'Weekly Climber',
      rsnNormalized: 'weekly climber',
      baselineValue: 1_000_000,
      currentValue: 1_000_000,
    })
    .returning({ id: s.weeklyParticipants.id });

  const apply = (value: number) =>
    applyWeeklyValue({
      participantId: participant!.id,
      type: 'skill',
      metric: 'mining',
      value,
      baselineValue: 1_000_000,
      currentValue: null, // force the atomic-max path rather than the JS guard
      lastUpdated: null,
      allowFirstCapture: false,
      competitionStartIso: '2026-08-10T00:00:00.000Z',
      now: NOW,
    });

  // Fire them together: whatever order the database serialises them in, the highest must win.
  await Promise.all([apply(1_500_000), apply(1_200_000), apply(1_400_000)]);

  const row = await db.query.weeklyParticipants.findFirst({
    where: eq(s.weeklyParticipants.id, participant!.id),
  });
  assert.equal(row?.currentValue, 1_500_000, 'concurrent writes must converge on the maximum');

  // And a late low read still cannot drag it back down.
  await apply(900_000);
  const after = await db.query.weeklyParticipants.findFirst({
    where: eq(s.weeklyParticipants.id, participant!.id),
  });
  assert.equal(after?.currentValue, 1_500_000, 'a lower later value must not lower the record');
});

// ── Booleans survive the round trip ───────────────────────────────────────────────────────────
// 55 columns store booleans as 0/1 integers and a handful are declared { mode: 'boolean' }. Postgres
// has a real boolean type, so this is precisely where a port silently changes what a column means.
test('boolean columns round-trip as booleans, flag columns as 0/1', async () => {
  const [user] = await db
    .insert(s.users)
    .values({ displayName: 'Bool Probe', role: 'member', isOwner: true, banned: false })
    .returning({ id: s.users.id });

  const row = await db.query.users.findFirst({ where: eq(s.users.id, user!.id) });
  assert.equal(row?.isOwner, true, 'a true boolean must read back true, not 1 or "1"');
  assert.equal(row?.banned, false, 'a false boolean must read back false, not 0 or null');

  const memberId = await makeMember('Flag Probe');
  const [member] = await db.select().from(s.clanRoster).where(eq(s.clanRoster.id, memberId));
  assert.equal(member?.provisional, 0, 'integer flag columns keep their 0/1 domain');
});

// ── Aggregates come back as numbers, not strings ──────────────────────────────────────────────
// COUNT() and SUM(integer) are bigint in Postgres, and the driver returns bigint as a STRING by
// default to protect precision. Every scoreboard in the app compares those results with === against
// a number, so the default silently makes '20' === 20 false: no error, no crash, just a leaderboard
// that reads wrong. src/db configures the parser; this pins it so nobody removes it.
test('count and sum come back as numbers', async () => {
  const [event] = await db
    .insert(s.events)
    .values({ clanId, name: 'Aggregate Board', boardSize: 5, startDate: NOW, endDate: NOW })
    .returning({ id: s.events.id });

  await db.insert(s.tiles).values([
    { eventId: event!.id, position: 0, label: 'a', points: 10 },
    { eventId: event!.id, position: 1, label: 'b', points: 25 },
  ]);

  const [agg] = await db
    .select({ n: count(), points: sum(s.tiles.points) })
    .from(s.tiles)
    .where(eq(s.tiles.eventId, event!.id));

  assert.equal(typeof agg!.n, 'number', `count came back as ${typeof agg!.n}`);
  assert.equal(agg!.n, 2);
  assert.equal(Number(agg!.points), 35);
  // The one that actually bit: a strict comparison against a number literal.
  assert.ok(agg!.n === 2, 'count must be === comparable to a number literal');
});

// ── Deleting a parent takes its children ──────────────────────────────────────────────────────
// 85 foreign keys rely on ON DELETE CASCADE. SQLite only enforces foreign keys when the pragma is
// on, so this is as much a "are constraints actually active" probe as a cascade test — orphaned
// tiles and completions would score forever against an event nobody can see.
test('deleting an event cascades to its tiles, teams and completions', async () => {
  const [event] = await db
    .insert(s.events)
    .values({ clanId, name: 'Cascade Board', boardSize: 5, startDate: NOW, endDate: NOW })
    .returning({ id: s.events.id });

  const [team] = await db
    .insert(s.teams)
    .values({ eventId: event!.id, name: 'Alpha', color: '#d0553f' })
    .returning({ id: s.teams.id });

  const [tile] = await db
    .insert(s.tiles)
    .values({ eventId: event!.id, position: 0, label: 'a tile', points: 10 })
    .returning({ id: s.tiles.id });

  await db.insert(s.completions).values({ teamId: team!.id, tileId: tile!.id, completedAt: NOW });

  await db.delete(s.events).where(eq(s.events.id, event!.id));

  const tiles = await db.select().from(s.tiles).where(eq(s.tiles.eventId, event!.id));
  const teams = await db.select().from(s.teams).where(eq(s.teams.eventId, event!.id));
  const completions = await db.select().from(s.completions).where(eq(s.completions.tileId, tile!.id));

  assert.equal(tiles.length, 0, 'tiles must not outlive their event');
  assert.equal(teams.length, 0, 'teams must not outlive their event');
  assert.equal(completions.length, 0, 'completions must not outlive their tile');
});

// ── A failed transaction leaves nothing behind ────────────────────────────────────────────────
// Used by the crown-then-demote ownership transfer among others, where a half-applied write would
// leave the clan with two owners or none.
test('a transaction that throws rolls back every write in it', async () => {
  const [person] = await db.insert(s.players).values({ displayName: 'Rollback' }).returning();
  const before = await db.select().from(s.accounts);

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.insert(s.accounts).values({ playerId: person!.id, rsn: 'Rollback A', rsnNormalized: 'rollback a' });
      await tx.insert(s.accounts).values({ playerId: person!.id, rsn: 'Rollback B', rsnNormalized: 'rollback b' });
      throw new Error('deliberate failure');
    }),
  );

  const after = await db.select().from(s.accounts);
  assert.equal(after.length, before.length, 'neither row may survive the rollback');
});

// ── Uniqueness is case-folded by the normalized column, not the display one ───────────────────
// OSRS names are case-insensitive, so accounts store a normalized copy and put the constraint there.
// Losing this lets one person hold two accounts and split their own stats.
//
// GLOBAL, and that is the point: on clan_members this index was global only by accident of one clan
// per database, and had to weaken to (clan, rsn) once clans shared one. Here it means what it says.
test('the same RSN in different casing cannot be enrolled twice', async () => {
  const [person] = await db.insert(s.players).values({ displayName: 'CaseTest' }).returning();
  await db.insert(s.accounts).values({ playerId: person!.id, rsn: 'CaseTest', rsnNormalized: 'casetest' });
  await assert.rejects(
    db.insert(s.accounts).values({ playerId: person!.id, rsn: 'casetest', rsnNormalized: 'casetest' }),
    'the normalized unique index must reject a second casing',
  );
});
