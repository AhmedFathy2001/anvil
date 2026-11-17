// Competitions people sign up for, with an entry fee (lib/weeklySignups), against a real database.
// Also runs the migration chain through 0272.
//
// Run: npx tsx --test tests/weekly-signups-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-signups-db');
const HOUR = 3_600_000;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let W: typeof import('../src/lib/weeklySignups.ts');
let setSetting: typeof import('../src/lib/settings.ts')['setSetting'];
let clanId: number;
const people: Record<string, { userId: number; playerId: number; seat: number }> = {};
const staff: Record<string, number> = {};

async function comp(over: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'skill', metric: 'mining', title: 'SOTW: Mining', startDate: new Date(Date.now() + 48 * HOUR).toISOString(), endDate: new Date(Date.now() + 200 * HOUR).toISOString(), status: 'upcoming', hostEntrants: 'selected', selfSignup: true, entryFee: 500_000, ...over })
    .returning();
  return row;
}
const entrants = (id: number) => db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, id)).orderBy(s.weeklyParticipants.id);
const who = (name: string) => ({ userId: people[name].userId, playerId: people[name].playerId });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  W = await import('../src/lib/weeklySignups.ts');
  ({ setSetting } = await import('../src/lib/settings.ts'));
  const [clan] = await db.insert(s.clans).values({ slug: 'signups', name: 'Signups' }).returning();
  clanId = clan.id;
  for (const rsn of ['Alpha', 'Bravo']) {
    const [u] = await db.insert(s.users).values({ displayName: rsn }).returning();
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
    people[rsn] = { userId: u.id, playerId: p.id, seat: m.id };
  }
  // Alpha's second character.
  const [alt] = await db.insert(s.accounts).values({ playerId: people.Alpha.playerId, rsn: 'Alpha Alt', rsnNormalized: 'alpha alt' }).returning();
  await db.insert(s.clanMemberships).values({ clanId, accountId: alt.id, kind: 'member' });
  for (const name of ['Tess', 'Ada', 'Abe']) staff[name] = (await db.insert(s.users).values({ displayName: name }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the fee is a whole number of gp above zero, or none', () => {
  assert.equal(W.cleanEntryFee(500_000), 500_000);
  assert.equal(W.cleanEntryFee('250000.9'), 250_000);
  assert.equal(W.cleanEntryFee(0), null);
  assert.equal(W.cleanEntryFee(-5), null);
  assert.equal(W.cleanEntryFee(''), null);
  assert.equal(W.cleanEntryFee('abc'), null);
  assert.equal(W.cleanEntryFee(9e12), W.MAX_ENTRY_FEE);
});

test('a member enters their own character once, owing the fee; a second character is a second entry', async () => {
  const c = await comp();
  const first = await W.enterCompetition(c, who('Alpha'));
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.equal(first.value.feeStatus, 'pending');
  assert.equal(first.value.feeAmount, 500_000);
  assert.equal(first.value.enteredByUserId, people.Alpha.userId);
  assert.equal(first.value.baselineValue, null, 'the sweep reads their starting point');
  assert.ok((await W.enterCompetition(c, who('Alpha'))).ok, 'entering again is the same entry');
  assert.equal((await entrants(c.id)).length, 1);

  const mine = await W.myEntry(c, people.Alpha.playerId);
  assert.equal(mine.seats.length, 2);
  const altSeat = mine.seats.find((x) => x.rsn === 'Alpha Alt')!;
  assert.ok((await W.enterCompetition(c, who('Alpha'), { clanMemberId: altSeat.id })).ok);
  assert.deepEqual((await entrants(c.id)).map((e) => e.rsn).sort(), ['Alpha', 'Alpha Alt']);
});

test('refused without sign-ups, once it has ended, and for someone with no character in the clan', async () => {
  const closed = await comp({ selfSignup: false });
  const a = await W.enterCompetition(closed, who('Alpha'));
  assert.ok(!a.ok && a.status === 409);
  const ended = await comp({ status: 'completed' });
  assert.equal((await W.enterCompetition(ended, who('Alpha'))).ok, false);
  const open = await comp();
  const stranger = await W.enterCompetition(open, { userId: staff.Tess, playerId: null });
  assert.ok(!stranger.ok && /Link a character/.test(stranger.error));
  assert.equal(W.signupOpen(open), true);
  assert.equal(W.signupOpen(closed), false);
  assert.equal(W.signupOpen(ended), false);
});

