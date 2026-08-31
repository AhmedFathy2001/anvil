// The parts of the apex home that are about you.
//
// Two things here are worth pinning. The arena picks ONE competition out of however many a person is
// racing in, and the wrong pick is invisible — it just shows a less interesting number. And the
// streak is losable by design, which makes every boundary condition a real one: get the
// week-in-progress rule wrong and you end somebody's run on a Monday morning for no reason.
//
// Run: npx tsx --test tests/apex-home-signals.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { and, eq } from 'drizzle-orm';

const DB = useTestDatabase('apex-home-signals');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let S: typeof import('../src/lib/apexHomeSignals.ts');

let alpha: number;
let bravo: number;
let personId: number;
let mainAcc: number;
let altAcc: number;
let seatAlphaMain: number;

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  S = await import('../src/lib/apexHomeSignals.ts');

  const clanRows = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC' },
    ])
    .returning();
  [alpha, bravo] = clanRows.map((c) => c.id);

  const [person] = await db.insert(s.players).values({ displayName: 'Ahmed' }).returning();
  personId = person.id;

  const accs = await db
    .insert(s.accounts)
    .values([
      { playerId: person.id, rsn: 'Drenvox mdps', rsnNormalized: 'drenvox mdps' },
      { playerId: person.id, rsn: 'Denoverse', rsnNormalized: 'denoverse' },
    ])
    .returning();
  [mainAcc, altAcc] = accs.map((a) => a.id);

  // The shape the platform exists for: main is a member of Alpha and a GUEST in Bravo; the alt only
  // has a home. A per-clan site could not represent this at all.
  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: alpha, accountId: mainAcc, kind: 'member', source: 'roster' },
      { clanId: bravo, accountId: mainAcc, kind: 'guest', source: 'application' },
      { clanId: alpha, accountId: altAcc, kind: 'member', source: 'roster' },
    ])
    .returning();
  seatAlphaMain = seats[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Seats ─────────────────────────────────────────────────────────────────────────────────────

test('a character carries every seat it holds, homes before visits', async () => {
  const map = await S.seatsByAccount([mainAcc, altAcc]);
  const main = map.get(mainAcc) ?? [];

  assert.equal(main.length, 2, 'member seat and guest seat both present');
  assert.equal(main[0].kind, 'member', 'the home sorts first');
  assert.equal(main[0].clanName, 'Alpha');
  assert.equal(main[1].kind, 'guest');
  assert.equal(main[1].clanName, 'Bravo');

  assert.equal((map.get(altAcc) ?? []).length, 1, 'the alt has only a home');
});

// ── The arena ─────────────────────────────────────────────────────────────────────────────────

test('nothing live is null, not an empty shell', async () => {
  // A frequent and real state — most weeks, between competitions. The page has to lead with
  // something else rather than render a hero with no content in it.
  assert.equal(await S.arenaFor([mainAcc, altAcc]), null);
});

test('a live competition comes back ranked, with the field size', async () => {
  const { db, schema: s } = await loadDb();
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: alpha,
      title: 'Woodcutting Week',
      type: 'skill',
      metric: 'woodcutting',
      status: 'active',
      startDate: iso(-5),
      endDate: iso(2),
    })
    .returning();

  // Four rivals ahead and behind, so position and both gaps are exercised.
  await db.insert(s.weeklyParticipants).values([
    { competitionId: comp.id, clanMemberId: seatAlphaMain, rsn: 'Drenvox mdps', rsnNormalized: 'drenvox mdps', baselineValue: 0, currentValue: 3_020_000 },
    { competitionId: comp.id, rsn: 'Whipcrack', rsnNormalized: 'whipcrack', baselineValue: 0, currentValue: 4_100_000 },
    { competitionId: comp.id, rsn: 'Sotetseg', rsnNormalized: 'sotetseg', baselineValue: 0, currentValue: 3_610_000 },
    { competitionId: comp.id, rsn: 'Kyrellia', rsnNormalized: 'kyrellia', baselineValue: 0, currentValue: 3_340_000 },
    { competitionId: comp.id, rsn: 'Ironmammal', rsnNormalized: 'ironmammal', baselineValue: 0, currentValue: 2_880_000 },
  ]);

  const a = await S.arenaFor([mainAcc, altAcc]);
  assert.ok(a, 'a live competition resolves');
  assert.equal(a!.position, 4, 'three people are ahead');
  assert.equal(a!.fieldSize, 5);
  assert.equal(a!.gained, 3_020_000);

  // The gaps are the whole point of the hero — they are what makes a standing actionable.
  assert.equal(a!.gapAhead, 320_000, 'to third');
  assert.equal(a!.gapBehind, 140_000, 'the chaser');

  const you = a!.lanes.find((l) => l.you);
  assert.ok(you, 'the caller is always on the visible ladder');
  assert.equal(you!.rsn, 'Drenvox mdps');
});

