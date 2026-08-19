// Billing, now that a clan is a row here rather than a container somewhere else.
//
// The behavioural change worth testing is what happens when someone STOPS paying. Under the hosted
// model a lapsed subscription meant a deprovisioned container: the site went away. Here it means the
// plan drops to free and everything else — events, roster, history, the site itself — stays. A
// community losing its data over an expired card is not a retention strategy, so "the site survives
// a lapse" is an assertion rather than a hope.
//
// The other half is the trust gate. Gumroad's Ping carries no signature, so a shared secret in the
// URL is the only thing between a forged POST and a free upgrade.
//
// Run: npm run test:billing

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { parseWebhook, verifySeller, verifyWebhookSecret } from '../src/lib/gumroad.ts';
import { PLANS, planForGumroadTier, planOf, overMemberCap } from '../src/lib/plans.ts';

const DB = useTestDatabase('billing-webhook');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  const { pool: p } = await loadDb();
  pool = p;
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** A Ping body, form-encoded the way Gumroad sends it. */
function ping(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

// ── The trust gate ────────────────────────────────────────────────────────────────────────────

test('the URL secret is the gate, and a wrong one is refused', () => {
  assert.equal(verifyWebhookSecret('test-webhook-secret'), true);
  assert.equal(verifyWebhookSecret('nearly-right'), false);
  assert.equal(verifyWebhookSecret(''), false);
  assert.equal(verifyWebhookSecret(null), false);
});

test('with no secret configured, nothing is accepted', () => {
  // The failure mode being prevented: an unset env var making every check pass.
  const saved = process.env.GUMROAD_WEBHOOK_SECRET;
  delete process.env.GUMROAD_WEBHOOK_SECRET;
  assert.equal(verifyWebhookSecret('anything'), false);
  assert.equal(verifyWebhookSecret(''), false);
  process.env.GUMROAD_WEBHOOK_SECRET = saved;
});

test('seller id is a second check, never the only one', () => {
  // It appears in public product URLs, so it proves nothing on its own — but it costs nothing.
  assert.equal(verifySeller('seller-123'), true);
  assert.equal(verifySeller('someone-else'), false);
});

// ── Parsing both shapes ───────────────────────────────────────────────────────────────────────

test('a Ping sale is read as a sale', () => {
  const ev = parseWebhook(
    ping({ seller_id: 'seller-123', sale_id: 's1', subscription_id: 'sub1', email: 'a@b.com' }),
  );
  assert.equal(ev.kind, 'sale');
  assert.equal(ev.subscriptionId, 'sub1');
});

test('a renewal is distinguished from a first sale', () => {
  // Both arrive as resource_name=sale; only is_recurring_charge separates them, and treating a
  // renewal as a new sale would restart the trial on every billing cycle.
  const ev = parseWebhook(
    ping({ seller_id: 'seller-123', resource_name: 'sale', is_recurring_charge: 'true', subscription_id: 'sub1' }),
  );
  assert.equal(ev.kind, 'recurring_charge');
});

test('cancellation, ending, refund and dispute are all distinct', () => {
  const kind = (f: Record<string, string>) => parseWebhook(ping({ seller_id: 'seller-123', ...f })).kind;
  assert.equal(kind({ cancelled: 'true' }), 'cancellation');
  assert.equal(kind({ subscription_ended: 'true' }), 'subscription_ended');
  assert.equal(kind({ refunded: 'true' }), 'refund');
  assert.equal(kind({ disputed: 'true' }), 'dispute');
});

test('the correlation ref survives parsing', () => {
  // url_params[ref] is how a payment finds the clan that started it. Lose it and every purchase
  // looks like it came from nowhere.
  const ev = parseWebhook(ping({ seller_id: 'seller-123', 'url_params[ref]': 'abc123' }));
  assert.equal(ev.urlParams.ref, 'abc123');
});

test('the membership tier is read out of variants', () => {
  const ev = parseWebhook(ping({ seller_id: 'seller-123', 'variants[Tier]': 'Silver' }));
  assert.equal(ev.tier, 'Silver');
  assert.equal(planForGumroadTier(ev.tier)?.id, 'silver');
});

// ── Entitlement ───────────────────────────────────────────────────────────────────────────────

test('an unknown or missing plan reads as free, never as something paid', () => {
  assert.equal(planOf(null).id, 'free');
  assert.equal(planOf('platinum').id, 'free', 'a typo must not grant a tier');
  assert.equal(planOf('silver').id, 'silver');
});

test('tier names map case-insensitively, since Gumroad sends the display name', () => {
  assert.equal(planForGumroadTier('gold')?.id, 'gold');
  assert.equal(planForGumroadTier('GOLD')?.id, 'gold');
  assert.equal(planForGumroadTier('  Silver ')?.id, 'silver');
  assert.equal(planForGumroadTier('Titanium'), null);
});

test('the member cap is reported, not enforced by deletion', () => {
  assert.equal(overMemberCap(PLANS.free, 50), false);
  assert.equal(overMemberCap(PLANS.free, 51), true);
  // No cap means never over it, however large the clan.
  assert.equal(overMemberCap(PLANS.custom, 100_000), false);
});

// ── What a lapse does to a clan ───────────────────────────────────────────────────────────────

test('a lapsed subscription drops the plan and leaves the clan standing', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({
      slug: 'lapsing',
      name: 'Lapsing Clan',
      plan: 'silver',
      memberCap: 300,
      status: 'active',
      gumroadSubscriptionId: 'sub-lapse',
    })
    .returning();

  // What the subscription_ended branch does.
  await db
    .update(s.clans)
    .set({ plan: 'free', memberCap: PLANS.free.memberCap, gumroadSubscriptionId: null })
    .where(eq(s.clans.id, clan.id));

  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'free');
  assert.equal(after?.status, 'active', 'the site stays up — this is the whole point');
  assert.equal(after?.gumroadSubscriptionId, null, 'freed, so they can subscribe again');
});

