// What the plugin is told, and whose it is.
//
// These builders were written when a deployment WAS a clan, so `select().from(events)` meant "this
// clan's events" and read as obviously correct. The multi-clan port changed what that line means
// without changing the line, and nothing failed: the shapes stayed identical, the tests stayed
// green, and `/api/plugin/schedule` — which takes no token at all — began answering for every clan
// on the platform.
//
// The lint rule flagged all four from the day it was written. They sat in the warning pile. So the
// point of this suite is to hold the filter in place with something that fails loudly, since the
// evidence is that a warning does not.
//
// Every test here puts a SECOND clan in the database with something live in it. A builder that
// forgot its filter does not error — it returns the other clan's row, which is why each assertion
// is about the neighbour being absent rather than about our own row being present.
//
// Run: npm run test:pluginscope

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-scope');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let P: typeof import('../src/lib/pluginConfig.ts');

let ours: number;
let theirs: number;

const iso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

async function event(clanId: number, name: string, visibility: string) {
  const { db, schema: s } = await loadDb();
  const [row] = await db
    .insert(s.events)
    .values({
      clanId,
      name,
      visibility,
      startDate: iso(1),
      endDate: iso(8),
      boardSize: 25,
    })
    .returning();
  return row.id;
}

async function weekly(clanId: number, title: string, status: string, metric = 'mining') {
  const { db, schema: s } = await loadDb();
  const [row] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
      title,
      type: 'skill',
      metric,
      status,
      startDate: iso(-1),
      endDate: iso(6),
    })
    .returning();
  return row.id;
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  P = await import('../src/lib/pluginConfig.ts');

  const rows = await db
    .insert(s.clans)
    .values([
      { slug: 'ours', name: 'Ours', inGameName: 'Ours CC' },
      { slug: 'theirs', name: 'Theirs', inGameName: 'Theirs CC' },
    ])
    .returning();
  [ours, theirs] = rows.map((c) => c.id);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The schedule ──────────────────────────────────────────────────────────────────────────────

test('the schedule lists our events and not the clan next door’s', async () => {
  await event(ours, 'Our Bingo', 'clan');
  await event(theirs, 'Their Bingo', 'clan');

  const titles = (await P.buildSchedule(ours)).bingos.map((b) => b.title);
  assert.deepEqual(titles, ['Our Bingo']);
});

test('and the neighbour sees the mirror image, not a merge', async () => {
  const titles = (await P.buildSchedule(theirs)).bingos.map((b) => b.title);
  assert.deepEqual(titles, ['Their Bingo']);
});

test('a clan with nothing running gets an empty schedule, not somebody else’s', async () => {
  // The failure mode that made this hard to notice: an unfiltered builder never returns nothing, so
  // an idle clan's panel looked populated and healthy.
  const { db, schema: s } = await loadDb();
  const [quiet] = await db
    .insert(s.clans)
    .values({ slug: 'quiet', name: 'Quiet', inGameName: 'Quiet CC' })
    .returning();

  const sched = await P.buildSchedule(quiet.id);
  assert.deepEqual(sched.bingos, []);
  assert.deepEqual(sched.weeklies, []);
});

test('an invited-only event is never advertised on the schedule', async () => {
  // S7's strongest guarantee is that an `invited` event is 404 to anyone not invited. A schedule is
  // an advertisement, and it takes no token, so it cannot be the surface that names them.
  await event(ours, 'Secret Invitational', 'invited');

  const titles = (await P.buildSchedule(ours)).bingos.map((b) => b.title);
  assert.equal(titles.includes('Secret Invitational'), false);
  assert.ok(titles.includes('Our Bingo'), 'the ordinary event still listed');
});

test('a `clan` event IS advertised — the jars in the field cannot be updated', async () => {
  // Deliberate, and worth stating: every event in the wild carries the default `clan`, and the
  // legacy endpoint is unauthenticated. Filtering these out would blank the panel on every installed
  // plugin rather than close a hole; naming the clan's address is the standing this endpoint has
  // always asked for. The hole that mattered was cross-CLAN, and that is what the filter closes.
  const titles = (await P.buildSchedule(ours)).bingos.map((b) => b.title);
  assert.ok(titles.includes('Our Bingo'));
});

test('weeklies are scoped the same way', async () => {
  await weekly(ours, 'Our SOTW', 'active');
  await weekly(theirs, 'Their SOTW', 'active', 'fishing');

  const ourTitles = (await P.buildSchedule(ours)).weeklies.map((w) => w.title);
  assert.deepEqual(ourTitles, ['Our SOTW']);
});

// ── The active weekly, which is not just read ─────────────────────────────────────────────────

test('a clan between competitions is told there is none, not handed the neighbour’s', async () => {
  // This one drove auto-enrolment on login, so an unfiltered answer did not merely mislead — the
  // enrol route created a seat in OUR clan and a participant row in THEIRS.
  const { db, schema: s } = await loadDb();
  const [between] = await db
    .insert(s.clans)
    .values({ slug: 'between', name: 'Between', inGameName: 'Between CC' })
    .returning();

  assert.equal(await P.getActiveWeekly(between.id), null);
});

test('and is handed its own when it has one', async () => {
  const active = await P.getActiveWeekly(theirs);
  assert.equal(active?.title, 'Their SOTW');
});

test('a finished competition of ours does not resurrect as an active one', async () => {
  const { db, schema: s } = await loadDb();
  const [solo] = await db
    .insert(s.clans)
    .values({ slug: 'solo', name: 'Solo', inGameName: 'Solo CC' })
    .returning();
  await weekly(solo.id, 'Old SOTW', 'completed');

  assert.equal(await P.getActiveWeekly(solo.id), null, 'completed is not active');
});

// ── The metrics the plugin is told to push ────────────────────────────────────────────────────

test('we are not told to track what other clans are competing on', async () => {
  // The stats ingest was never actually mis-crediting — it looks the participant up by
  // (competitionId, clanMemberId) and a foreign comp falls out there. What the missing filter did
  // was tell every client to sample and push metrics for every clan's competition, which leaks what
  // those clans are running and buys work nobody asked for.
  const metrics = await P.getActiveWeeklyMetrics(ours);
  assert.deepEqual(metrics.map((m) => m.metric), ['mining']);

  const theirMetrics = await P.getActiveWeeklyMetrics(theirs);
  assert.deepEqual(theirMetrics.map((m) => m.metric), ['fishing']);
});