test('the gain is measured from the frozen baseline, not the raw value', async () => {
  // The bug this guards: reading current_value alone would rank people by total XP rather than by
  // what they did this week, and the leaderboard would be a list of the oldest accounts.
  const { db, schema: s } = await loadDb();
  await db.insert(s.weeklyParticipants).values({
    competitionId: (await db.select({ id: s.weeklyCompetitions.id }).from(s.weeklyCompetitions))[0].id,
    rsn: 'Veteran',
    rsnNormalized: 'veteran',
    baselineValue: 200_000_000,
    currentValue: 200_100_000,
  });

  const a = await S.arenaFor([mainAcc, altAcc]);
  assert.equal(a!.position, 4, 'a 200M account that gained 100K is still behind');
});

test('between two live competitions it picks the one you are doing best in', async () => {
  const { db, schema: s } = await loadDb();
  // A second clan, a second race — and the caller is winning this one outright.
  const [comp2] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: bravo,
      title: 'Zulrah Week',
      type: 'boss',
      metric: 'zulrah',
      status: 'active',
      startDate: iso(-3),
      endDate: iso(4),
    })
    .returning();

  const [guestSeat] = await db
    .select({ id: s.clanMemberships.id })
    .from(s.clanMemberships)
    .where(sqlEq(s, bravo, mainAcc));

  await db.insert(s.weeklyParticipants).values([
    { competitionId: comp2.id, clanMemberId: guestSeat.id, rsn: 'Drenvox mdps', rsnNormalized: 'drenvox mdps', baselineValue: 0, currentValue: 500 },
    { competitionId: comp2.id, rsn: 'Someone', rsnNormalized: 'someone', baselineValue: 0, currentValue: 100 },
  ]);

  const a = await S.arenaFor([mainAcc, altAcc]);
  assert.equal(a!.title, 'Zulrah Week', 'first place somewhere beats fourth place elsewhere');
  assert.equal(a!.position, 1);
  assert.equal(a!.gapAhead, null, 'nobody is ahead of the leader');
});

// A tiny helper so the test above reads as a sentence rather than a where-clause.
function sqlEq(s: typeof import('../src/db/schema.ts'), clanId: number, accountId: number) {
  return and(eq(s.clanMemberships.clanId, clanId), eq(s.clanMemberships.accountId, accountId));
}

// ── The streak ────────────────────────────────────────────────────────────────────────────────

test('no activity at all is a zero streak, not a crash', async () => {
  const st = await S.streakFor([mainAcc, altAcc]);
  assert.equal(st.current, 0);
  assert.equal(st.best, 0);
});

test('any character counts toward the streak', async () => {
  // Someone whose main is resting while an alt grinds has not stopped playing. A streak that
  // punished them for that would be measuring the wrong thing.
  const { db, schema: s } = await loadDb();
  // TODAY, not two days ago. `day(2)` only lands inside the week in progress from Wednesday on —
  // run this on a Monday or a Tuesday and it falls into LAST week, the seventh pip is false, and the
  // suite fails for reasons that have nothing to do with streaks. Anchoring the newest row to day(0)
  // makes "the week in progress" true on every weekday.
  await db.insert(s.memberDailyStats).values([
    { accountId: altAcc, day: day(0), overallXp: 1_000_000, xpGained: 50_000 },
    { accountId: altAcc, day: day(7), overallXp: 950_000, xpGained: 40_000 },
    { accountId: altAcc, day: day(14), overallXp: 910_000, xpGained: 30_000 },
  ]);

  const st = await S.streakFor([mainAcc, altAcc]);
  assert.ok(st.current >= 3, `three consecutive weeks on the alt, got ${st.current}`);
  assert.equal(st.weeks.length, 7, 'seven pips, oldest first');
  assert.equal(st.weeks[6], true, 'the week in progress is active');
});

test('a week with zero gain breaks the run', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.memberDailyStats);
  await db.insert(s.memberDailyStats).values([
    { accountId: mainAcc, day: day(2), overallXp: 100, xpGained: 10_000 },
    // nothing in the week before last
    { accountId: mainAcc, day: day(23), overallXp: 90, xpGained: 10_000 },
    { accountId: mainAcc, day: day(30), overallXp: 80, xpGained: 10_000 },
  ]);

  const st = await S.streakFor([mainAcc, altAcc]);
  assert.ok(st.current <= 2, `the gap should end the current run, got ${st.current}`);
  assert.ok(st.best >= 2, 'but the older run still counts toward the best');
});

test('a row with zero XP does not count as activity', async () => {
  // member_daily_stats gets a row the first time an account is seen, gains or not. Treating the row
  // itself as activity would give everyone an unbreakable streak from the day they joined.
  const { db, schema: s } = await loadDb();
  await db.delete(s.memberDailyStats);
  await db.insert(s.memberDailyStats).values({ accountId: mainAcc, day: day(2), overallXp: 100, xpGained: 0 });

  const st = await S.streakFor([mainAcc, altAcc]);
  assert.equal(st.current, 0, 'a row is not a week played');
});