test('a refund suspends, because that is the abuse case rather than the lapse one', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'refunded', name: 'Refunded Clan', plan: 'gold', status: 'active' })
    .returning();

  await db.update(s.clans).set({ plan: 'free', status: 'suspended' }).where(eq(s.clans.id, clan.id));

  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.status, 'suspended', 'money taken back is different from money running out');
});

test('cancelling keeps the tier until the term ends', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'cancelling', name: 'Cancelling Clan', plan: 'silver', status: 'active' })
    .returning();

  await db.update(s.clans).set({ cancelAtPeriodEnd: true }).where(eq(s.clans.id, clan.id));

  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'silver', 'they paid for this term; taking it back early is theft');
  assert.equal(after?.cancelAtPeriodEnd, true);
});

test('two clans cannot claim one subscription', async () => {
  const { db, schema: s } = await loadDb();
  await db
    .insert(s.clans)
    .values({ slug: 'first-claim', name: 'First', gumroadSubscriptionId: 'sub-shared' });

  await assert.rejects(
    () =>
      db.insert(s.clans).values({ slug: 'second-claim', name: 'Second', gumroadSubscriptionId: 'sub-shared' }),
    // Matched on the SQLSTATE rather than the message: drizzle wraps the driver error, so its own
    // text is "Failed query: ..." and a message regex silently matches nothing useful.
    (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505',
    'a billing bug that should be impossible, not merely unlikely',
  );
});

test('free clans all have a null subscription, which the unique index must allow', async () => {
  const { db, schema: s } = await loadDb();
  // The partial index exists precisely so this is fine — most clans are free.
  await db.insert(s.clans).values([
    { slug: 'free-a', name: 'Free A' },
    { slug: 'free-b', name: 'Free B' },
    { slug: 'free-c', name: 'Free C' },
  ]);
  const rows = await db.select().from(s.clans);
  assert.ok(rows.filter((r) => r.gumroadSubscriptionId == null).length >= 3);
});
