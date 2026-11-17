// The daily and halfway posts of a weekly competition (lib/weeklyDaily, lib/competitionTeamsPosts,
// lib/rankMoves): the rules, then the real path against a database with Discord stood in for.
//
// Run: npx tsx --test tests/weekly-daily-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { dailyLines, dailyWindowOpen, dayBest, dayClimber, dayWorthPosting, switchOn } from '../src/lib/weeklyDaily.ts';

const DB = useTestDatabase('weekly-daily-db');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const key = (s: string) => s.toLowerCase();

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/rankMoves.ts');
let P: typeof import('../src/lib/competitionTeamsPosts.ts');
let setSetting: typeof import('../src/lib/settings.ts')['setSetting'];

const posts: { url: string; embed: { author?: { name: string }; title?: string; description?: string; fields?: { name: string; value: string }[] } }[] = [];
const realFetch = globalThis.fetch;

let n = 0;
async function clanWithWeekly(opts: { startedHoursAgo?: number; endsInHours?: number } = {}) {
  const [clan] = await db.insert(s.clans).values({ slug: `weekly-daily-${n++}`, name: 'Daily Test' }).returning();
  await setSetting(clan.id, 'discord_webhook_url', `https://discord.com/api/webhooks/1${clan.id}/token`);
  const [comp] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: clan.id,
      type: 'skill',
      metric: 'mining',
      title: 'SOTW: Mining',
      startDate: new Date(Date.now() - (opts.startedHoursAgo ?? 30) * HOUR).toISOString(),
      endDate: new Date(Date.now() + (opts.endsInHours ?? 100) * HOUR).toISOString(),
      status: 'active',
    })
    .returning();
  for (const [rsn, gained] of [['Alpha', 500_000], ['Bravo', 300_000], ['Carol', 0]] as const) {
    await db.insert(s.weeklyParticipants).values({ competitionId: comp.id, rsn, rsnNormalized: rsn.toLowerCase(), baselineValue: 1_000_000, currentValue: 1_000_000 + gained });
  }
  return { clan, comp };
}
const gain = (competitionId: number, rsn: string, to: number) =>
  db.update(s.weeklyParticipants).set({ currentValue: 1_000_000 + to }).where(eq(s.weeklyParticipants.rsnNormalized, rsn.toLowerCase()));
