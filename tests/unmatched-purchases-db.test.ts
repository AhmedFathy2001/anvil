// The unmatched Gumroad purchases inbox against a real database: the webhook keeps what it drops
// (and answers exactly as before), later notifications update the open row, and staff attaching one
// applies it the way a matched sale would — after which renewals find the space by subscription id.
//
// Run: npx tsx --test tests/unmatched-purchases-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('unmatched-purchases');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  const { pool: p } = await loadDb();
  pool = p;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
  process.env.GUMROAD_PRODUCT_SILVER = 'prod-silver';
  process.env.GUMROAD_PRODUCT_CREATOR_SILVER = 'prod-creator-silver';
  delete process.env.GUMROAD_ACCESS_TOKEN; // no Gumroad to ask: checks answer 'unverified'
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
      body: new URLSearchParams({ seller_id: 'seller-123', ...fields }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
}

async function rowsForSale(saleId: string) {
  const { db, schema: s } = await loadDb();
  return db.select().from(s.unmatchedPurchases).where(eq(s.unmatchedPurchases.gumroadSaleId, saleId));
}

let n = 0;
async function makeStaff() {
  const { db, schema: s } = await loadDb();
  n += 1;
  const [u] = await db.insert(s.users).values({ displayName: `Staff ${n}`, discordId: `staff-${n}` }).returning();
  return u;
}

test('a plan sale with no matching ref is kept once, and the webhook answers as before', async () => {
  const fields = { sale_id: 'nr-1', subscription_id: 'nr-sub', product_id: 'prod-silver', 'variants[Tier]': 'Silver', email: 'x@example.com', 'url_params[ref]': 'nobody' };
  const res = await post(fields);
  assert.deepEqual(await res.json(), { received: true, note: 'no matching clan' });
  await post(fields); // Gumroad retrying
  const rows = await rowsForSale('nr-1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'plan');
  assert.equal(rows[0].reason, 'no-ref');
  assert.equal(rows[0].planId, 'silver');
  assert.equal(rows[0].ref, 'nobody');
  assert.equal(rows[0].buyerEmail, 'x@example.com');
  assert.equal(rows[0].status, 'open');

  // A later cancel of the same membership moves the open row, never adds one.
  const cancel = await post({ subscription_id: 'nr-sub', cancelled: 'true', product_id: 'prod-silver' });
  assert.deepEqual(await cancel.json(), { received: true, note: 'no matching clan' });
  const after = await rowsForSale('nr-1');
  assert.equal(after.length, 1);
  assert.equal(after[0].gumroadState, 'cancelled');
});

test('a creator product through a clan checkout is ignored by the clan and kept with that clan', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'cart-clan', name: 'Cart clan', gumroadRef: 'cart-ref' }).returning();
  const res = await post({ sale_id: 'cc-1', subscription_id: 'cc-sub', product_id: 'prod-creator-silver', 'url_params[ref]': 'cart-ref', product_name: 'Anvil Creator Silver' });
  assert.deepEqual(await res.json(), { received: true, note: 'product is for another kind of space' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'free', 'the clan is untouched');
  const [row] = await rowsForSale('cc-1');
  assert.equal(row.kind, 'creator');
  assert.equal(row.reason, 'cross-catalogue');
  assert.equal(row.refClanId, clan.id);
  assert.equal(row.planId, 'creator_silver');
});

test('attaching checks the kind, applies the sale, and renewals then find the space', async () => {
  const { db, schema: s } = await loadDb();
  const { attachToSpace } = await import('../src/lib/unmatchedPurchaseActions.ts');
  const staff = await makeStaff();
  const [row] = await rowsForSale('cc-1');
  const clan = await db.query.clans.findFirst({ where: eq(s.clans.slug, 'cart-clan') });
  const [space] = await db.insert(s.clans).values({ slug: 'cart-creator', name: 'Cart creator', kind: 'creator', plan: 'creator_free' }).returning();

  const wrong = await attachToSpace({ id: row.id, clanId: clan!.id, confirmReplace: false, note: null, actorUserId: staff.id, actorRole: 'root' });
  assert.equal(wrong.ok, false);

  const ok = await attachToSpace({ id: row.id, clanId: space.id, confirmReplace: false, note: 'same cart as their clan Silver', actorUserId: staff.id, actorRole: 'root' });
  assert.deepEqual(ok, { ok: true, plan: 'creator_silver', note: null });
  const got = await db.query.clans.findFirst({ where: eq(s.clans.id, space.id) });
  assert.equal(got?.plan, 'creator_silver');
  assert.equal(got?.gumroadSubscriptionId, 'cc-sub');
  assert.equal(got?.gumroadSaleId, 'cc-1');
  const [resolved] = await rowsForSale('cc-1');
  assert.equal(resolved.status, 'attached');
  assert.equal(resolved.attachedClanId, space.id);
  assert.equal(resolved.resolvedByUserId, staff.id);
  const audit = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, space.id), eq(s.clanAuditLog.eventType, 'platform_purchase_attached')));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorUserId, staff.id);

  const again = await attachToSpace({ id: row.id, clanId: space.id, confirmReplace: false, note: null, actorUserId: staff.id, actorRole: 'root' });
  assert.equal(again.ok, false, 'a resolved row cannot be attached twice');

  // The next renewal comes with the (clan's) ref, but is matched by the subscription the space now holds.
  const renew = await post({ sale_id: 'cc-2', subscription_id: 'cc-sub', product_id: 'prod-creator-silver', is_recurring_charge: 'true', 'url_params[ref]': 'cart-ref' });
  assert.deepEqual(await renew.json(), { received: true });
  const renewed = await db.query.clans.findFirst({ where: eq(s.clans.id, space.id) });
  assert.equal(renewed?.gumroadSaleId, 'cc-2');
  assert.equal((await rowsForSale('cc-2')).length, 0, 'a matched renewal is not an unmatched purchase');
});

