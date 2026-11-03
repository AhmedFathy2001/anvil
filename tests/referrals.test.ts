// Referrals through the Gumroad webhook (lib/referrals): a purchase made with somebody's invite code
// holds their reward, it lands two weeks after the first real charge one tier above what they pay,
// rewards stack rather than overlap, nobody refers themselves, and a refund takes it back.
//
// Run: npx tsx --test tests/referrals.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { cappedReward, grantWindow, rewardTier, addMonths } from '../src/lib/referralRules.ts';

const DB = useTestDatabase('referrals');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const DAY = 86_400_000;

before(async () => {
  await resetDatabase(DB);
  const { pool: p } = await loadDb();
  pool = p;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
  delete process.env.GUMROAD_ACCESS_TOKEN;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function post(fields: Record<string, string>): Promise<Response> {
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/webhooks/gumroad/route.ts');
  return POST(
    new NextRequest('https://anvilosrs.com/api/webhooks/gumroad?key=test-webhook-secret', {
      method: 'POST',
      body: new URLSearchParams({ seller_id: 'seller-123', product_id: 'prod-supporter', ...fields }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
}

let n = 0;
async function makeUser(ref: string, code: string | null = null) {
  const { db, schema: s } = await loadDb();
  n += 1;
  const [u] = await db.insert(s.users).values({ displayName: `U${n}`, discordId: `d-${n}`, supporterRef: ref, referralCode: code }).returning();
  return u;
}

async function referralRows(referrer: number) {
  const { db, schema: s } = await loadDb();
  return db.select().from(s.referrals).where(eq(s.referrals.referrerUserId, referrer));
}

async function state(userId: number, now = Date.now()) {
  const { db, schema: s } = await loadDb();
  const { supporterState } = await import('../src/lib/supporterTiers.ts');
  return supporterState(await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, userId)), now);
}

test('pure: reward tier steps up, windows stack', () => {
  assert.equal(rewardTier(null), 'supporter');
  assert.equal(rewardTier('supporter'), 'champion');
  assert.equal(rewardTier('patron'), 'patron');
  assert.equal(cappedReward('champion', 'supporter'), 'supporter', 'never above what the friend bought');
  assert.equal(cappedReward('supporter', 'patron'), 'champion');
  const now = Date.UTC(2026, 0, 31);
  const first = grantWindow(now, [], 1);
  const second = grantWindow(now, [first.end], 1);
  assert.equal(second.start, first.end);
  assert.equal(second.end, addMonths(first.end, 1));
});

test('a purchase through an invite is held, then granted as Supporter time', async () => {
  const referrer = await makeUser('ref-r1', 'invite01');
  const buyer = await makeUser('ref-b1');
  const res = await post({ sale_id: 's1', subscription_id: 'sub-1', 'url_params[ref]': 'ref-b1', 'url_params[via]': 'invite01', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  assert.equal(res.status, 200);
  const [held] = await referralRows(referrer.id);
  assert.equal(held.status, 'held');
  assert.equal(held.referredUserId, buyer.id);
  assert.equal(held.rewardMonths, 1);

  const { grantDueReferrals } = await import('../src/lib/referrals.ts');
  assert.equal(await grantDueReferrals(Date.now()), 0, 'nothing before the hold ends');
  const later = Date.now() + 15 * DAY;
  assert.equal(await grantDueReferrals(later), 1);
  const s = await state(referrer.id, later);
  assert.equal(s?.tier.id, 'supporter');
  assert.equal(s?.earned, true);
});

test('nobody refers themselves, and a yearly purchase earns three months a tier up', async () => {
  const self = await makeUser('ref-self', 'selfself');
  await post({ sale_id: 's2', subscription_id: 'sub-2', 'url_params[ref]': 'ref-self', 'url_params[via]': 'selfself', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  assert.equal((await referralRows(self.id)).length, 0);

  // The referrer already pays for Supporter, so the reward is Champion.
  const referrer = await makeUser('ref-r3', 'invite03');
  await post({ sale_id: 's3a', subscription_id: 'sub-3a', 'url_params[ref]': 'ref-r3', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  await makeUser('ref-b3');
  await post({ sale_id: 's3', subscription_id: 'sub-3', 'url_params[ref]': 'ref-b3', 'url_params[via]': 'invite03', 'variants[Tier]': 'Patron', recurrence: 'yearly' });
  const { grantDueReferrals } = await import('../src/lib/referrals.ts');
  const later = Date.now() + 15 * DAY;
  await grantDueReferrals(later);
  const [r] = await referralRows(referrer.id);
  assert.equal(r.status, 'granted');
  assert.equal(r.rewardMonths, 3);
  assert.equal((await state(referrer.id, later))?.tier.id, 'champion');
});

test('a refund takes the reward back, held or granted; a trial that never pays earns nothing', async () => {
  const referrer = await makeUser('ref-r4', 'invite04');
  await makeUser('ref-b4');
  await post({ sale_id: 's4', subscription_id: 'sub-4', 'url_params[ref]': 'ref-b4', 'url_params[via]': 'invite04', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  const { grantDueReferrals } = await import('../src/lib/referrals.ts');
  const later = Date.now() + 15 * DAY;
  await grantDueReferrals(later);
  assert.equal((await state(referrer.id, later))?.tier.id, 'supporter');
  await post({ sale_id: 's4', subscription_id: 'sub-4', refunded: 'true', resource_name: 'refund' });
  const [r] = await referralRows(referrer.id);
  assert.equal(r.status, 'revoked');
  assert.equal(await state(referrer.id, later), null, 'the granted time is gone');

  // Trial: held until two weeks after the trial ends; cancelled before paying -> revoked.
  const r5 = await makeUser('ref-r5', 'invite05');
  await makeUser('ref-b5');
  const trialEnd = new Date(Date.now() + 7 * DAY).toISOString();
  await post({ sale_id: 's5', subscription_id: 'sub-5', 'url_params[ref]': 'ref-b5', 'url_params[via]': 'invite05', 'variants[Tier]': 'Supporter', recurrence: 'monthly', free_trial_ends_at: trialEnd });
  const [held] = await referralRows(r5.id);
  assert.ok(Date.parse(held.grantAfter) >= Date.parse(trialEnd) + 14 * DAY - 1000, 'held past the trial');
  await post({ subscription_id: 'sub-5', resource_name: 'subscription_ended' });
  assert.equal((await referralRows(r5.id))[0].status, 'revoked');
});

test('the third friend also earns the milestone, once', async () => {
  const referrer = await makeUser('ref-r6', 'invite06');
  for (const i of [1, 2, 3]) {
    await makeUser(`ref-b6-${i}`);
    await post({ sale_id: `s6-${i}`, subscription_id: `sub-6-${i}`, 'url_params[ref]': `ref-b6-${i}`, 'url_params[via]': 'invite06', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  }
  const { grantDueReferrals, referralSummary } = await import('../src/lib/referrals.ts');
  const later = Date.now() + 15 * DAY;
  await grantDueReferrals(later);
  await grantDueReferrals(later);
  const { db, schema: s } = await loadDb();
  const rows = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, referrer.id));
  assert.equal(rows.filter((r) => r.recurrence === 'referral-milestone-3').length, 1, 'one milestone grant');
  assert.equal(rows.find((r) => r.recurrence === 'referral-milestone-3')?.tier, 'champion');
  const sum = await referralSummary(referrer.id);
  assert.equal(sum.granted, 3);
  assert.deepEqual(sum.next, { from: 3, to: 10, label: '3 months of Champion' });
});
