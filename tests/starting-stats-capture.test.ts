// Taking a late joiner's starting stats the moment they're added (lib/startingStats), end to end.
//
// Run with Forge owning the hiscores, because that is production and because it keeps the test off
// the network: Forge is simulated by doing to hiscores_fetches exactly what it does (stamp the
// pending row with fetched_at, an outcome and the raw body). Asserted: the read is queued at the top
// lane and left for the drain, the live overlay is folded into the start line, nothing happens before
// the start, a pre-start or partial start line is redone, a 404 leaves them uncaptured (and says so),
// and a weekly participant added mid-competition gets their starting value.
//
// Run: TEST_DATABASE_URL=postgres://anvil:anvil@127.0.0.1:5442/postgres npx tsx --test tests/starting-stats-capture.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('starting-stats');
process.env.STATS_SWEEP_OWNER = 'forge';

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let lib: typeof import('../src/lib/startingStats.ts');

let clanId: number;
let runningEventId: number;
let futureEventId: number;
let runningTeamId: number;
let futureTeamId: number;

const hoursFromNow = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

function body(attackXp: number, zulrah = 40) {
  return JSON.stringify({
    skills: [
      { id: 0, name: 'Overall', rank: 5, level: 100, xp: attackXp },
      { id: 1, name: 'Attack', rank: 5, level: 20, xp: attackXp },
    ],
    activities: [{ id: 0, name: 'Zulrah', rank: 9, score: zulrah }],
  });
}

