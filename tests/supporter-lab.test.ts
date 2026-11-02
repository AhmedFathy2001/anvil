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

test('a lab grant ends on its own when its day is up', async () => {
  const { supporterForUser } = await import('../src/lib/supporter.ts');
  const [p] = await db.insert(s.players).values({ displayName: 'Expiry' }).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Expiry', discordId: 'd-expiry', playerId: p.id }).returning();
  await L.setLabTier(u.id, 'patron');
  assert.equal((await supporterForUser(u.id))?.tier.id, 'patron');
  await db.update(s.supporterSubscriptions).set({ currentPeriodEnd: '2020-01-01T00:00:00Z' }).where(eq(s.supporterSubscriptions.userId, u.id));
  assert.equal(await supporterForUser(u.id), null, 'past its end, it grants nothing');
});

test('a real character sharing a test name is never adopted or given a tier', async () => {
  const { supporterForUser } = await import('../src/lib/supporter.ts');
  await L.clearLabDrops();
  // Wipe the test clanmates, then let a real person hold one of their names first.
  await db.delete(s.users).where(eq(s.users.discordId, 'lab-dummy-lab~patron'));
  await db.delete(s.accounts).where(eq(s.accounts.rsnNormalized, 'lab~patron'));
  const [p] = await db.insert(s.players).values({ displayName: 'Squatter' }).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Squatter', discordId: 'd-squat', playerId: p.id }).returning();
  await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Lab~Patron', rsnNormalized: 'lab~patron' });
  await L.seedLabDrops(staffId, 4);
  assert.equal(await supporterForUser(u.id), null, 'no free tier');
  const state = await L.labSupporterState(staffId);
  assert.ok(!state.dummies.some((d) => d.rsn === 'Lab~Patron'), 'their character is not a test clanmate');
});

test('the lab is not a lead: the daily digest never sees the lab clan', async () => {
  delete process.env.CRON_SECRET;
  const { GET } = await import('../src/app/api/cron/leads-digest/route.ts');
  const res = await GET(new Request('http://site/api/cron/leads-digest', { headers: { 'x-vercel-cron': '1' } }));
  const body = await res.json();
  assert.equal(body.clans, 0, 'the lab clan exists but is not counted');
});

test('test drops older than a week are swept, newer ones stay', async () => {
  await L.seedLabDrops(staffId, 2);
  const old = await db.select({ id: s.moments.id }).from(s.moments).limit(1);
  await db.update(s.moments).set({ occurredAt: '2020-01-01T00:00:00Z' }).where(eq(s.moments.id, old[0].id));
  const before = (await L.labSupporterState(staffId)).drops;
  assert.equal(await L.sweepLabTestDrops(), 1);
  assert.equal((await L.labSupporterState(staffId)).drops, before - 1);
});

test('clearing removes every test drop', async () => {
  assert.ok((await L.clearLabDrops()) > 0);
  assert.equal((await L.labSupporterState(staffId)).drops, 0);
});
