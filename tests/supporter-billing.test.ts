// Anvil Supporter through the Gumroad webhook: a personal subscription riding the clan billing hook.
//
// What matters: a sale finds its buyer by their checkout ref (never by email), it never touches a
// clan, a replay is applied once, cancelling keeps the tier to the end of the term, and a refund
// ends it without suspending anybody.
//
// Run: npx tsx --test tests/supporter-billing.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-billing');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  const { pool: p } = await loadDb();
  pool = p;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
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
      body: new URLSearchParams({ seller_id: 'seller-123', product_id: 'prod-supporter', ...fields }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
}

let n = 0;
async function makeUser(ref: string | null, email = 'buyer@example.com') {
  const { db, schema: s } = await loadDb();
  n += 1;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: `Buyer ${n}`, discordId: `d-${n}-${ref}`, email, supporterRef: ref })
    .returning();
  return u;
}

async function rowsFor(userId: number) {
  const { db, schema: s } = await loadDb();
  return db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, userId));
}

async function stateFor(userId: number) {
  const { supporterState } = await import('../src/lib/supporterTiers.ts');
  return supporterState(await rowsFor(userId));
}

test('a sale finds its buyer by checkout ref and grants the tier bought', async () => {
  const u = await makeUser('ref-a');
  const res = await post({
    sale_id: 'sale-a1',
    subscription_id: 'sub-a',
    'url_params[ref]': 'ref-a',
    'variants[Tier]': 'Champion',
    recurrence: 'yearly',
  });
  assert.equal(res.status, 200);
  const state = await stateFor(u.id);
  assert.equal(state?.tier.id, 'champion');
  assert.ok(state?.renewsAt, 'a renewal date is recorded');
});

test('a Supporter sale never touches a clan, even one sharing the ref', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'ref-clash', name: 'Ref clash', gumroadRef: 'ref-shared' }).returning();
  await makeUser('ref-shared');
  await post({ sale_id: 'sale-s1', subscription_id: 'sub-s', 'url_params[ref]': 'ref-shared', 'variants[Tier]': 'Patron' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'free', 'the clan plan is untouched');
});

test('a sale is never matched by email', async () => {
  const u = await makeUser(null, 'same@example.com');
  const res = await post({ sale_id: 'sale-e1', subscription_id: 'sub-e', email: 'same@example.com', 'variants[Tier]': 'Supporter' });
  assert.equal(res.status, 200);
  assert.equal((await rowsFor(u.id)).length, 0);
});

test('an unknown tier grants nothing', async () => {
  const u = await makeUser('ref-u');
  await post({ sale_id: 'sale-u1', subscription_id: 'sub-u', 'url_params[ref]': 'ref-u', 'variants[Tier]': 'Gold' });
  assert.equal((await rowsFor(u.id)).length, 0);
});

test('a replayed sale is applied once', async () => {
  const u = await makeUser('ref-r');
  const fields = { sale_id: 'sale-r1', subscription_id: 'sub-r', 'url_params[ref]': 'ref-r', 'variants[Tier]': 'Supporter' };
  await post(fields);
  const res = await post(fields);
  assert.deepEqual(await res.json(), { received: true, note: 'already applied' });
  assert.equal((await rowsFor(u.id)).length, 1);
});

test('cancelling keeps the tier to the end of the term; the end takes it away', async () => {
  const u = await makeUser('ref-c');
  await post({ sale_id: 'sale-c1', subscription_id: 'sub-c', 'url_params[ref]': 'ref-c', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  await post({ subscription_id: 'sub-c', cancelled: 'true' });
  const cancelling = await stateFor(u.id);
  assert.equal(cancelling?.tier.id, 'supporter', 'still theirs: they paid for this term');
  assert.ok(cancelling?.endsAt);
  await post({ subscription_id: 'sub-c', subscription_ended_at: '2026-12-01T00:00:00Z' });
  assert.equal(await stateFor(u.id), null);
});

test('a renewal carries a tier change made on Gumroad', async () => {
  const u = await makeUser('ref-up');
  await post({ sale_id: 'sale-up1', subscription_id: 'sub-up', 'url_params[ref]': 'ref-up', 'variants[Tier]': 'Supporter', recurrence: 'monthly' });
  await post({ sale_id: 'sale-up2', subscription_id: 'sub-up', is_recurring_charge: 'true', 'variants[Tier]': 'Patron', recurrence: 'monthly' });
  assert.equal((await stateFor(u.id))?.tier.id, 'patron');
});

test('a refund ends it at once, and a later replay of the sale cannot bring it back', async () => {
  const u = await makeUser('ref-f');
  const sale = { sale_id: 'sale-f1', subscription_id: 'sub-f', 'url_params[ref]': 'ref-f', 'variants[Tier]': 'Champion' };
  await post(sale);
  await post({ subscription_id: 'sub-f', sale_id: 'sale-f1', refunded: 'true' });
  assert.equal(await stateFor(u.id), null);
  await post(sale);
  assert.equal(await stateFor(u.id), null, 'the same sale twice is one sale');
});

test('clan sales still reach the clan path', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'clan-buyer', name: 'Clan buyer', gumroadRef: 'ref-clan' }).returning();
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/webhooks/gumroad/route.ts');
  await POST(
    new NextRequest('https://anvilosrs.com/api/webhooks/gumroad?key=test-webhook-secret', {
      method: 'POST',
      body: new URLSearchParams({
        seller_id: 'seller-123',
        product_id: 'prod-clan',
        sale_id: 'sale-clan1',
        subscription_id: 'sub-clan',
        'url_params[ref]': 'ref-clan',
        'variants[Tier]': 'Silver',
      }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'silver');
});

test('a sale with no subscription grants nothing, so nothing is left a refund cannot reach', async () => {
  const u = await makeUser('ref-ns');
  const res = await post({ sale_id: 'sale-ns1', 'url_params[ref]': 'ref-ns', 'variants[Tier]': 'Patron' });
  assert.deepEqual(await res.json(), { received: true, note: 'not a subscription' });
  assert.equal((await rowsFor(u.id)).length, 0);
});

test('a refund that names only the sale still ends the membership', async () => {
  const u = await makeUser('ref-so');
  await post({ sale_id: 'sale-so1', subscription_id: 'sub-so', 'url_params[ref]': 'ref-so', 'variants[Tier]': 'Champion' });
  await post({ sale_id: 'sale-so1', refunded: 'true' });
  assert.equal(await stateFor(u.id), null);
});

test('the plugin panel finds a supporter by any of their character names', async () => {
  const { db, schema: s } = await loadDb();
  const u = await makeUser('ref-rsn');
  const [player] = await db.insert(s.players).values({}).returning();
  await db.update(s.users).set({ playerId: player.id }).where(eq(s.users.id, u.id));
  await db.insert(s.accounts).values([
    { playerId: player.id, rsn: 'Iron_Flair', rsnNormalized: 'iron flair' },
    { playerId: player.id, rsn: 'Main Flair', rsnNormalized: 'main flair' },
  ]);
  await post({ sale_id: 'sale-rsn1', subscription_id: 'sub-rsn', 'url_params[ref]': 'ref-rsn', 'variants[Tier]': 'Patron' });
  const { supporterTiersForRsns } = await import('../src/lib/supporter.ts');
  const tiers = await supporterTiersForRsns(['Iron Flair', 'MAIN_FLAIR', 'Nobody Here']);
  assert.equal(tiers.get('iron flair'), 'patron');
  assert.equal(tiers.get('main flair'), 'patron');
  assert.equal(tiers.size, 2);
});
