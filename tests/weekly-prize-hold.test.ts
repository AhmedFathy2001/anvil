// A weekly ladder's gp is held while the competition runs, and released when it settles.
//
// WHAT THIS IS FOR. A ladder used to reserve nothing until the week ended, so "available for prizes"
// still counted gp that three live competitions had each already promised. They all read as funded,
// and whichever settled last found the pot empty and recorded a winner it could not pay. The promise
// now costs the pot when it is made — and gives back whatever nobody wins.
//
// Run: npm run test:weeklyhold

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-prize-hold');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let C: typeof import('../src/lib/coffer.ts');
let settleWeeklyPrizes: typeof import('../src/lib/weeklyPrizeSettle.ts')['settleWeeklyPrizes'];

let clanId: number;
let seatA: number;
let seatB: number;

const M = 1_000_000;

/** A competition, optionally already carrying a ladder. */
async function competition(opts: { places?: number[]; status?: string } = {}): Promise<number> {
  const places = (opts.places ?? []).map((gp) => ({ gp }));
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'skill',
      metric: 'runecraft',
      title: 'SOTW: Runecraft',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-08T00:00:00.000Z',
      status: opts.status ?? 'active',
      prizes: places.length ? JSON.stringify({ places, payZeroGain: false, splitTies: false }) : null,
    })
    .returning();
  return comp.id;
}

async function enter(competitionId: number, clanMemberId: number, rsn: string, gained: number) {
  await db.insert(s.weeklyParticipants).values({
    competitionId,
    clanMemberId,
    rsn,
    rsnNormalized: rsn.toLowerCase(),
    baselineValue: 0,
    currentValue: gained,
  });
}

const available = async () => (await C.getCofferBalance(clanId)).available;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  C = await import('../src/lib/coffer.ts');
  ({ settleWeeklyPrizes } = await import('../src/lib/weeklyPrizeSettle.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;

  const seat = async (rsn: string) => {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db
      .insert(s.accounts)
      .values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() })
      .returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
    return m.id;
  };
  seatA = await seat('Fried Silver');
  seatB = await seat('Drenvox mdps');

  // 50m in the pot, the way a real one gets there.
  await C.recordAdjustment({ clanId, amount: 50 * M, userId: null, note: 'seed' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the pot starts at what was put in it', async () => {
  assert.equal(await available(), 50 * M);
});

test('saving a ladder takes its gp out of available at once', async () => {
  const comp = await competition({ places: [5 * M] });
  const r = await C.setWeeklyPool({ clanId, competitionId: comp, amount: 5 * M, hold: true, userId: null });
  assert.ok(r.ok, JSON.stringify(r));

  const balance = await C.getCofferBalance(clanId);
  assert.equal(balance.available, 45 * M, 'held gp is no longer available');
  assert.equal(balance.reserved, 5 * M);
  assert.equal(balance.confirmed, 50 * M, 'nothing has actually left the clan yet');

  await C.releaseWeeklyPool(comp);
  assert.equal(await available(), 50 * M);
});

test('editing the ladder edits the same hold rather than stacking a second', async () => {
  const comp = await competition({ places: [5 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 5 * M, hold: true, userId: null });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 3 * M, hold: true, userId: null });

  assert.equal(await available(), 47 * M, 'promised 3m, not 8m');
  const rows = await db
    .select()
    .from(s.cofferEntries)
    .where(and(eq(s.cofferEntries.weeklyCompetitionId, comp), eq(s.cofferEntries.kind, 'pool')));
  assert.equal(rows.length, 1, 'one row, edited in place');

  await C.releaseWeeklyPool(comp);
});

test('two live ladders cannot promise the same gp', async () => {
  const first = await competition({ places: [30 * M] });
  const second = await competition({ places: [30 * M] });
  assert.ok((await C.setWeeklyPool({ clanId, competitionId: first, amount: 30 * M, hold: true, userId: null })).ok);

  const r = await C.setWeeklyPool({ clanId, competitionId: second, amount: 30 * M, hold: true, userId: null });
  assert.equal(r.ok, false, 'the second one is refused — this is the whole point');
  assert.match(!r.ok ? r.error : '', /only has/);

  // …but it may still be written down as a promise, funded from somewhere else.
  const planned = await C.setWeeklyPool({ clanId, competitionId: second, amount: 30 * M, hold: false, userId: null });
  assert.ok(planned.ok);
  assert.equal(await available(), 20 * M, 'a promise that is not held costs the pot nothing');

  await C.releaseWeeklyPool(first);
  await C.releaseWeeklyPool(second);
  assert.equal(await available(), 50 * M);
});

