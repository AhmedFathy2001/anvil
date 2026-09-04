// A competition enrols its OWN clan, and nobody else's.
//
// enrollAllPlayers read the roster with no clan in the query. On one database per clan that was
// invisible — every seat in the database WAS the clan. The day two clans shared one, the catch-up
// enrolment on the weekly cron put 272 of LFL's members into The AFK Spot's Boss of the Week, and
// the standings reported it as fact: 412 participants in a clan of 286.
//
// It got there past the lint rule that exists to catch exactly this, because the query carried a
// blanket "the caller already settled the clan" suppression. That is true of the COMPETITION and
// says nothing about whose roster to read — the two are different questions, and the comment
// answered the wrong one.
//
// Run: npx tsx --test tests/weekly-enroll-scope.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, and } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-enroll-scope');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let enrollAllPlayers: typeof import('../src/lib/weekly.ts')['enrollAllPlayers'];

let hostClan: number;
let otherClan: number;
let compId: number;

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  db = loaded.db;
  pool = loaded.pool;
  s = loaded.schema;
  ({ enrollAllPlayers } = await import('../src/lib/weekly.ts'));

  const [host, other] = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'visitor', name: 'Visiting Clan' },
    ])
    .returning({ id: s.clans.id });
  hostClan = host!.id;
  otherClan = other!.id;

  // Three seats in the clan running the competition, two in a clan that has nothing to do with it.
  const names = ['Host One', 'Host Two', 'Host Three', 'Guest One', 'Guest Two'];
  // An account belongs to a PERSON, so each needs one to hang off.
  const people = await db
    .insert(s.players)
    .values(names.map((rsn) => ({ displayName: rsn })))
    .returning({ id: s.players.id });
  const accounts = await db
    .insert(s.accounts)
    .values(
      names.map((rsn, i) => ({
        playerId: people[i]!.id,
        rsn,
        rsnNormalized: rsn.toLowerCase(),
      })),
    )
    .returning({ id: s.accounts.id, rsn: s.accounts.rsn });

  await db.insert(s.clanMemberships).values(
    accounts.map((a, i) => ({
      clanId: i < 3 ? hostClan : otherClan,
      accountId: a.id,
      rsn: a.rsn,
      rsnNormalized: a.rsn.toLowerCase(),
      status: 'active',
      kind: 'member',
    })),
  );

  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: hostClan,
      type: 'boss',
      metric: 'kalphiteQueen',
      title: 'BOTW: Kalphite Queen',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-08T00:00:00.000Z',
      status: 'active',
    })
    .returning({ id: s.weeklyCompetitions.id });
  compId = comp!.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('enrolment stops at the clan running the competition', async () => {
  const enrolled = await enrollAllPlayers(compId);
  assert.equal(enrolled, 3, 'the host clan has three active seats');

  const rows = await db
    .select({ clanId: s.clanRoster.clanId })
    .from(s.weeklyParticipants)
    .innerJoin(s.clanRoster, eq(s.weeklyParticipants.clanMemberId, s.clanRoster.id))
    .where(eq(s.weeklyParticipants.competitionId, compId));

  assert.equal(rows.length, 3);
  assert.ok(
    rows.every((r) => r.clanId === hostClan),
    'not one seat from another clan may appear on this board',
  );
});

test('re-running enrols nobody twice', async () => {
  // The cron calls this every tick to catch members who joined after the comp was made.
  assert.equal(await enrollAllPlayers(compId), 0);
  const [{ count }] = await db
    .select({ count: s.weeklyParticipants.id })
    .from(s.weeklyParticipants)
    .where(eq(s.weeklyParticipants.competitionId, compId));
  assert.ok(count != null);
});

test('a visiting clan running its own week keeps its own people', async () => {
  const [theirs] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: otherClan,
      type: 'skill',
      metric: 'sailing',
      title: 'SOTW: Sailing',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-08T00:00:00.000Z',
      status: 'active',
    })
    .returning({ id: s.weeklyCompetitions.id });

  assert.equal(await enrollAllPlayers(theirs!.id), 2, 'the visiting clan has two seats');

  const crossed = await db
    .select({ id: s.weeklyParticipants.id })
    .from(s.weeklyParticipants)
    .innerJoin(s.clanRoster, eq(s.weeklyParticipants.clanMemberId, s.clanRoster.id))
    .where(and(eq(s.weeklyParticipants.competitionId, theirs!.id), eq(s.clanRoster.clanId, hostClan)));
  assert.equal(crossed.length, 0);
});
