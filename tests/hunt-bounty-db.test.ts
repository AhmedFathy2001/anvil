// Item hunt bounties against a real database (lib/weeklyPrizeSettle, lib/coffer, lib/weeklyPrizeRedo):
// one award per claimed bounty place, beside the place prizes and never colliding with them, a second
// settle pass that pays nothing twice, the redo, and the wait for staff to confirm the drops behind a claim.
//
// Run: TESTS_OK=1 npx tsx --test tests/hunt-bounty-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, ne } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('hunt-bounty');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let H: typeof import('../src/lib/itemHuntDb.ts');
let settleWeeklyPrizes: typeof import('../src/lib/weeklyPrizeSettle.ts')['settleWeeklyPrizes'];
let redoWeeklyPrizes: typeof import('../src/lib/weeklyPrizeRedo.ts')['redoWeeklyPrizes'];

const M = 1_000_000;
const WHIP = 4151;
const FANG = 12922;
const HOUR = 3_600_000;
const START = Date.now() - 48 * HOUR;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

let clanId = 0;
let staffUserId = 0;
const seats: Record<string, number> = {};

async function hunt(opts: { confirm: 'auto' | 'staff'; places?: number[] }) {
  await db.update(s.weeklyCompetitions).set({ status: 'completed', prizesSettledAt: new Date().toISOString() }).where(and(eq(s.weeklyCompetitions.clanId, clanId), ne(s.weeklyCompetitions.status, 'completed')));
  const places = (opts.places ?? []).map((gp) => ({ gp }));
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      type: 'hunt',
      metric: 'Whip + Fang',
      title: 'Bounty hunt',
      startDate: new Date(START).toISOString(),
      endDate: new Date(Date.now() + 120 * HOUR).toISOString(),
      status: 'active',
      includeGuests: 0,
      prizes: places.length ? JSON.stringify({ places, payZeroGain: false, splitTies: false }) : null,
      hunt: JSON.stringify({
        v: 2, target: 'items', petGroup: null, rule: 'first', ends: { kind: 'date' }, confirm: opts.confirm, killsOf: null, xpSkill: null,
        items: [
          { id: WHIP, name: 'Abyssal whip', sources: [], count: 'drops', stat: null, bounty: [20 * M, 10 * M] },
          { id: FANG, name: 'Tanzanite fang', sources: [], count: 'drops', stat: null, bounty: [5 * M] },
        ],
      }),
    })
    .returning();
  for (const rsn of ['Alpha', 'Bravo', 'Carol', 'Guest']) {
    await db.insert(s.weeklyParticipants).values({ competitionId: comp.id, clanMemberId: seats[rsn], rsn, rsnNormalized: rsn.toLowerCase(), baselineValue: 0, currentValue: 0 });
  }
  return comp;
}

const report = (itemId: number, hoursAgo: number) => ({ kind: 'drop', itemId, itemName: itemId === WHIP ? 'Abyssal whip' : 'Tanzanite fang', quantity: 1, source: 'Somewhere', kc: null, occurredAt: ago(hoursAgo), dedupKey: 'k' });
const send = (rsn: string, itemId: number, hoursAgo: number) => H.recordHuntReports({ clanMemberId: seats[rsn], rsn }, clanId, [report(itemId, hoursAgo)]);
const finish = (id: number) => db.update(s.weeklyCompetitions).set({ status: 'completed' }).where(eq(s.weeklyCompetitions.id, id));
const awards = (id: number) =>
  db.select().from(s.cofferEntries).where(and(eq(s.cofferEntries.weeklyCompetitionId, id), eq(s.cofferEntries.kind, 'award'))).orderBy(s.cofferEntries.id);
const live = async (id: number) => (await awards(id)).filter((a) => a.status !== 'cancelled');

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  H = await import('../src/lib/itemHuntDb.ts');
  ({ settleWeeklyPrizes } = await import('../src/lib/weeklyPrizeSettle.ts'));
  ({ redoWeeklyPrizes } = await import('../src/lib/weeklyPrizeRedo.ts'));
  const C = await import('../src/lib/coffer.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'bounty', name: 'Bounty Clan' }).returning();
  clanId = clan.id;
  const [user] = await db.insert(s.users).values({ displayName: 'Olive' }).returning();
  staffUserId = user.id;
  for (const [rsn, kind] of [['Alpha', 'member'], ['Bravo', 'member'], ['Carol', 'member'], ['Guest', 'guest']] as const) {
    const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind }).returning();
    seats[rsn] = m.id;
  }
  await C.recordAdjustment({ clanId, amount: 200 * M, userId: null, note: 'seed' });
});