test('a free competition has no fee to track', async () => {
  const c = await comp({ entryFee: null });
  const r = await W.enterCompetition(c, who('Bravo'));
  assert.ok(r.ok && r.value.feeStatus === null && r.value.feeAmount === null);
});

test('a sign-up can be taken back before the start while nothing was paid, and not after', async () => {
  const c = await comp();
  await W.enterCompetition(c, who('Bravo'));
  const gone = await W.leaveCompetition(c, { playerId: people.Bravo.playerId });
  assert.ok(gone.ok && gone.value === 1);
  assert.equal((await entrants(c.id)).length, 0);

  const paid = await comp();
  const e = await W.enterCompetition(paid, who('Bravo'));
  assert.ok(e.ok);
  if (!e.ok) return;
  await W.moveWeeklyFee(paid, e.value.id, 'collect', staff.Tess);
  const kept = await W.leaveCompetition(paid, { playerId: people.Bravo.playerId });
  assert.ok(!kept.ok && /already been taken/.test(kept.error));

  const running = await comp({ status: 'active', startDate: new Date(Date.now() - HOUR).toISOString() });
  await W.enterCompetition(running, who('Bravo'));
  const late = await W.leaveCompetition(running, { playerId: people.Bravo.playerId });
  assert.ok(!late.ok && /Opt out/.test(late.error));
});

test('the fee: collected, then confirmed by someone else, under the clan’s own policy', async () => {
  await setSetting(clanId, 'fee_confirmations_required', '1');
  const c = await comp();
  const e = await W.enterCompetition(c, who('Alpha'));
  assert.ok(e.ok);
  if (!e.ok) return;
  const id = e.value.id;
  const sheet0 = await W.weeklyFeeSheet(c);
  assert.equal(sheet0.owedGp, 500_000);

  const collected = await W.moveWeeklyFee(c, id, 'collect', staff.Tess);
  assert.ok(collected.ok);
  const required = sheet0.required;
  if (required === 0) {
    assert.ok(collected.ok && collected.value.feeStatus === 'confirmed');
  } else {
    assert.ok(collected.ok && collected.value.feeStatus === 'collected');
    const own = await W.moveWeeklyFee(c, id, 'confirm', staff.Tess);
    assert.ok(!own.ok && own.status === 403, 'the collector cannot confirm their own collection');
    const confirmed = await W.moveWeeklyFee(c, id, 'confirm', staff.Ada);
    assert.ok(confirmed.ok && confirmed.value.feeStatus === 'confirmed');
  }
  assert.equal(await W.weeklyFeesTakenGp(c.id), 500_000);
  assert.equal((await W.weeklyFeeSheet(c)).settledGp, 500_000);

  const again = await W.moveWeeklyFee(c, id, 'collect', staff.Tess);
  assert.ok(!again.ok && again.status === 409);
  const reset = await W.moveWeeklyFee(c, id, 'reset', staff.Ada);
  assert.ok(reset.ok && reset.value.feeStatus === 'pending' && reset.value.feeCollectedByUserId === null);
  const waived = await W.moveWeeklyFee(c, id, 'waive', staff.Ada);
  assert.ok(waived.ok && waived.value.feeStatus === null);
  assert.equal(await W.weeklyFeesTakenGp(c.id), 0);
});

test('someone staff added owes nothing until a fee is marked collected for them; other competitions are out of reach', async () => {
  const c = await comp();
  const [added] = await db.insert(s.weeklyParticipants).values({ competitionId: c.id, clanMemberId: people.Bravo.seat, rsn: 'Bravo', rsnNormalized: 'bravo' }).returning();
  assert.equal((await W.weeklyFeeSheet(c)).owedGp, 0);
  assert.equal((await W.moveWeeklyFee(c, added.id, 'confirm', staff.Ada)).ok, false);
  const taken = await W.moveWeeklyFee(c, added.id, 'collect', staff.Tess);
  assert.ok(taken.ok && taken.value.feeAmount === 500_000);
  const other = await comp();
  const wrong = await W.moveWeeklyFee(other, added.id, 'collect', staff.Tess);
  assert.ok(!wrong.ok && wrong.status === 404);
});