/** Play Forge: answer whatever is pending for this name, once it shows up. */
async function forgeAnswers(rsnKey: string, outcome: 'ok' | 'unranked', raw: string | null) {
  for (let i = 0; i < 40; i++) {
    const r = await pool.query(
      `UPDATE hiscores_fetches SET fetched_at = now(), claimed_at = now(), outcome = $2, body = $3
       WHERE rsn_key = $1 AND mode = 'main' AND fetched_at IS NULL RETURNING id`,
      [rsnKey, outcome, raw],
    );
    if (r.rowCount) return;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(`nothing was queued for ${rsnKey}`);
}

let n = 0;
/** A clan member with a participant row on the given event/team. */
async function member(name: string, opts: { eventId: number; teamId: number | null; live?: Record<string, number>; snapshot?: string; snapshotAt?: string }) {
  const [p] = await db.insert(s.players).values({ displayName: name }).returning();
  const key = name.toLowerCase();
  const [a] = await db
    .insert(s.accounts)
    .values({
      playerId: p.id,
      rsn: name,
      rsnNormalized: key,
      liveStats: opts.live ? JSON.stringify(opts.live) : null,
      liveStatKeyTimes: opts.live ? JSON.stringify(Object.fromEntries(Object.keys(opts.live).map((k) => [k, new Date().toISOString()]))) : null,
    })
    .returning();
  const [m] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member' }).returning();
  const [row] = await db
    .insert(s.eventParticipants)
    .values({
      eventId: opts.eventId,
      clanMemberId: m.id,
      accountId: a.id,
      name,
      teamId: opts.teamId,
      playerToken: `tok-${++n}`,
      pickedAt: new Date().toISOString(),
      statsSnapshot: opts.snapshot ?? null,
      snapshotAt: opts.snapshotAt ?? null,
    })
    .returning();
  return { participantId: row.id, accountId: a.id, membershipId: m.id, key };
}

async function participant(id: number) {
  const [r] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, id));
  return r;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  lib = await import('../src/lib/startingStats.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'late', name: 'Late Test' }).returning();
  clanId = clan.id;
  const [running] = await db
    .insert(s.events)
    .values({ clanId, name: 'Running', boardSize: 5, startDate: hoursFromNow(-2), endDate: hoursFromNow(48) })
    .returning();
  const [future] = await db
    .insert(s.events)
    .values({ clanId, name: 'Future', boardSize: 5, startDate: hoursFromNow(24), endDate: hoursFromNow(72) })
    .returning();
  runningEventId = running.id;
  futureEventId = future.id;
  [{ id: runningTeamId }] = await db.insert(s.teams).values({ eventId: runningEventId, name: 'A', color: '#fff' }).returning();
  [{ id: futureTeamId }] = await db.insert(s.teams).values({ eventId: futureEventId, name: 'B', color: '#fff' }).returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('a late joiner is read at the top of the queue and the live session is folded into the start line', async () => {
  const m = await member('Latejoin', { eventId: runningEventId, teamId: runningTeamId, live: { attack: 3000 } });
  const capture = lib.captureStartingStats(runningEventId, [m.participantId]);
  await forgeAnswers(m.key, 'ok', body(2500));
  const tally = await capture;
  assert.equal(tally.captured, 1);

  const row = await participant(m.participantId);
  const baseline = JSON.parse(row.statsSnapshot!);
  assert.equal(baseline.skills.attack.xp, 3000, 'the session already running when they were added is not a gain');
  assert.ok(Date.parse(row.snapshotAt!) >= Date.now() - 60_000, 'taken now, after the start');
  assert.ok(row.cachedStats, 'current stats warmed too');

  const [q] = await db.select().from(s.hiscoresFetches).where(eq(s.hiscoresFetches.rsnKey, m.key));
  assert.equal(q.priority, lib.LATE_JOINER_PRIORITY, 'the late-joiner lane, ahead of competition work');
  assert.equal(q.consumedAt, null, 'left for the drain to apply as usual');

  const status = await lib.startingStatsFor((await db.query.events.findFirst({ where: eq(s.events.id, runningEventId) }))!, [{ ...row }]);
  assert.equal(status[row.id]?.state, 'taken');
});

test('before the start nothing is queued and nothing is written', async () => {
  const m = await member('Earlybird', { eventId: futureEventId, teamId: futureTeamId });
  const tally = await lib.captureStartingStats(futureEventId, [m.participantId]);
  assert.deepEqual(tally, { captured: 0, failed: 0, skipped: 0 });
  assert.equal((await participant(m.participantId)).statsSnapshot, null);
  assert.equal((await db.select().from(s.hiscoresFetches).where(eq(s.hiscoresFetches.rsnKey, m.key))).length, 0);
});

test('a pool player is not read — nothing scores until they are on a team', async () => {
  const m = await member('Poolside', { eventId: runningEventId, teamId: null });
  const tally = await lib.captureStartingStats(runningEventId, [m.participantId]);
  assert.equal(tally.captured + tally.failed, 0);
  assert.equal((await db.select().from(s.hiscoresFetches).where(eq(s.hiscoresFetches.rsnKey, m.key))).length, 0);
});

test('a start line from before the start is redone', async () => {
  const stale = JSON.stringify({ skills: { overall: { xp: 100 }, attack: { xp: 100 } }, bosses: {} });
  const m = await member('Tooearly', { eventId: runningEventId, teamId: runningTeamId, snapshot: stale, snapshotAt: hoursFromNow(-3) });
  const capture = lib.captureStartingStats(runningEventId, [m.participantId]);
  await forgeAnswers(m.key, 'ok', body(900));
  assert.equal((await capture).captured, 1);
  const row = await participant(m.participantId);
  assert.equal(JSON.parse(row.statsSnapshot!).skills.attack.xp, 900);
});

test('a partial starting-shot line is completed from the read, keeping what it knew', async () => {
  const partial = JSON.stringify({ skills: { overall: { xp: 700 }, attack: { xp: 700 } }, bosses: {}, partial: true });
  const m = await member('Halfshot', { eventId: runningEventId, teamId: runningTeamId, snapshot: partial, snapshotAt: hoursFromNow(-1) });
  const capture = lib.captureStartingStats(runningEventId, [m.participantId]);
  await forgeAnswers(m.key, 'ok', body(800, 55));
  assert.equal((await capture).captured, 1);
  const b = JSON.parse((await participant(m.participantId)).statsSnapshot!);
  assert.notEqual(b.partial, true, 'no longer partial');
  assert.equal(b.skills.attack.xp, 700, 'the shot’s own reading wins');
  assert.equal(b.bosses.zulrah.score, 55, 'the unseen boss is filled from the read');
});

test('a 404 leaves them uncaptured, and the roster says it could not read them', async () => {
  const m = await member('Ghost', { eventId: runningEventId, teamId: runningTeamId });
  const capture = lib.captureStartingStats(runningEventId, [m.participantId]);
  await forgeAnswers(m.key, 'unranked', null);
  assert.equal((await capture).failed, 1);
  const row = await participant(m.participantId);
  assert.equal(row.statsSnapshot, null);
  const event = (await db.query.events.findFirst({ where: eq(s.events.id, runningEventId) }))!;
  // Read off hiscores_fetches, not this process's memory — so it holds across a restart.
  assert.equal((await lib.startingStatsFor(event, [row]))[row.id]?.state, 'failed');
});

test('a request still waiting on Forge reads as pending, not failed', async () => {
  const m = await member('Waiter', { eventId: runningEventId, teamId: runningTeamId });
  await db.insert(s.hiscoresFetches).values({ rsn: 'Waiter', rsnKey: m.key, priority: -1, mode: 'main' });
  const row = await participant(m.participantId);
  const event = (await db.query.events.findFirst({ where: eq(s.events.id, runningEventId) }))!;
  assert.equal((await lib.startingStatsFor(event, [row]))[row.id]?.state, 'pending');
});

test('the late lane is kept short: past the cap, a new request goes in the competition lane', async () => {
  for (let i = 0; i < 10; i++) {
    await db.insert(s.hiscoresFetches).values({ rsn: `Q${i}`, rsnKey: `queued${i}`, priority: -1, mode: 'main' });
  }
  const m = await member('Overflow', { eventId: runningEventId, teamId: runningTeamId });
  const capture = lib.captureStartingStats(runningEventId, [m.participantId]);
  for (let i = 0; i < 40; i++) {
    const [q] = await db.select().from(s.hiscoresFetches).where(eq(s.hiscoresFetches.rsnKey, m.key));
    if (q) {
      assert.equal(q.priority, 0);
      break;
    }
    await new Promise((res) => setTimeout(res, 100));
  }
  await forgeAnswers(m.key, 'ok', body(100));
  assert.equal((await capture).captured, 1);
  await pool.query(`DELETE FROM hiscores_fetches WHERE rsn_key LIKE 'queued%'`);
});

test('weekly: a participant added mid-competition gets their starting value now', async () => {
  const [wc] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'skill', metric: 'attack', title: 'SOTW', status: 'active', startDate: hoursFromNow(-5), endDate: hoursFromNow(100) })
    .returning();
  const m = await member('Weekler', { eventId: futureEventId, teamId: null, live: { attack: 1300 } });
  const [wp] = await db
    .insert(s.weeklyParticipants)
    .values({ competitionId: wc.id, clanMemberId: m.membershipId, rsn: 'Weekler', rsnNormalized: 'weekler' })
    .returning();
  const capture = lib.captureWeeklyStartingStats(wc.id, [wp.id]);
  await forgeAnswers(m.key, 'ok', body(1200));
  assert.equal((await capture).captured, 1);
  const [after] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.id, wp.id));
  assert.equal(after.baselineValue, 1300, 'max(hiscores, live) — the running session is absorbed');
  assert.equal(after.currentValue, 1300);
  const snaps = await db.select().from(s.playerSnapshots).where(eq(s.playerSnapshots.weeklyCompetitionId, wc.id));
  assert.ok(snaps.some((x) => x.kind === 'baseline'), 'the competition’s player snapshot is written');
});

test('weekly: a miss stamps lastUpdated, so "couldn\'t read" survives a restart', async () => {
  const [wc] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'skill', metric: 'attack', title: 'SOTW 2', status: 'active', startDate: hoursFromNow(-5), endDate: hoursFromNow(100) })
    .returning();
  const m = await member('Weeklyghost', { eventId: futureEventId, teamId: null });
  const [wp] = await db
    .insert(s.weeklyParticipants)
    .values({ competitionId: wc.id, clanMemberId: m.membershipId, rsn: 'Weeklyghost', rsnNormalized: 'weeklyghost' })
    .returning();
  const capture = lib.captureWeeklyStartingStats(wc.id, [wp.id]);
  await forgeAnswers(m.key, 'unranked', null);
  assert.equal((await capture).failed, 1);
  const [after] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.id, wp.id));
  assert.equal(after.baselineValue, null);
  assert.ok(after.lastUpdated);
  assert.equal(lib.weeklyStartingStatsFor(wc, [after])[after.id]?.state, 'failed');
});