test('settling pays the winners out of the hold, and gives back what nobody won', async () => {
  // A 5m / 3m ladder with ONE entrant: second place is never won.
  const comp = await competition({ places: [5 * M, 3 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 8 * M, hold: true, userId: null });
  await enter(comp, seatA, 'Fried Silver', 169_000);
  assert.equal(await available(), 42 * M);

  await db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.id, comp));
  const result = await settleWeeklyPrizes(comp);
  assert.equal(result.settled, true);
  assert.equal(result.reserved, 1, 'one place was won');
  assert.equal(result.unfunded, 0, 'and the hold meant it could be paid');

  const balance = await C.getCofferBalance(clanId);
  assert.equal(balance.reserved, 5 * M, 'only the won place is still owed');
  assert.equal(balance.available, 45 * M, 'the unwon 3m is back in the pot');

  const awards = await db
    .select()
    .from(s.cofferEntries)
    .where(and(eq(s.cofferEntries.weeklyCompetitionId, comp), eq(s.cofferEntries.kind, 'award')));
  assert.equal(awards.length, 1);
  assert.equal(awards[0].rsn, 'Fried Silver');
  assert.equal(awards[0].status, 'reserved');
});

test('a week nobody scored on releases the whole hold', async () => {
  const before = await available();
  const comp = await competition({ places: [10 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 10 * M, hold: true, userId: null });
  // Entered, but gained nothing — and this ladder does not pay for turning up.
  await enter(comp, seatB, 'Drenvox mdps', 0);
  assert.equal(await available(), before - 10 * M);

  await db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.id, comp));
  await settleWeeklyPrizes(comp);

  assert.equal(await available(), before, 'no claimer, so the gp goes back');
});

test('deleting a competition does not leave its hold behind', async () => {
  const before = await available();
  const comp = await competition({ places: [7 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 7 * M, hold: true, userId: null });
  assert.equal(await available(), before - 7 * M);

  await C.releaseWeeklyPool(comp);
  await db.delete(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, comp));
  assert.equal(await available(), before);
});

// ── The floor ───────────────────────────────────────────────────────────────
// A clan cannot spend gp it does not have, and the ledger should not say it did.

test('an adjustment cannot take the coffer below zero', async () => {
  const have = await available();
  const r = await C.recordAdjustment({ clanId, amount: -(have + M), userId: null, note: 'oops' });
  assert.equal(r.ok, false);
  assert.equal(await available(), have, 'nothing was written');
});

test('nor can it spend gp a live ladder is holding', async () => {
  const comp = await competition({ places: [20 * M] });
  await C.setWeeklyPool({ clanId, competitionId: comp, amount: 20 * M, hold: true, userId: null });
  const free = await available();

  const r = await C.recordAdjustment({ clanId, amount: -(free + M), userId: null });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /already promised/);

  // Exactly what is free is fine.
  const ok = await C.recordAdjustment({ clanId, amount: -free, userId: null });
  assert.ok(ok.ok);
  assert.equal(await available(), 0);

  await C.releaseWeeklyPool(comp);
  assert.equal(await available(), 20 * M);
});

test('a treasurer who means it can still record the debt', async () => {
  const start = await C.getCofferBalance(clanId);
  // 5m more than the clan has at all — the case the floor refuses, forced through on purpose.
  const forced = await C.recordAdjustment({
    clanId,
    amount: -(start.confirmed + 5 * M),
    userId: null,
    force: true,
  });
  assert.ok(forced.ok, 'force is the way past the floor');

  const balance = await C.getCofferBalance(clanId);
  assert.equal(balance.confirmed, -5 * M, 'the ledger says what really happened');
  // `available` is still clamped at zero: an empty pot and a pot in debt can both fund nothing, and
  // a negative number there would read as money to promise. The shortfall shows as confirmed gp no
  // longer covering what is already owed.
  assert.equal(balance.available, 0);
  assert.ok(balance.confirmed < balance.reserved, 'the clan owes more than it holds, and it shows');
});
