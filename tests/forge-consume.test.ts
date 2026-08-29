// The Site half of the Forge seam — draining forge_player_events and scoring it.
//
// Forge (the Go data plane) fetches hiscores and appends a line here when a snapshot moves; this app
// evaluates it. The test simulates Forge by INSERTING outbox rows through Drizzle (never raw SQL — the
// harness is dialect-agnostic by construction) and then asserts the consumer scored them the way the
// TS sweep would: weekly value moved, daily history rolled, milestone recorded, rename applied, an
// unranked account parked — and, the property the whole design leans on, that a second drain is a
// no-op rather than a double-count.
//
// Run: npx tsx --test tests/forge-consume.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('forge-consume');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let consume: typeof import('../src/lib/forgeConsume.ts')['consumeForgeEvents'];

// Seeded ids.
let clanId: number;
let snapAccount: number; // scores a weekly + daily + milestone off a snapshot
let renameAccount: number;
let unrankedAccount: number;
let weeklyParticipantId: number;
let eventId: number;

const ISO = (d: Date) => d.toISOString();
const daysFromNow = (n: number) => ISO(new Date(Date.now() + n * 86_400_000));

/** A minimal but valid hiscores snapshot: one skill total + one boss. */
function snapshot(attackXp: number, zulrahKc: number, attackLevel: number) {
  return {
    skills: {
      overall: { rank: 1, level: 100, xp: attackXp },
      attack: { rank: 1, level: attackLevel, xp: attackXp },
    },
    bosses: {
      zulrah: { rank: 1, score: zulrahKc },
    },
  };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ consumeForgeEvents: consume } = await import('../src/lib/forgeConsume.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'forge', name: 'Forge Test' }).returning();
  clanId = clan.id;

  // The snapshot account: a member seat, in an active SOTW and an active bingo event.
  const [p1] = await db.insert(s.players).values({ displayName: 'Snapshotter' }).returning();
  const [a1] = await db
    .insert(s.accounts)
    .values({ playerId: p1.id, rsn: 'Snapshotter', rsnNormalized: 'snapshotter' })
    .returning();
  snapAccount = a1.id;
  const [m1] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: snapAccount, kind: 'member' })
    .returning();

  const [wc] = await db
    .insert(s.weeklyCompetitions)
    .values({
      clanId,
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
      rsn: 'Snapshotter',
      rsnNormalized: 'snapshotter',
      baselineValue: 1000,
      currentValue: 1000,
      lastUpdated: daysFromNow(-1),
    })
    .returning();
  weeklyParticipantId = wp.id;

  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name: 'Bingo', boardSize: 25, startDate: daysFromNow(-1), endDate: daysFromNow(5) })
    .returning();
  eventId = ev.id;
  // On a team, so the account's snapshot touches the event for the per-event completion pass. No stat
  // tiles on this board, so evaluateBingoEvent is a no-op here (completions are covered by forge-bingo-eval).
  const [evTeam] = await db.insert(s.teams).values({ eventId, name: 'Solo', color: '#8888ff' }).returning();
  await db.insert(s.eventParticipants).values({ eventId, clanMemberId: m1.id, name: 'Snapshotter', teamId: evTeam.id });

  // The rename account: RSN 'OldName' about to become 'NewName'.
  const [p2] = await db.insert(s.players).values({ displayName: 'Renamer' }).returning();
  const [a2] = await db
    .insert(s.accounts)
    .values({ playerId: p2.id, rsn: 'OldName', rsnNormalized: 'oldname' })
    .returning();
  renameAccount = a2.id;
  await db.insert(s.clanMemberships).values({ clanId, accountId: renameAccount, kind: 'member' });

  // The unranked account: active until hiscores 404s it.
  const [p3] = await db.insert(s.players).values({ displayName: 'Ranker' }).returning();
  const [a3] = await db
    .insert(s.accounts)
    .values({ playerId: p3.id, rsn: 'Ranker', rsnNormalized: 'ranker' })
    .returning();
  unrankedAccount = a3.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('snapshot.changed scores weekly + daily + milestone, and reports the touched event', async () => {
  // attack 1000 -> 2000 (a 1000xp gain); zulrah 95 -> 105 (crosses the 100-KC milestone).
  await db.insert(s.forgePlayerEvents).values({
    accountId: snapAccount,
    kind: 'snapshot.changed',
    payload: {
      snapshot: snapshot(2000, 105, 10),
      deltas: { skills: { attack: 1000 }, bosses: { zulrah: 10 } },
    },
  });

  const r = await consume({ limit: 100 });
  assert.equal(r.snapshots, 1);
  assert.equal(r.weeklyUpdated, 1, 'the SOTW value moved');
  assert.ok(r.milestones >= 1, 'the 100-KC milestone recorded');
  assert.ok(r.touchedEvents.includes(eventId), 'the active bingo event is reported for the completion pass');
  assert.equal(r.errors, 0);

  // Weekly current climbed to the fetched value (monotonic max).
  const wp = await db
    .select()
    .from(s.weeklyParticipants)
    .where(eq(s.weeklyParticipants.id, weeklyParticipantId))
    .then((x) => x[0]);
  assert.equal(wp.currentValue, 2000);

  // Daily rollup credited exactly the gain — reconstructed from snapshot − deltas.
  const daily = await db
    .select()
    .from(s.memberDailyStats)
    .where(eq(s.memberDailyStats.accountId, snapAccount));
  assert.equal(daily.length, 1);
  assert.equal(daily[0].xpGained, 1000);

  // The milestone landed, correctly attributed.
  const ms = await db
    .select()
    .from(s.memberMilestones)
    .where(and(eq(s.memberMilestones.accountId, snapAccount), eq(s.memberMilestones.kind, 'kc')));
  assert.equal(ms.length, 1);
  assert.equal(ms[0].metric, 'zulrah');
  assert.equal(ms[0].threshold, 100);

  // The event was stamped consumed — the cursor advanced.
  const unconsumed = await db
    .select()
    .from(s.forgePlayerEvents)
    .where(eq(s.forgePlayerEvents.accountId, snapAccount));
  assert.ok(unconsumed.every((e) => e.consumedAt != null), 'every processed event is marked consumed');
});

