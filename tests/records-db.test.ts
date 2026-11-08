// Records against a real database (lib/records via lib/statHistory's update hook).
//
// What must hold: the first update only sets baselines; gains set records; a lower gain never
// overwrites a best; a day rollover moves the day baseline but keeps the week's; idle ticks write
// nothing; clan holders are the best current member per metric.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/records-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('records');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/records.ts');

const ids = {} as Record<string, number>;

const snap = (attack: number, zulrah: number) => ({
  skills: { overall: { rank: 1, level: 1, xp: attack }, attack: { rank: 1, level: 1, xp: attack } },
  bosses: { zulrah: { rank: 1, score: zulrah } },
});

async function character(rsn: string) {
  const [p] = await db.insert(s.players).values({ displayName: rsn }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase(), shared: true }).returning();
  return a.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/records.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  ids.clan = clan.id;
  ids.a = await character('Alice');
  ids.b = await character('Bob');
  await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: ids.a, kind: 'member', joinedAt: '2026-01-01T00:00:00Z' });
  await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: ids.b, kind: 'member', joinedAt: '2026-01-01T00:00:00Z' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const at = (iso: string) => new Date(iso);
const rec = async (accountId: number) =>
  Object.fromEntries((await R.getAccountRecords(accountId)).map((r) => [`${r.metric}|${r.period}`, r.value]));

test('gains set records, baselines roll per period, lower gains never overwrite', async () => {
  // Mon 2 Nov. First seen with a previous snapshot: baselines from previous, gains recorded.
  let r = await R.updateRecords({ accountId: ids.a, previous: snap(1000, 10), snapshot: snap(1500, 15), now: at('2026-11-02T10:00:00Z') });
  assert.equal(r.rolled, 4);
  let got = await rec(ids.a);
  assert.equal(got['attack|day'], 500);
  assert.equal(got['zulrah|week'], 5);
  assert.ok(got['hours_played|day'] > 0);

  // Same day, more kills: day/week records rise, nothing rolls.
  r = await R.updateRecords({ accountId: ids.a, previous: snap(1500, 15), snapshot: snap(1500, 30), now: at('2026-11-02T18:00:00Z') });
  assert.equal(r.rolled, 0);
  got = await rec(ids.a);
  assert.equal(got['zulrah|day'], 20);
  assert.equal(got['zulrah|year'], 20);

  // Next day, a smaller day: day baseline rolls, day record stays 20, week keeps climbing.
  r = await R.updateRecords({ accountId: ids.a, previous: snap(1500, 30), snapshot: snap(1500, 33), now: at('2026-11-03T09:00:00Z') });
  assert.equal(r.rolled, 1);
  got = await rec(ids.a);
  assert.equal(got['zulrah|day'], 20);
  assert.equal(got['zulrah|week'], 23);

  // Following Monday: week rolls too.
  r = await R.updateRecords({ accountId: ids.a, previous: snap(1500, 33), snapshot: snap(1500, 34), now: at('2026-11-09T09:00:00Z') });
  assert.equal(r.rolled, 2);
  const baselines = await db.select().from(s.accountPeriodBaselines).where(eq(s.accountPeriodBaselines.accountId, ids.a));
  assert.equal(baselines.length, 4);
});

test('an idle update writes nothing', async () => {
  const r = await R.updateRecords({ accountId: ids.a, previous: snap(1500, 34), snapshot: snap(1500, 34), now: at('2026-11-09T10:00:00Z') });
  assert.deepEqual(r, { rolled: 0, improved: 0 });
});

test('clan holders: best member per metric', async () => {
  await R.updateRecords({ accountId: ids.b, previous: snap(0, 0), snapshot: snap(100, 50), now: at('2026-11-02T10:00:00Z') });
  const holders = await R.getClanRecordHolders(ids.clan, 'day');
  const zul = holders.find((h) => h.metric === 'zulrah');
  assert.equal(zul?.rsn, 'Bob');
  assert.equal(zul?.value, 50);
  const atk = holders.find((h) => h.metric === 'attack');
  assert.equal(atk?.rsn, 'Alice');
  const board = await R.getClanRecordBoard(ids.clan, 'zulrah', 'day');
  assert.deepEqual(board.map((b) => b.rsn), ['Bob', 'Alice']);
});

test('first read backfills from daily rows; live records beat it only when higher', async () => {
  const c = await character('Cara');
  const day = (d: string, xp: number, zul: number) =>
    db.insert(s.memberDailyStats).values({
      accountId: c, day: d, overallXp: 1000, xpGained: xp,
      deltas: JSON.stringify({ skills: { attack: xp }, bosses: { zulrah: zul } }),
    });
  await day('2025-05-05', 400, 30);
  await day('2025-05-06', 100, 10);

  let got = await rec(c);
  assert.equal(got['attack|day'], 400);
  assert.equal(got['zulrah|week'], 40);
  assert.equal(got['overall|year'], 500);
  const [acct] = await db.select().from(s.accounts).where(eq(s.accounts.id, c));
  assert.ok(acct.recordsBackfilledAt);

  // Live: a smaller gain leaves the backfilled best; a larger one raises it.
  await R.updateRecords({ accountId: c, previous: snap(0, 0), snapshot: snap(50, 5), now: at('2026-11-02T10:00:00Z') });
  got = await rec(c);
  assert.equal(got['attack|day'], 400);
  await R.updateRecords({ accountId: c, previous: snap(50, 5), snapshot: snap(700, 5), now: at('2026-11-02T11:00:00Z') });
  got = await rec(c);
  assert.equal(got['attack|day'], 700);
  assert.equal(got['zulrah|week'], 40);

  // Running again does not reseed or lower anything.
  await R.ensureRecordsBackfilled(c);
  assert.equal((await rec(c))['attack|day'], 700);
});

test('clan holders include backfilled history', async () => {
  const d = await character('Dan');
  await db.insert(s.clanMemberships).values({ clanId: ids.clan, accountId: d, kind: 'member', joinedAt: '2026-01-01T00:00:00Z' });
  await db.insert(s.memberDailyStats).values({ accountId: d, day: '2025-01-01', overallXp: 1, xpGained: 5, deltas: JSON.stringify({ bosses: { vorkath: 77 } }) });
  const holders = await R.getClanRecordHolders(ids.clan, 'day');
  assert.equal(holders.find((h) => h.metric === 'vorkath')?.rsn, 'Dan');
});
