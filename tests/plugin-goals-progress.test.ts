// The plugin's You tab gets its goals already read (lib/goals goalsWithProgress) — the same reading the
// profile page makes — so the plugin only draws them. This runs it against a real account's rows.
//
// Run: npx tsx --test tests/plugin-goals-progress.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-goals-progress');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let G: typeof import('../src/lib/goals.ts');

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  G = await import('../src/lib/goals.ts');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('goals come back labelled, with the bare fields older plugins read and nothing invented', async () => {
  const [p] = await db.insert(s.players).values({ displayName: 'Goal Getter' }).returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Goal Getter', rsnNormalized: 'goal getter' }).returning();
  const createdAt = new Date().toISOString();
  await db.insert(s.playerGoals).values([
    { accountId: acct.id, kind: 'skill', metric: 'slayer', target: 99, dueOn: '2099-12-01', createdAt },
    { accountId: acct.id, kind: 'clog', metric: 'Barrows Chests', target: 0, createdAt },
  ]);

  const goals = await G.goalsWithProgress(acct.id, 'Goal Getter');
  assert.equal(goals.length, 2);
  const [skill, page] = goals;
  assert.deepEqual([skill.kind, skill.metric, skill.target, skill.dueOn], ['skill', 'slayer', 99, '2099-12-01']);
  assert.equal(skill.label, '99 Slayer');
  assert.equal(skill.current, null, 'no stats yet, so no bar');
  assert.equal(skill.done, false);
  assert.match(skill.due?.text ?? '', /^by 1 Dec 2099/);
  assert.equal(page.label, 'Barrows Chests log');
  assert.equal(page.current, null, 'the log is not synced');
});