const postsFor = (clanId: number) => posts.filter((p) => p.url.includes(`/webhooks/1${clanId}/`));

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/rankMoves.ts');
  P = await import('../src/lib/competitionTeamsPosts.ts');
  ({ setSetting } = await import('../src/lib/settings.ts'));
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('discord.com/api/webhooks')) {
      const body = JSON.parse(String(init?.body ?? '{}'));
      posts.push({ url: u, embed: body.embeds?.[0] ?? {} });
      return new Response(JSON.stringify({ id: '1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await dropDatabase(DB);
});

test('the day is the board now against the board as the day began', () => {
  const board = [{ rsn: 'Bravo', gained: 900 }, { rsn: 'Alpha', gained: 700 }, { rsn: 'Carol', gained: 0 }];
  const lines = dailyLines(board, { ranks: { alpha: 1, bravo: 2, carol: 3 }, gains: { alpha: 600, bravo: 200 } }, key)!;
  assert.deepEqual(lines.map((l) => [l.rsn, l.total, l.day, l.rank, l.moved]), [['Bravo', 900, 700, 1, 1], ['Alpha', 700, 100, 2, -1], ['Carol', 0, 0, 3, 0]]);
  assert.equal(dayBest(lines)?.rsn, 'Bravo');
  assert.equal(dayClimber(lines)?.rsn, 'Bravo');
  assert.equal(dayWorthPosting(lines), true);

  const first = dailyLines(board, null, key)!;
  assert.deepEqual(first.map((l) => [l.day, l.moved]), [[900, null], [700, null], [0, null]], 'day one: everything so far, nothing to compare ranks with');
  assert.equal(dailyLines(board, { ranks: {}, gains: null }, key), null, 'a day start kept before gains were stored cannot be worked out');

  const quiet = dailyLines(board, { ranks: { bravo: 1, alpha: 2, carol: 3 }, gains: { bravo: 900, alpha: 700, carol: 0 } }, key)!;
  assert.equal(dayWorthPosting(quiet), false);
  assert.equal(dayBest(quiet), null);
  assert.equal(dayClimber(quiet), null);
});

test('not in the first half day, not in the last three hours; a switch is on unless turned off', () => {
  const now = Date.parse('2026-11-17T00:00:30Z');
  const iso = (ms: number) => new Date(ms).toISOString();
  assert.equal(dailyWindowOpen(iso(now - 30 * HOUR), iso(now + 5 * DAY), now), true);
  assert.equal(dailyWindowOpen(iso(now - 4 * HOUR), iso(now + 5 * DAY), now), false);
  assert.equal(dailyWindowOpen(iso(now - 6 * DAY), iso(now + 2 * HOUR), now), false);
  assert.equal(dailyWindowOpen('nonsense', iso(now), now), false);
  for (const v of [null, undefined, '', 'true', '1']) assert.equal(switchOn(v), true);
  for (const v of ['false', '0']) assert.equal(switchOn(v), false);
});

test('a new day posts the day just finished, once, and a quiet day posts nothing', async () => {
  const { clan, comp } = await clanWithWeekly();
  const now = Date.now();
  await R.runWeeklyDayRanks(now);
  await R.runWeeklyDayRanks(now);
  let mine = postsFor(clan.id);
  assert.equal(mine.length, 1, 'one post for the day, however many ticks');
  assert.equal(mine[0].embed.author?.name, 'Skill of the Week · day 1');
  assert.match(mine[0].embed.description ?? '', /\*\*Alpha\*\* had the biggest day: \+500,000 XP\./);
  const standings = mine[0].embed.fields?.find((f) => f.name === 'Standings')?.value ?? '';
  assert.match(standings, /🥇 \*\*Alpha\*\* — \+500,000 XP · \+500,000 XP today/);
  assert.ok(!standings.includes('Carol'), 'nobody with nothing gained is listed');

  // The next day: Bravo overtakes.
  await gain(comp.id, 'Bravo', 900_000);
  await R.runWeeklyDayRanks(now + DAY);
  mine = postsFor(clan.id);
  assert.equal(mine.length, 2);
  assert.equal(mine[1].embed.author?.name, 'Skill of the Week · day 2');
  assert.match(mine[1].embed.description ?? '', /\*\*Bravo\*\* had the biggest day: \+600,000 XP\./);
  assert.match(mine[1].embed.fields?.[0].value ?? '', /🥇 \*\*Bravo\*\* — \+900,000 XP · \+600,000 XP today ▲1\n🥈 \*\*Alpha\*\* — \+500,000 XP ▼1/);

  // A day when nobody gained anything.
  await R.runWeeklyDayRanks(now + 2 * DAY);
  assert.equal(postsFor(clan.id).length, 2);
});

test('a clan that turned the daily update off hears nothing, and neither does a weekly that just started', async () => {
  const off = await clanWithWeekly();
  await setSetting(off.clan.id, 'weekly_post_daily', 'false');
  const fresh = await clanWithWeekly({ startedHoursAgo: 2 });
  await R.runWeeklyDayRanks(Date.now() + 5 * DAY + HOUR);
  assert.equal(postsFor(off.clan.id).length, 0);
  assert.equal(postsFor(fresh.clan.id).length, 0);
});

test('a solo weekly posts its halfway standings once, unless the clan turned that off', async () => {
  const { clan, comp } = await clanWithWeekly({ startedHoursAgo: 80, endsInHours: 60 });
  const board = () => R.weeklyBoard(comp.id);
  assert.equal(await P.announceHalfwayIfDue(comp, Date.now(), board), true);
  const [again] = await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, comp.id));
  assert.equal(await P.announceHalfwayIfDue(again, Date.now(), board), false);
  const mine = postsFor(clan.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].embed.author?.name, 'Skill of the Week · halfway');
  assert.match(mine[0].embed.description ?? '', /\*\*Alpha\*\* leads/);
  assert.match(mine[0].embed.fields?.[0].value ?? '', /🥇 \*\*Alpha\*\* — \+500,000 XP\n🥈 \*\*Bravo\*\* — \+300,000 XP$/);

  const off = await clanWithWeekly({ startedHoursAgo: 80, endsInHours: 60 });
  await setSetting(off.clan.id, 'weekly_post_halfway', '0');
  await P.announceHalfwayIfDue(off.comp, Date.now(), () => R.weeklyBoard(off.comp.id));
  assert.equal(postsFor(off.clan.id).length, 0);
});