test('a second drain is a no-op — the design is at-least-once, not double-count', async () => {
  const r = await consume({ limit: 100 });
  assert.equal(r.consumed, 0, 'nothing left unconsumed');

  const wp = await db
    .select()
    .from(s.weeklyParticipants)
    .where(eq(s.weeklyParticipants.id, weeklyParticipantId))
    .then((x) => x[0]);
  assert.equal(wp.currentValue, 2000, 'weekly value did not move again');

  const daily = await db
    .select()
    .from(s.memberDailyStats)
    .where(eq(s.memberDailyStats.accountId, snapAccount));
  assert.equal(daily[0].xpGained, 1000, 'the day was not double-credited');
});

test('rsn.changed renames the account and keeps the alias history', async () => {
  await db.insert(s.forgePlayerEvents).values({
    accountId: renameAccount,
    kind: 'rsn.changed',
    payload: { from: 'OldName', to: 'NewName' },
  });

  const r = await consume({ limit: 100 });
  assert.equal(r.renames, 1);

  const acc = await db.select().from(s.accounts).where(eq(s.accounts.id, renameAccount)).then((x) => x[0]);
  assert.equal(acc.rsn, 'NewName');
  assert.equal(acc.rsnNormalized, 'newname');
  assert.deepEqual(JSON.parse(acc.previousRsns ?? '[]'), ['OldName']);
});

test('account.unranked parks the account for re-probe', async () => {
  await db.insert(s.forgePlayerEvents).values({
    accountId: unrankedAccount,
    kind: 'account.unranked',
    payload: { rsn: 'Ranker' },
  });

  const r = await consume({ limit: 100 });
  assert.equal(r.unranked, 1);

  const acc = await db.select().from(s.accounts).where(eq(s.accounts.id, unrankedAccount)).then((x) => x[0]);
  assert.equal(acc.status, 'unranked');
});

test('an unknown kind is consumed, not left to retry forever', async () => {
  await db.insert(s.forgePlayerEvents).values({
    accountId: snapAccount,
    kind: 'something.forge.added.later',
    payload: {},
  });

  const r = await consume({ limit: 100 });
  assert.equal(r.errors, 0, 'an unhandled kind is logged, not errored');
  assert.equal(r.consumed, 1, 'and it is marked consumed so it does not block the queue');
});
