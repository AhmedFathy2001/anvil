// "Members' alts only" (lib/weeklyGuests, include_guests = 2): the sweep enters members, and a guest
// only when the same person holds a member seat in the clan. The admin rows say which guests those are.
//
// Run: npx tsx --test tests/weekly-guest-alts-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-guest-alts');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let clanId: number;

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  ({ db, pool, schema: s } = loaded);
  const [clan] = await db.insert(s.clans).values({ slug: 'alts', name: 'Alts Clan' }).returning({ id: s.clans.id });
  clanId = clan!.id;
  // Main (member) and Main Alt (guest) are one person; Stranger is a guest of their own.
  const [p1, p2] = await db.insert(s.players).values([{ displayName: 'Main' }, { displayName: 'Stranger' }]).returning({ id: s.players.id });
  const seats = [
    { rsn: 'Main', player: p1!.id, kind: 'member' },
    { rsn: 'Main Alt', player: p1!.id, kind: 'guest' },
    { rsn: 'Stranger', player: p2!.id, kind: 'guest' },
  ];
  const accts = await db
    .insert(s.accounts)
    .values(seats.map((x) => ({ playerId: x.player, rsn: x.rsn, rsnNormalized: x.rsn.toLowerCase() })))
    .returning({ id: s.accounts.id });
  await db.insert(s.clanMemberships).values(
    seats.map((x, i) => ({ clanId, accountId: accts[i]!.id, rsn: x.rsn, rsnNormalized: x.rsn.toLowerCase(), status: 'active', kind: x.kind })),
  );
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function compWith(includeGuests: number) {
  const [c] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'boss', metric: 'zulrah', title: `t${includeGuests}`, startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-08T00:00:00.000Z', status: 'active', includeGuests })
    .returning({ id: s.weeklyCompetitions.id });
  return c!.id;
}

async function entered(compId: number) {
  const rows = await db.select({ rsn: s.weeklyParticipants.rsn }).from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, compId));
  return rows.map((r) => r.rsn).sort();
}

test('alts only: the member and their alt race, the other guest does not', async () => {
  const { enrollAllPlayers } = await import('../src/lib/weekly.ts');
  const id = await compWith(2);
  await enrollAllPlayers(id);
  assert.deepEqual(await entered(id), ['Main', 'Main Alt']);
  const { getWeeklyStandings } = await import('../src/lib/weeklyWorkspace.ts');
  const rows = await getWeeklyStandings(id);
  assert.equal(rows.find((r) => r.rsn === 'Main Alt')?.memberAlt, true);
  assert.equal(rows.find((r) => r.rsn === 'Main')?.memberAlt, false, 'a member seat is not an alt');
});

test('all and off still mean what they meant', async () => {
  const { enrollAllPlayers } = await import('../src/lib/weekly.ts');
  const all = await compWith(1);
  await enrollAllPlayers(all);
  assert.deepEqual(await entered(all), ['Main', 'Main Alt', 'Stranger']);
  const off = await compWith(0);
  await enrollAllPlayers(off);
  assert.deepEqual(await entered(off), ['Main']);
});