after(async () => {
  await new Promise((r) => setTimeout(r, 300));
  await pool.end();
  await dropDatabase(DB);
});

let paidComp = 0;

test('one award per claimed bounty place, beside the place prizes, and a second settle pays nothing twice', async () => {
  const comp = await hunt({ confirm: 'auto', places: [3 * M] });
  paidComp = comp.id;
  await send('Guest', WHIP, 30); // a guest on a members-only hunt: claims nothing, blocks nothing
  await send('Alpha', WHIP, 20);
  await send('Alpha', WHIP, 18); // their second whip is not the second place
  await send('Bravo', WHIP, 10);
  await send('Carol', WHIP, 5); // the whip pays two places
  await send('Bravo', FANG, 8);
  await send('Alpha', FANG, 4); // a later fang wins nothing
  await finish(comp.id);

  const first = await settleWeeklyPrizes(comp.id);
  assert.equal(first.settled, true);
  const rows = await live(comp.id);
  assert.deepEqual(
    rows.map((r) => [r.place, r.itemId, r.itemPlace, r.rsn, -r.amount]).sort((a, b) => String(a).localeCompare(String(b))),
    [
      [1, null, null, 'Alpha', 3 * M],
      [null, FANG, 1, 'Bravo', 5 * M],
      [null, WHIP, 1, 'Alpha', 20 * M],
      [null, WHIP, 2, 'Bravo', 10 * M],
    ].sort((a, b) => String(a).localeCompare(String(b))),
  );
  assert.ok(rows.every((r) => r.status === 'reserved'));
  assert.match(rows.find((r) => r.itemId === WHIP && r.itemPlace === 2)!.note ?? '', /2nd Abyssal whip bounty/);
  assert.equal(first.reserved, 4);

  // Settled again (the stamp cleared, as a second tick or a crash mid-way would leave it): nothing new.
  await db.update(s.weeklyCompetitions).set({ prizesSettledAt: null }).where(eq(s.weeklyCompetitions.id, comp.id));
  await settleWeeklyPrizes(comp.id);
  assert.equal((await awards(comp.id)).length, 4, 'still four rows');
});

test('the redo replaces bounty awards as it does place prizes', async () => {
  const result = await redoWeeklyPrizes(paidComp, staffUserId, { repost: false });
  assert.equal(result.ok, true);
  const all = await awards(paidComp);
  assert.equal(all.filter((a) => a.status === 'cancelled').length, 4, 'the old ones kept as history');
  const now = all.filter((a) => a.status !== 'cancelled');
  assert.equal(now.length, 4);
  assert.deepEqual(now.filter((a) => a.itemId === WHIP).map((a) => [a.itemPlace, a.rsn]).sort(), [[1, 'Alpha'], [2, 'Bravo']]);
});

test('a bounty with no place prizes waits for staff to confirm the drop behind it; a rejected one passes to the next', async () => {
  const comp = await hunt({ confirm: 'staff' });
  await send('Bravo', FANG, 20);
  await send('Carol', FANG, 10);
  await finish(comp.id);
  assert.equal((await settleWeeklyPrizes(comp.id)).settled, false, 'Bravo’s fang is not confirmed yet');
  assert.equal((await awards(comp.id)).length, 0);

  const drops = await db.select().from(s.huntDrops).where(eq(s.huntDrops.competitionId, comp.id)).orderBy(s.huntDrops.occurredAt);
  await H.decideHuntDrop(comp, drops[0].id, 'reject', { userId: staffUserId });
  assert.equal((await settleWeeklyPrizes(comp.id)).settled, false, 'now Carol’s claims it, and hers waits too');
  await H.decideHuntDrop(comp, drops[1].id, 'confirm', { userId: staffUserId });
  const done = await settleWeeklyPrizes(comp.id);
  assert.equal(done.settled, true);
  assert.deepEqual((await live(comp.id)).map((a) => [a.itemId, a.itemPlace, a.rsn, -a.amount]), [[FANG, 1, 'Carol', 5 * M]]);
});
