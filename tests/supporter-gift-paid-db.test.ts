// Paid Supporter gifts through the webhook (lib/supporterGiftCheckout): bought by one person, landed
// on another, once per sale; a refund takes it back; the giver's months add up.
//
// Run: npx tsx --test tests/supporter-gift-paid-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-gift-paid');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
  process.env.GUMROAD_PRODUCT_SUPPORTER_GIFT = 'prod-gift';
  process.env.GUMROAD_URL_SUPPORTER_GIFT = 'https://anvilosrs.gumroad.com/l/supporter-gift';
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ seller_id: 'seller-123', product_id: 'prod-gift', ...fields }).toString(),
    }),
  );
}

let n = 0;
async function person(name: string, shared = true) {
  const { db, schema: s } = await loadDb();
  n++;
  const [player] = await db.insert(s.players).values({}).returning();
  const [u] = await db.insert(s.users).values({ displayName: `P ${n}`, discordId: `gift-${n}`, playerId: player.id }).returning();
  await db.insert(s.accounts).values({ playerId: player.id, rsn: name, rsnNormalized: name.toLowerCase(), shared, verifiedAt: new Date().toISOString() });
  return u;
}

test('a gift lands on the recipient once, counts for the giver, and a refund takes it back', async () => {
  const buyer = await person('Giver Gal');
  const friend = await person('Lucky Lad');
  const { giftRecipient, createGiftIntent, giftedMonthsFor } = await import('../src/lib/supporterGiftCheckout.ts');
  const who = await giftRecipient('lucky lad', buyer.id);
  assert.ok(!('error' in who));
  const url = new URL((await createGiftIntent(buyer.id, who as Exclude<typeof who, { error: string }>))!);
  const token = url.searchParams.get('gift')!;
  assert.ok(token && url.searchParams.get('ref'));

  const sale = { sale_id: 'gift-sale-1', 'url_params[gift]': token, 'variants[Gift]': 'Champion · 3 months' };
  assert.equal((await post(sale)).status, 200);
  assert.equal((await post(sale)).status, 200, 'a replay is fine…');
  const { db, schema: s } = await loadDb();
  const rows = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, friend.id));
  assert.equal(rows.length, 1, '…and applies once');
  assert.equal(rows[0].tier, 'champion');
  assert.equal(rows[0].status, 'granted');
  assert.equal(rows[0].recurrence, 'gift-paid');
  assert.equal(rows[0].giftedByUserId, buyer.id);
  assert.equal(rows[0].giftMonths, 3);
  assert.equal((await giftedMonthsFor([buyer.id])).get(buyer.id), 3);

  const { supporterForUser } = await import('../src/lib/supporter.ts');
  assert.equal((await supporterForUser(friend.id))?.tier.id, 'champion');

  await post({ sale_id: 'gift-sale-1', refunded: 'true', 'url_params[gift]': token });
  assert.equal(await supporterForUser(friend.id), null, 'refunded: gone');
  assert.equal((await giftedMonthsFor([buyer.id])).get(buyer.id) ?? 0, 0, 'and it no longer counts');
});

test('a hidden character can’t be gifted (and isn’t confirmed to exist); nor can yourself', async () => {
  const buyer = await person('Self Gifter');
  await person('Secret Sam', false);
  const { giftRecipient } = await import('../src/lib/supporterGiftCheckout.ts');
  assert.ok('error' in (await giftRecipient('secret sam', buyer.id)));
  assert.ok('error' in (await giftRecipient('nobody at all', buyer.id)));
  assert.ok('error' in (await giftRecipient('self gifter', buyer.id)));
});

test('a sale with no gift token or an unknown option is held, never granted', async () => {
  const { db, schema: s } = await loadDb();
  const before = (await db.select().from(s.supporterSubscriptions)).length;
  await post({ sale_id: 'gift-sale-x', 'variants[Gift]': 'Champion · 3 months' });
  await post({ sale_id: 'gift-sale-y', 'url_params[gift]': 'nope', 'variants[Gift]': 'Gold · 1 month' });
  assert.equal((await db.select().from(s.supporterSubscriptions)).length, before);
});
