// Bingo stat-tile COMPLETION through the Forge path: consume snapshot.changed events, which write each
// account's participant snapshots, then evaluate completions per event over the stored snapshots. This
// is the piece that lets the hiscores sweep move to Forge without bingo scoring going dark.
//
// Covers the three cases the sweep's Phase 3 does: an INDIVIDUAL tile credited to its finisher, a TEAM
// tile that sums two members' gains, and idempotence (re-consuming never double-completes). Pre-event
// safety is proven elsewhere (stat-baseline-preevent, completion-gate-start) and inherited here.
//
// Run: npx tsx --test tests/forge-bingo-eval.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('forge-bingo-eval');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let consume: typeof import('../src/lib/forgeConsume.ts')['consumeForgeEvents'];

let eventId: number;
let teamId: number;
let soloTileId: number;
let teamTileId: number;
let acct1: number;
let acct2: number;
let part1: number; // participant id for account 1 (the individual finisher)

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** A valid snapshot: an overall/skill total plus the two bosses the tiles track. */
function snap(bosses: Record<string, number>, overallXp = 1000) {
  return {
    skills: { overall: { rank: 1, level: 100, xp: overallXp }, attack: { rank: 1, level: 10, xp: overallXp } },
    bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { rank: 1, score }])),
  };
}

async function push(accountId: number, snapshot: ReturnType<typeof snap>) {
  await db.insert(s.forgePlayerEvents).values({ accountId, kind: 'snapshot.changed', payload: { snapshot, deltas: {} } });
}

async function completionCount() {
  const rows = await db.select().from(s.completions);
  return rows.length;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ consumeForgeEvents: consume } = await import('../src/lib/forgeConsume.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'bingo', name: 'Bingo Test' }).returning();
  // Started yesterday so the completion gate lets tiles land.
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Bingo', boardSize: 25, startDate: daysFromNow(-1), endDate: daysFromNow(5) })
    .returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#ff0000' }).returning();
  teamId = team.id;

  // An INDIVIDUAL tile (one member reaches it) and a TEAM tile (the team's gains sum).
  const [solo] = await db
    .insert(s.tiles)
    .values({ eventId, position: 0, label: 'Zulrah 10', trackedStat: 'zulrah', statType: 'boss', statGoal: 10, trackingMode: 'individual' })
    .returning();
  soloTileId = solo.id;
  const [tm] = await db
    .insert(s.tiles)
    .values({ eventId, position: 1, label: 'Vorkath 10 (team)', trackedStat: 'vorkath', statType: 'boss', statGoal: 10, trackingMode: 'team' })
    .returning();
  teamTileId = tm.id;

  // Two members on the same team.
  const mk = async (name: string, rsn: string) => {
    const [p] = await db.insert(s.players).values({ displayName: name }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase() }).returning();
    const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: a.id, kind: 'member' }).returning();
    const [part] = await db.insert(s.eventParticipants).values({ eventId, clanMemberId: seat.id, name: rsn, teamId }).returning();
    return { accountId: a.id, partId: part.id };
  };
  ({ accountId: acct1, partId: part1 } = await mk('One', 'MemberOne'));
  ({ accountId: acct2 } = await mk('Two', 'MemberTwo'));
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('first snapshots set baselines and complete nothing', async () => {
  await push(acct1, snap({ zulrah: 100, vorkath: 50 }));
  await push(acct2, snap({ zulrah: 0, vorkath: 50 }));
  const r = await consume({ limit: 100 });
  assert.equal(r.tilesCompleted, 0, 'a gain of zero completes nothing');
  assert.equal(await completionCount(), 0);
});

test('an individual tile completes for the member who reaches it, credited to them', async () => {
  await push(acct1, snap({ zulrah: 115, vorkath: 56 })); // +15 zulrah (>=10), +6 vorkath
  const r = await consume({ limit: 100 });
  assert.equal(r.tilesCompleted, 1, 'the solo zulrah tile');

  const solo = await db
    .select()
    .from(s.completions)
    .where(and(eq(s.completions.tileId, soloTileId), eq(s.completions.teamId, teamId)))
    .then((x) => x[0]);
  assert.ok(solo, 'a completion exists');
  assert.equal(solo.creditPlayerId, part1, 'attributed to the finisher');

  // The team vorkath tile is only at 6 so far — not done.
  const teamDone = await db.select().from(s.completions).where(eq(s.completions.tileId, teamTileId));
  assert.equal(teamDone.length, 0);
});

test('a team tile completes once the members’ gains sum past the goal', async () => {
  await push(acct2, snap({ zulrah: 0, vorkath: 57 })); // acct2 +7 vorkath; team total 6 + 7 = 13 >= 10
  const r = await consume({ limit: 100 });
  assert.equal(r.tilesCompleted, 1, 'the team vorkath tile');

  const teamDone = await db
    .select()
    .from(s.completions)
    .where(and(eq(s.completions.tileId, teamTileId), eq(s.completions.teamId, teamId)))
    .then((x) => x[0]);
  assert.ok(teamDone, 'a team completion exists');
  assert.equal(teamDone.creditPlayerId, null, 'a team total has no single finisher');
});

test('re-consuming the same movement never double-completes', async () => {
  const before = await completionCount();
  // Same values again — a real sweep re-reads the same stored snapshots every tick.
  await push(acct1, snap({ zulrah: 115, vorkath: 56 }));
  await push(acct2, snap({ zulrah: 0, vorkath: 57 }));
  const r = await consume({ limit: 100 });
  assert.equal(r.tilesCompleted, 0, 'both tiles were already done');
  assert.equal(await completionCount(), before, 'no duplicate rows');
});
