// The Supporter lab (/staff/lab/supporter): test tiers for a day, and test drops in the hidden lab
// clan that only staff can open from the plugin.
//
// Run: npx tsx --test tests/supporter-lab.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-lab');
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/labSupporter.ts');
let V: typeof import('../src/lib/pluginUi/views.ts');
let staffId = 0;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/labSupporter.ts');
  V = await import('../src/lib/pluginUi/views.ts');
  const [p] = await db.insert(s.players).values({ displayName: 'Staffer' }).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Staffer', discordId: 'd-staff', pluginToken: 'staff-token', playerId: p.id, platformRole: 'staff' }).returning();
  staffId = u.id;
  const [q] = await db.insert(s.players).values({ displayName: 'Nobody' }).returning();
  await db.insert(s.users).values({ displayName: 'Nobody', discordId: 'd-nobody', pluginToken: 'nobody-token', playerId: q.id });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const as = (token: string) => new Request('http://site/api/plugin/ui', { headers: { Authorization: `Bearer ${token}` } });
const json = (v: unknown) => JSON.stringify(v);

test('a lab tier is yours at once, replaces the last one, and never touches a paid one', async () => {
  const { supporterForUser } = await import('../src/lib/supporter.ts');
  await db.insert(s.supporterSubscriptions).values({ userId: staffId, tier: 'supporter', status: 'active', gumroadSubscriptionId: 'real-sub', startedAt: '2026-01-01T00:00:00Z' });
  await L.setLabTier(staffId, 'patron', 12);
  assert.equal((await supporterForUser(staffId))?.tier.id, 'patron');
  assert.ok(((await supporterForUser(staffId))?.months ?? 0) >= 12, 'tenure follows the months asked for');
  await L.setLabTier(staffId, 'champion');
  await L.setLabTier(staffId, null);
  const rows = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, staffId));
  assert.deepEqual(rows.map((r) => r.gumroadSubscriptionId), ['real-sub'], 'only the paid one is left');
  assert.equal((await supporterForUser(staffId))?.tier.id, 'supporter');
});

test('test drops land in the lab clan from clanmates of every tier, and clear again', async () => {
  assert.equal(await L.seedLabDrops(staffId, 6), 6);
  const state = await L.labSupporterState(staffId);
  assert.equal(state.drops, 6);
  assert.deepEqual(state.dummies.map((d) => d.tier), ['patron', 'champion', 'supporter', null]);
  await L.seedLabDrops(staffId, 2);
  assert.equal((await L.labSupporterState(staffId)).dummies.length, 4, 'the clanmates are made once');
});

test('only staff find and open the lab clan in the plugin, and can GZ its test drops', async () => {
  const found = await V.pluginView(as('staff-token'), 'clans', { q: 'lab' });
  assert.ok(json(found!.ui).includes('anvil-lab'));
  const hidden = await V.pluginView(as('nobody-token'), 'clans', { q: 'lab' });
  assert.ok(!json(hidden!.ui).includes('anvil-lab'), 'nobody else ever sees it');

  const feed = await V.pluginView(as('staff-token'), 'moments', { slug: 'anvil-lab' });
  assert.ok(json(feed!.ui).includes('"act":"react"'), 'staff can react while testing');
  assert.ok(json(feed!.ui).includes('Lab~Patron'));
  assert.ok(json(feed!.ui).includes('"move":true'), 'the Patron clanmate’s name moves');
  const closed = await V.pluginView(as('nobody-token'), 'moments', { slug: 'anvil-lab' });
  assert.ok(json(closed!.ui).includes('isn’t listed'));
});

test('clearing removes every test drop', async () => {
  assert.ok((await L.clearLabDrops()) > 0);
  assert.equal((await L.labSupporterState(staffId)).drops, 0);
});
