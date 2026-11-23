// The clan fund (lib/clanFund), against a real database: chip-ins arrive through the webhook handler,
// the clan gets its plan only at the goal, cancelling keeps counting until the year ends, a refund
// stops it at once, and a funded clan that falls short keeps the plan for a week then goes to free.
//
// Run: npx tsx --test tests/clan-fund-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-fund');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let fund: typeof import('../src/lib/clanFund.ts');
let gumroad: typeof import('../src/lib/gumroad.ts');

let clanId: number;
let owner: number;
let member: number;
const DAY = 86_400_000;
const told: number[] = [];

const ev = (fields: Record<string, string>) => gumroad.parseWebhook(new URLSearchParams({ product_permalink: 'clan-fund', recurrence: 'yearly', ...fields }).toString());
const clan = async () => (await db.select().from(s.clans).where(eq(s.clans.id, clanId)))[0];

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  fund = await import('../src/lib/clanFund.ts');
  gumroad = await import('../src/lib/gumroad.ts');
  fund.fundDeps.dm = async (userId) => {
    told.push(userId);
    return true;
  };
  clanId = (await db.insert(s.clans).values({ slug: 'fundclan', name: 'Fund Clan', gumroadRef: 'fundref' }).returning())[0].id;
  const [p1] = await db.insert(s.players).values({ displayName: 'Owner' }).returning();
  owner = (await db.insert(s.users).values({ displayName: 'Owner', playerId: p1.id, supporterRef: 'ref-owner' }).returning())[0].id;
  const [p2] = await db.insert(s.players).values({ displayName: 'Member' }).returning();
  member = (await db.insert(s.users).values({ displayName: 'Member', playerId: p2.id, supporterRef: 'ref-member' }).returning())[0].id;
  await db.insert(s.clanStaff).values({ clanId, userId: owner, role: 'owner' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('fund events are the fund product\'s', () => {
  assert.equal(fund.isFundEvent({ productId: null, productPermalink: 'clan-fund' }), true);
  assert.equal(fund.isFundEvent({ productId: null, productPermalink: 'silver' }), false);
});

test('the owner starts a fund for one plan; a chip-in below the goal changes nothing', async () => {
  assert.deepEqual(await fund.setFundPlan(clanId, owner, 'silver'), { ok: true });
  const r = await fund.handleFundEvent(ev({ sale_id: 'a1', subscription_id: 'fa', price: '4000', 'url_params[ref]': 'fundref', 'url_params[payer]': 'ref-member' }));
  assert.equal(r.status, 200);
  const [p] = await db.select().from(s.clanFundPledges).where(eq(s.clanFundPledges.gumroadSubscriptionId, 'fa'));
  assert.deepEqual([p.userId, p.isPayer, p.cents, p.status], [member, false, 4000, 'active']);
  assert.equal((await clan()).plan, 'free');
  // Replayed: applied once.
  const again = await fund.handleFundEvent(ev({ sale_id: 'a1', subscription_id: 'fa', price: '4000', 'url_params[ref]': 'fundref' }));
  assert.equal(again.body.note, 'already applied');
});

test('the payer covering the rest reaches the goal: the clan gets exactly that plan', async () => {
  await fund.handleFundEvent(ev({ sale_id: 'b1', subscription_id: 'fb', price: '2990', 'url_params[ref]': 'fundref', 'url_params[payer]': 'ref-owner', 'url_params[cover]': '1' }));
  const [p] = await db.select().from(s.clanFundPledges).where(eq(s.clanFundPledges.gumroadSubscriptionId, 'fb'));
  assert.equal(p.isPayer, true);
  const c = await clan();
  assert.deepEqual([c.plan, c.fundFunded], ['silver', true]);
  const view = await fund.fundView(c);
  assert.deepEqual([view?.totals.total, view?.totals.funded, view?.totals.members], [6990, true, 1]);
  // Once it pays for the plan, the plan can't change and the fund can't be turned off.
  assert.equal((await fund.setFundPlan(clanId, owner, 'gold')).ok, false);
  assert.equal((await fund.setFundPlan(clanId, owner, null)).ok, false);
});

test('a cancel keeps counting until its year runs out', async () => {
  await fund.handleFundEvent(ev({ subscription_id: 'fa', cancelled: 'true', resource_name: 'cancellation' }));
  const [p] = await db.select().from(s.clanFundPledges).where(eq(s.clanFundPledges.gumroadSubscriptionId, 'fa'));
  assert.equal(p.status, 'cancelling');
  assert.equal((await clan()).plan, 'silver');
});

test('a refund stops counting at once: a week of grace, then free', async () => {
  await fund.handleFundEvent(ev({ sale_id: 'a1', subscription_id: 'fa', refunded: 'true', resource_name: 'refund' }));
  const [p] = await db.select().from(s.clanFundPledges).where(eq(s.clanFundPledges.gumroadSubscriptionId, 'fa'));
  assert.equal(p.status, 'refunded');
  let c = await clan();
  assert.equal(c.plan, 'silver', 'kept through the grace');
  assert.ok(c.fundShortSince);
  assert.ok(told.includes(owner), 'the owner is told it is short');
  const r = await fund.recomputeFund(clanId, Date.now() + 8 * DAY);
  assert.equal(r.step, 'drop');
  c = await clan();
  assert.deepEqual([c.plan, c.fundFunded, c.fundPlan], ['free', false, 'silver']);
});

test('a fund never starts over a membership that pays for the plan', async () => {
  const other = (await db.insert(s.clans).values({ slug: 'subbed', name: 'Subbed', plan: 'silver', gumroadSubscriptionId: 'live-sub' }).returning())[0].id;
  const r = await fund.setFundPlan(other, owner, 'silver');
  assert.equal(r.ok, false);
});