test('a space already paying is only replaced when staff confirm', async () => {
  const { db, schema: s } = await loadDb();
  const { attachToSpace } = await import('../src/lib/unmatchedPurchaseActions.ts');
  const staff = await makeStaff();
  await post({ sale_id: 'rp-1', subscription_id: 'rp-sub', product_id: 'prod-silver', 'variants[Tier]': 'Silver' });
  const [row] = await rowsForSale('rp-1');
  const [paying] = await db.insert(s.clans).values({ slug: 'paying', name: 'Paying', plan: 'gold', gumroadSubscriptionId: 'old-sub' }).returning();
  const asked = await attachToSpace({ id: row.id, clanId: paying.id, confirmReplace: false, note: null, actorUserId: staff.id, actorRole: 'root' });
  assert.equal(asked.ok, false);
  assert.equal(!asked.ok && asked.needsConfirm, true);
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, paying.id) }))?.plan, 'gold', 'nothing changed yet');
  const done = await attachToSpace({ id: row.id, clanId: paying.id, confirmReplace: true, note: null, actorUserId: staff.id, actorRole: 'root' });
  assert.equal(done.ok, true);
  const got = await db.query.clans.findFirst({ where: eq(s.clans.id, paying.id) });
  assert.equal(got?.plan, 'silver');
  assert.equal(got?.gumroadSubscriptionId, 'rp-sub');
});

test('a Supporter sale with no buyer is kept, attached to a login, or dismissed with a reason', async () => {
  const { db, schema: s } = await loadDb();
  const { attachToUser, dismissPurchase } = await import('../src/lib/unmatchedPurchaseActions.ts');
  const staff = await makeStaff();
  const res = await post({ sale_id: 'sp-1', subscription_id: 'sp-sub', product_id: 'prod-supporter', 'variants[Tier]': 'Champion', recurrence: 'monthly' });
  assert.deepEqual(await res.json(), { received: true, note: 'no matching user' });
  const [row] = await rowsForSale('sp-1');
  assert.equal(row.kind, 'supporter');
  assert.equal(row.reason, 'no-buyer');

  const [buyer] = await db.insert(s.users).values({ displayName: 'Buyer', discordId: 'buyer-1' }).returning();
  const ok = await attachToUser({ id: row.id, userId: buyer.id, note: null, actorUserId: staff.id, actorRole: 'root' });
  assert.equal(ok.ok, true);
  const subs = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, buyer.id));
  assert.equal(subs.length, 1);
  assert.equal(subs[0].tier, 'champion');
  assert.equal(subs[0].gumroadSubscriptionId, 'sp-sub');

  // Its cancel now finds the membership, not the inbox.
  await post({ subscription_id: 'sp-sub', cancelled: 'true', product_id: 'prod-supporter' });
  const [cancelled] = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, buyer.id));
  assert.equal(cancelled.status, 'cancelling');

  await post({ sale_id: 'sp-2', subscription_id: 'sp-sub-2', product_id: 'prod-supporter', 'variants[Tier]': 'Supporter' });
  const [other] = await rowsForSale('sp-2');
  const noReason = await dismissPurchase({ id: other.id, note: '  ', actorUserId: staff.id, actorRole: 'root' });
  assert.equal(noReason.ok, false);
  const dismissed = await dismissPurchase({ id: other.id, note: 'refunded in Gumroad — duplicate cart item', actorUserId: staff.id, actorRole: 'root' });
  assert.equal(dismissed.ok, true);
  const [closed] = await rowsForSale('sp-2');
  assert.equal(closed.status, 'dismissed');
  assert.equal(closed.resolutionNote, 'refunded in Gumroad — duplicate cart item');
  const log = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'platform_purchase_dismissed'));
  assert.equal(log.length, 1);
  assert.ok(!String(log[0].newValue).includes('@'), 'the buyer email is never logged');
});
