// Changing what a competition counts before it starts (lib/weeklyRetarget), against a real database.
//
// Run: npx tsx --test tests/weekly-retarget-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('weekly-retarget-db');
const HOUR = 3_600_000;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let retarget: typeof import('../src/lib/weeklyRetarget.ts')['retargetCompetition'];
let clanId: number;

async function comp(over: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(s.weeklyCompetitions)
    .values({ clanId, type: 'skill', metric: 'mining', title: 'SOTW: Mining', startDate: new Date(Date.now() + 48 * HOUR).toISOString(), endDate: new Date(Date.now() + 200 * HOUR).toISOString(), status: 'upcoming', ...over })
    .returning();
  await db.insert(s.weeklyParticipants).values({ competitionId: row.id, rsn: 'Alpha', rsnNormalized: 'alpha', baselineValue: 5_000, currentValue: 5_000 });
  return row;
}
const entrant = async (id: number) => (await db.select().from(s.weeklyParticipants).where(eq(s.weeklyParticipants.competitionId, id)))[0];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ retargetCompetition: retarget } = await import('../src/lib/weeklyRetarget.ts'));
  const [clan] = await db.insert(s.clans).values({ slug: 'retarget', name: 'Retarget' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('before the start: the target changes, an unwritten title follows, and starting values are cleared', async () => {
  const c = await comp();
  const r = await retarget(c, { type: 'boss', metric: 'zulrah,vorkath' }, { userId: 0 });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.competition.type, 'boss');
  assert.equal(r.competition.metric, 'zulrah,vorkath');
  assert.notEqual(r.competition.title, 'SOTW: Mining');
  const e = await entrant(c.id);
  assert.equal(e.baselineValue, null);
  assert.equal(e.currentValue, null);
  const log = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'competition_target_changed'));
  assert.equal(log.length, 1);
});

test('a title somebody wrote stays, and the same target changes nothing', async () => {
  const c = await comp({ title: 'Rock week' });
  const r = await retarget(c, { type: 'skill', metric: 'fishing' }, { userId: 0 });
  assert.ok(r.ok && r.competition.title === 'Rock week' && r.competition.metric === 'fishing');
  const d = await comp();
  const same = await retarget(d, { type: 'skill', metric: 'mining' }, { userId: 0 });
  assert.ok(same.ok);
  assert.equal((await entrant(d.id)).baselineValue, 5_000, 'nothing was cleared');
});

test('refused once it has started, for a made-up metric, and for turning a weekly into a hunt', async () => {
  const running = await comp({ status: 'active', startDate: new Date(Date.now() - HOUR).toISOString() });
  const a = await retarget(running, { type: 'boss', metric: 'zulrah' }, { userId: 0 });
  assert.ok(!a.ok && /has started/.test(a.error));
  assert.equal((await entrant(running.id)).baselineValue, 5_000);

  const c = await comp();
  assert.equal((await retarget(c, { type: 'boss', metric: 'not-a-boss' }, { userId: 0 })).ok, false);
  assert.equal((await retarget(c, { type: 'efficiency', metric: 'mining' }, { userId: 0 })).ok, false);
  assert.equal((await retarget(c, { type: 'hunt', metric: 'x' }, { userId: 0 })).ok, false);
  const [still] = await db.select().from(s.weeklyCompetitions).where(eq(s.weeklyCompetitions.id, c.id));
  assert.equal(still.metric, 'mining');
});

test('an item hunt can hunt something else before it starts', async () => {
  const hunt = { v: 1, target: 'items', items: [{ id: 12922, name: 'Tanzanite fang', sources: ['Zulrah'], count: 'drops' }], petGroup: null, rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: 'zulrah', xpSkill: null };
  const c = await comp({ type: 'hunt', metric: 'Tanzanite fang from Zulrah', title: 'Item hunt: Tanzanite fang', hunt: JSON.stringify(hunt) });
  const r = await retarget(c, { hunt: { target: 'items', items: [{ id: 12927, name: 'Serpentine visage', sources: ['Zulrah'], anySource: false, count: 'drops' }], petGroup: 'all', rule: 'most', ends: { kind: 'date' }, confirm: 'staff', killsOf: null, xpSkill: null } }, { userId: 0 });
  assert.ok(r.ok, r.ok ? '' : r.error);
  if (!r.ok) return;
  assert.match(r.competition.metric, /Serpentine visage/);
  assert.equal(r.competition.title, 'Item hunt: Serpentine visage');
  assert.equal(JSON.parse(r.competition.hunt ?? '{}').rule, 'most');
  assert.equal((await retarget(c, { hunt: { target: 'items', items: [] } }, { userId: 0 })).ok, false);
});
