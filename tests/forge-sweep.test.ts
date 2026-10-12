// The sweep with Anvil.Forge fetching (lib/statsSweep source 'forge' + lib/forgeFetchQueue).
//
// Forge is simulated by doing to hiscores_fetches exactly what it does: stamp a pending row with
// fetched_at, an outcome and the endpoint's raw JSON body. Asserted: the drain queues who is due
// (competition work ahead of roster filler, never twice), applies a fetched read through the same
// code as the in-app fetch (the weekly value moves, the account is stamped polled), parks a 404'd
// account, and drops a read too old to trust instead of applying it.
//
// Run: npx tsx --test tests/forge-sweep.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('forge-sweep');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let runStatsSweep: typeof import('../src/lib/statsSweep.ts')['runStatsSweep'];

let racerAccount: number;
let fillerAccount: number;
let weeklyParticipantId: number;

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** The official index_lite.json shape, trimmed to what the test reads. */
function body(attackXp: number) {
  return JSON.stringify({
    skills: [
      { id: 0, name: 'Overall', rank: 5, level: 100, xp: attackXp },
      { id: 1, name: 'Attack', rank: 5, level: 20, xp: attackXp },
    ],
    activities: [{ id: 0, name: 'Zulrah', rank: 9, score: 40 }],
  });
}

async function pendingFor(rsnKey: string) {
  return db.select().from(s.hiscoresFetches).where(eq(s.hiscoresFetches.rsnKey, rsnKey));
}

/** Main-table requests only — type probes ride the same queue under other modes. */
async function mainFor(rsnKey: string) {
  return (await pendingFor(rsnKey)).filter((x) => x.mode === 'main');
}

/** What Forge does with a claimed row. */
async function forgeFetched(rsnKey: string, outcome: 'ok' | 'unranked', raw: string | null, fetchedAt = new Date()) {
  await pool.query(
    `UPDATE hiscores_fetches SET fetched_at = $2, outcome = $3, body = $4, claimed_at = $2
     WHERE rsn_key = $1 AND mode = 'main' AND fetched_at IS NULL`,
    [rsnKey, fetchedAt, outcome, raw],
  );
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ runStatsSweep } = await import('../src/lib/statsSweep.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge Test' }).returning();

  // The racer: a member in an active SOTW, so competition work.
  const [p1] = await db.insert(s.players).values({ displayName: 'Racer' }).returning();
  const [a1] = await db.insert(s.accounts).values({ playerId: p1.id, rsn: 'Racer', rsnNormalized: 'racer' }).returning();
  racerAccount = a1.id;
  const [m1] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: racerAccount, kind: 'member' }).returning();
  const [wc] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId: clan.id,
      type: 'skill',
      metric: 'attack',
      title: 'Attack SOTW',
      status: 'active',
      startDate: daysFromNow(-2),
      endDate: daysFromNow(5),
    })
    .returning();
  const [wp] = await db
    .insert(s.weeklyParticipants)
    .values({
      competitionId: wc.id,
      clanMemberId: m1.id,
      rsn: 'Racer',
      rsnNormalized: 'racer',
      baselineValue: 1000,
      currentValue: 1000,
      lastUpdated: daysFromNow(-1),
    })
    .returning();
  weeklyParticipantId = wp.id;

  // The filler: a member in nothing, so roster filler.
  const [p2] = await db.insert(s.players).values({ displayName: 'Idler' }).returning();
  const [a2] = await db.insert(s.accounts).values({ playerId: p2.id, rsn: 'Idler', rsnNormalized: 'idler' }).returning();
  fillerAccount = a2.id;
  await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: fillerAccount, kind: 'member' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the first drain queues who is due — competition work ahead of filler — and fetches nothing', async () => {
  const r = await runStatsSweep('forge');
  assert.equal(r.forge?.ready, 0);
  assert.equal(r.forge?.queued, 2);

  const [racer] = await pendingFor('racer');
  const [idler] = await pendingFor('idler');
  assert.equal(racer.priority, 0, 'a competition is waiting on the racer');
  assert.equal(idler.priority, 1, 'the idler is roster filler');
  assert.equal(racer.accountId, racerAccount);
  assert.equal(racer.mode, 'main');
  assert.equal(racer.fetchedAt, null);
});

test('a second drain before Forge has fetched queues nothing new', async () => {
  const r = await runStatsSweep('forge');
  assert.equal(r.forge?.queued, 0);
  assert.equal(r.forge?.pending, 2);
  assert.equal((await pendingFor('racer')).length, 1, 'still exactly one request');
});

test('a fetched read is applied like an in-app fetch; a 404 parks the account', async () => {
  await forgeFetched('racer', 'ok', body(2500));
  await forgeFetched('idler', 'unranked', null);

  const r = await runStatsSweep('forge');
  assert.equal(r.forge?.ready, 2);
  assert.equal(r.forge?.applied, 2);
  assert.equal(r.forge?.stale, 0);

  const [wp] = await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.id, weeklyParticipantId));
  assert.equal(wp.currentValue, 2500, 'the SOTW value moved to the fetched XP');

  const [racer] = await db.select().from(s.accounts).where(eq(s.accounts.id, racerAccount));
  assert.equal(Number(racer.statsOverallXp), 2500);
  assert.ok(racer.statsPolledAt, 'stamped as polled, so the ladder backs off');

  const [idler] = await db.select().from(s.accounts).where(eq(s.accounts.id, fillerAccount));
  assert.equal(idler.status, 'unranked');

  const rows = await mainFor('racer');
  assert.ok(rows.every((x) => x.consumedAt != null), 'the result is marked consumed');
  assert.equal(rows.length, 1, 'and the racer, just polled, was not queued again');
});

