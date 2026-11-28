// The last hiscores read before a competition's results (lib/weeklyFinalRead), against a real
// database: a player who logged out after the sweep's last visit gets their kills before the
// standings are taken, the guards the sweep uses still hold, and hunts read nothing.
//
// Run: TESTS_OK=1 npx tsx --test tests/weekly-final-read-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-final-read');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/weeklyFinalRead.ts');
let F: typeof import('../src/lib/weeklyFinish.ts');
let clanId: number;
const seats: Record<string, number> = {};
const HOUR = 3_600_000;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/weeklyFinalRead.ts');
  F = await import('../src/lib/weeklyFinish.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'rsu', name: 'Test Clan' }).returning();
  clanId = clan.id;
  for (const rsn of ['Early', 'Late', 'Renamed', 'Fresh']) {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
    seats[rsn] = m.id;
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function botw(type = 'boss') {
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type,
      metric: 'lunarChests',
      title: 'BOTW: Moons Of Peril',
      startDate: new Date(Date.now() - 72 * HOUR).toISOString(),
      endDate: new Date(Date.now() - 1000).toISOString(),
      status: 'active',
      includeGuests: 0,
    })
    .returning();
  const rows: [string, number | null, number | null][] = [
    ['Early', 5, 200], // read 10 minutes ago, still 200 on the hiscores
    ['Late', 2, 190], // logged out after the sweep's last visit: 235 on the hiscores now
    ['Renamed', 10, 150], // the name now belongs to a smaller account: 3 on the hiscores
    ['Fresh', null, null], // never read during the competition
  ];
  for (const [rsn, b, c] of rows) {
    await db.insert(s.weeklyParticipants).values({ competitionId: comp.id, clanMemberId: seats[rsn], rsn, rsnNormalized: rsn.toLowerCase(), baselineValue: b, currentValue: c });
  }
  return comp;
}

const hiscores: Record<string, number> = { Early: 200, Late: 235, Renamed: 3, Fresh: 40 };
const fake = async (rsn: string) => ({ kind: 'value' as const, value: hiscores[rsn] });

const values = async (id: number) =>
  Object.fromEntries(
    (await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, id))).map((p) => [p.rsn, [p.baselineValue, p.currentValue]]),
  );

test('a late logout is read before the standings; the sweep guards still hold', async () => {
  const comp = await botw();
  R.startFinalReadBudget();
  const out = await R.finalHiscoresRead(comp, fake as never);
  assert.equal(out.read, 4);
  assert.equal(out.updated, 1);
  // Everyone was read after the end: nothing holds the results, and a second pass reads nobody again.
  assert.equal(out.remaining, 0);
  const again = await R.finalHiscoresRead(comp, fake as never);
  assert.equal(again.read, 0);
  assert.equal(again.remaining, 0);
  assert.deepEqual(await values(comp.id), {
    Early: [5, 200],
    Late: [2, 235], // the kills after the last sweep count
    Renamed: [10, 150], // a lower read never overwrites
    Fresh: [null, null], // no start is invented at the end
  });
  const standings = await F.finalStandings({ ...comp, status: 'completed' });
  assert.deepEqual(standings.slice(0, 2).map((x) => x.rsn), ['Late', 'Early']);
});

test('an item hunt reads nothing', async () => {
  const comp = await botw('hunt');
  let calls = 0;
  const out = await R.finalHiscoresRead(comp, (async () => {
    calls++;
    return { kind: 'value', value: 1 };
  }) as never);
  assert.equal(calls, 0);
  assert.equal(out.read, 0);
});

test('a spent budget leaves the rest at their last value and still returns', async () => {
  const comp = await botw();
  R.startFinalReadBudget(Date.now() - R.FINAL_READ_BUDGET_MS - 1);
  // A budget already spent this tick is not renewed by the next competition.
  const out = await R.finalHiscoresRead(comp, fake as never);
  assert.equal(out.read, 0);
  assert.equal(out.skipped, 4);
  assert.equal((await values(comp.id)).Late[1], 190);
  // Nobody read yet: the results keep waiting (lib/weeklyFinish), and the next tick reads them.
  assert.equal(out.remaining, 4);
  assert.equal(out.unread.length, 4);
});

test('redo moves reserved prizes to the corrected standings, and is refused once one is paid', async () => {
  const C = await import('../src/lib/coffer.ts');
  const P = await import('../src/lib/weeklyPrizeSettle.ts');
  const X = await import('../src/lib/weeklyPrizeRedo.ts');
  await C.recordAdjustment({ clanId, amount: 100_000_000, userId: null, note: 'seed' });
  const comp = await botw();
  await db
    .update(s.weeklyCompetitions)
    .set({ status: 'completed', prizes: JSON.stringify({ places: [{ gp: 20_000_000 }, { gp: 15_000_000 }], payZeroGain: false, splitTies: false }) })
    .where(eq(s.weeklyCompetitions.id, comp.id));
  await P.settleWeeklyPrizes(comp.id);
  const awards = async () =>
    (await db.select().from(s.cofferEntries).where(eq(s.cofferEntries.weeklyCompetitionId, comp.id)))
      .filter((e) => e.kind === 'award')
      .map((e) => [e.rsn, e.place, e.status]);
  assert.deepEqual(await awards(), [['Early', 1, 'reserved'], ['Late', 2, 'reserved']]);

  // Staff force a track after the end: Late really finished on 235.
  await db.update(s.weeklyParticipants).set({ currentValue: 235 }).where(eq(s.weeklyParticipants.rsn, 'Late'));
  const res = await X.redoWeeklyPrizes(comp.id, null, { repost: false });
  assert.equal(res.ok, true);
  const after = await awards();
  assert.deepEqual(after.filter((a) => a[2] === 'reserved').sort(), [['Early', 2, 'reserved'], ['Late', 1, 'reserved']]);
  assert.deepEqual(after.filter((a) => a[2] === 'cancelled').length, 2);

  // A treasurer marks 1st paid: the redo now refuses and changes nothing.
  await db.update(s.cofferEntries).set({ status: 'paid' }).where(eq(s.cofferEntries.place, 1));
  const refused = await X.redoWeeklyPrizes(comp.id, null, { repost: false });
  assert.deepEqual(refused, { ok: false, reason: 'paid', paid: ['Late'] });
  assert.deepEqual((await awards()).filter((a) => a[2] !== 'cancelled').sort(), [['Early', 2, 'reserved'], ['Late', 1, 'paid']]);
});
