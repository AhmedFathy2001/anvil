// This week's luck (lib/weekLuck) against a real database: kills are the week's gains from the daily
// rows, drops are the plugin's moments in the same window, and only members whose plugin reported
// during the week are judged.
//
// Run: npx tsx --test tests/week-luck-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('week-luck-db');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let week: typeof import('../src/lib/weekLuck.ts');
let board: typeof import('../src/lib/clogLuckBoard.ts');

let clanId: number;
const NOW = new Date();
const day = (back: number) => new Date(NOW.getTime() - back * 86_400_000).toISOString().slice(0, 10);
const iso = (back: number) => new Date(NOW.getTime() - back * 86_400_000).toISOString();

/** A member with a seat, their plugin last seen `seenDaysAgo` (null = never). */
async function member(rsn: string, seenDaysAgo: number | null) {
  const [person] = await db.insert(s.players).values({}).returning();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn, rsnNormalized: rsn.toLowerCase(), liveStatsAt: seenDaysAgo == null ? null : iso(seenDaysAgo) })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member' }).returning();
  return { accountId: acct.id, seatId: seat.id, rsn };
}
const kills = (accountId: number, back: number, bosses: Record<string, number>) =>
  db.insert(s.memberDailyStats).values({ accountId, day: day(back), overallXp: 1, deltas: JSON.stringify({ bosses }) });
let n = 0;
const drop = (m: { seatId: number; rsn: string }, itemId: number, itemName: string, source: string, back: number) =>
  db.insert(s.moments).values({ clanMemberId: m.seatId, rsn: m.rsn, kind: 'unique', itemId, itemName, source, occurredAt: iso(back), dedupKey: `t-${n++}` });

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  week = await import('../src/lib/weekLuck.ts');
  board = await import('../src/lib/clogLuckBoard.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'weekluck', name: 'Week Luck' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('stored daily gains are read per boss and summed across days', () => {
  assert.deepEqual(week.bossGainsOf(JSON.stringify({ skills: { slayer: 5 }, bosses: { vorkath: 40, zulrah: 0, bad: 'x' } })), { vorkath: 40 });
  assert.deepEqual(week.bossGainsOf(null), {});
  assert.deepEqual(week.bossGainsOf('not json'), {});
  assert.deepEqual(week.sumBossGains([{ vorkath: 40 }, { vorkath: 10, zulrah: 3 }]), { vorkath: 50, zulrah: 3 });
});

test('a week is judged from that week’s kills and drops, and only for members whose plugin was seen', async () => {
  const candidates = await board.countedLuckCandidates(clanId);
  // A single-source drop with a known rate, so the expectations below can be worked out by hand.
  const c = candidates.find((x) => x.sources.length === 1 && x.sources[0].rolls === 1 && x.sources[0].denominator >= 100 && x.sources[0].denominator <= 5000);
  assert.ok(c, 'the datasets hold a simple single-source rare drop');
  const { bossKey, denominator, source } = c!.sources[0];

  const dry = await member('Dry Dan', 1);
  const spoon = await member('Spoon Sue', 2);
  const unseen = await member('Unseen Una', null);
  const stale = await member('Stale Stan', 20);
  const quiet = await member('Quiet Quinn', 1);

  // Dry: eight drops' worth of kills this week, none seen. Kills from before the window don't count.
  await kills(dry.accountId, 1, { [bossKey]: denominator * 5 });
  await kills(dry.accountId, 3, { [bossKey]: denominator * 3 });
  await kills(dry.accountId, 30, { [bossKey]: denominator * 50 });
  // Spooned: 0.6 of a drop's worth of kills (the least a result is called on), four drops; one older
  // than the window is ignored.
  await kills(spoon.accountId, 2, { [bossKey]: Math.round(denominator * 0.6) });
  for (const back of [1, 2, 2, 3]) await drop(spoon, c!.itemId, c!.itemName, source, back);
  await drop(spoon, c!.itemId, c!.itemName, source, 12);
  // Never seen, and seen only before the window: as many dropless kills as Dry, but we watched neither.
  await kills(unseen.accountId, 1, { [bossKey]: denominator * 8 });
  await kills(stale.accountId, 1, { [bossKey]: denominator * 8 });
  // Seen, a handful of kills, no drop: far too few to call dry.
  await kills(quiet.accountId, 1, { [bossKey]: Math.max(1, Math.round(denominator / 50)) });

  const out = await week.getWeekLuck(clanId, 15, NOW);
  assert.equal(out.members, 5);
  assert.equal(out.judged, 3, 'Dry, Spoon and Quiet had the plugin running this week');

  const dryRow = out.dry.find((e) => e.itemId === c!.itemId);
  assert.ok(dryRow, 'the dry board has the item');
  assert.equal(dryRow!.rsn, 'Dry Dan');
  assert.equal(dryRow!.assessment.kills, denominator * 8, 'this week’s kills only');
  assert.equal(dryRow!.assessment.obtained, 0);
  assert.ok(Math.abs(dryRow!.assessment.expected - 8) < 0.5);
  assert.ok(!out.dry.some((e) => ['Unseen Una', 'Stale Stan', 'Quiet Quinn'].includes(e.rsn)), 'unwatched and barely-played members are never called dry');

  const spoonRow = out.spooned.find((e) => e.itemId === c!.itemId);
  assert.ok(spoonRow, 'the spooned board has the item');
  assert.equal(spoonRow!.rsn, 'Spoon Sue');
  assert.equal(spoonRow!.assessment.obtained, 4, 'the drop from before the window is not counted');
});

test('a clan with nobody on the roster has an empty week', async () => {
  const [other] = await db.insert(s.clans).values({ slug: 'weekluck-empty', name: 'Empty' }).returning();
  assert.deepEqual(await week.getWeekLuck(other.id), { dry: [], spooned: [], judged: 0, members: 0 });
});