test('a read older than the trust window is dropped, not applied', async () => {
  // Make the racer due again, queue them, then answer with an OLD read of lower XP — applied, it would
  // look like a stranger took the name and park the account.
  await db.update(s.accounts).set({ statsNextDueAt: null, statsPolledAt: null }).where(eq(s.accounts.id, racerAccount));
  await runStatsSweep('forge');
  await forgeFetched('racer', 'ok', body(100), new Date(Date.now() - 2 * 60 * 60_000));

  const r = await runStatsSweep('forge');
  assert.equal(r.forge?.stale, 1);
  assert.equal(r.forge?.applied, 0);

  const [racer] = await db.select().from(s.accounts).where(eq(s.accounts.id, racerAccount));
  assert.equal(racer.status, 'active', 'not mistaken for a name takeover');
  assert.equal(Number(racer.statsOverallXp), 2500, 'the old read changed nothing');
  const waiting = (await mainFor('racer')).filter((x) => x.fetchedAt == null);
  assert.equal(waiting.length, 1, 'and the racer is queued for a fresh read');
});

test('type probe: walks ironman → ultimate → hardcore at the lowest priority and settles the mode', async () => {
  // The racer got a main-table reading (2,500 xp) and has no mode, so the drain that applied it also
  // started a probe — exactly one, however many drains have run since.
  let r = await runStatsSweep('forge');
  const ironmanSteps = (await pendingFor('racer')).filter((x) => x.mode === 'ironman');
  assert.equal(ironmanSteps.length, 1);
  let [probe] = ironmanSteps;
  assert.equal(probe.priority, 2, 'probes only ever use budget the sweep left idle');
  assert.equal(probe.accountId, racerAccount);

  // On the ironman table and keeping up with the main table → try ultimate next.
  await pool.query(
    `UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'ok', body = $1 WHERE id = $2`,
    [body(2500), probe.id],
  );
  r = await runStatsSweep('forge');
  assert.equal(r.forge?.probes.started, 0, 'no second probe while one is in flight');
  [probe] = (await pendingFor('racer')).filter((x) => x.mode === 'ultimate' && x.fetchedAt == null);
  assert.ok(probe, 'ultimate queued');

  // Not ultimate → hardcore; not hardcore → a plain ironman.
  await pool.query(`UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'unranked' WHERE id = $1`, [probe.id]);
  await runStatsSweep('forge');
  [probe] = (await pendingFor('racer')).filter((x) => x.mode === 'hardcore' && x.fetchedAt == null);
  assert.ok(probe, 'hardcore queued');
  await pool.query(`UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'unranked' WHERE id = $1`, [probe.id]);
  r = await runStatsSweep('forge');
  assert.deepEqual(r.forge?.probes, { started: 0, settled: 1, typed: 1 });

  const [acc] = await db.select().from(s.accounts).where(eq(s.accounts.id, racerAccount));
  assert.equal(acc.accountType, 'ironman');
  assert.ok(acc.accountTypeProbedAt);
  assert.ok(acc.accountTypeAt);
});

test("type probe: never overwrites a mode the plugin reported while it ran", async () => {
  await db
    .update(s.accounts)
    .set({ accountType: null, accountTypeAt: null, accountTypeProbedAt: null })
    .where(eq(s.accounts.id, racerAccount));
  await runStatsSweep('forge');
  const [probe] = (await pendingFor('racer')).filter((x) => x.mode === 'ironman' && x.fetchedAt == null);
  // The plugin reports Group Ironman mid-probe; the hiscores then say "not on the ironman table".
  await db.update(s.accounts).set({ accountType: 'group' }).where(eq(s.accounts.id, racerAccount));
  await pool.query(`UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'ok', body = $1 WHERE id = $2`, [
    body(1000),
    probe.id,
  ]);
  await runStatsSweep('forge');
  const [acc] = await db.select().from(s.accounts).where(eq(s.accounts.id, racerAccount));
  assert.equal(acc.accountType, 'group', 'a de-ironed reading must not replace the plugin’s report');
  assert.ok(acc.accountTypeProbedAt);
});

test('re-check: a week-old hardcore whose hardcore entry froze is re-checked down to ironman', async () => {
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  await db
    .update(s.accounts)
    .set({ accountType: 'hardcore', accountTypeAt: old, accountTypeProbedAt: old })
    .where(eq(s.accounts.id, racerAccount));
  let r = await runStatsSweep('forge');
  assert.ok((r.forge?.probes.started ?? 0) >= 1);
  let [probe] = (await pendingFor('racer')).filter((x) => x.mode === 'hardcore' && x.fetchedAt == null);
  assert.ok(probe, 'the re-check starts at the held mode’s own table');

  // The hardcore entry is frozen below the main table (a death); the ironman entry keeps up.
  await pool.query(`UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'ok', body = $1 WHERE id = $2`, [body(1000), probe.id]);
  await runStatsSweep('forge');
  [probe] = (await pendingFor('racer')).filter((x) => x.mode === 'ironman' && x.fetchedAt == null);
  assert.ok(probe, 'falls back to the ironman table');
  await pool.query(`UPDATE hiscores_fetches SET fetched_at = now(), outcome = 'ok', body = $1 WHERE id = $2`, [body(2500), probe.id]);
  r = await runStatsSweep('forge');

  const [acc] = await db.select().from(s.accounts).where(eq(s.accounts.id, racerAccount));
  assert.equal(acc.accountType, 'ironman');
  assert.ok(acc.accountTypeProbedAt! > old, 'stamped, so it waits a week before the next re-check');
});
