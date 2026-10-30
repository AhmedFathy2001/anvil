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

// ── The webhook itself: replays, email matching, staff suspensions ───────────────────────────

async function postWebhook(fields: Record<string, string>): Promise<Response> {
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

test('a replayed sale is applied once, so it cannot re-lift a suspension or restart the trial', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'replayed', name: 'Replayed', status: 'suspended', gumroadRef: 'ref-replay' })
    .returning();
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_refund', newValue: '{}' });

  assert.equal((await postWebhook({ sale_id: 'sale-r1', 'url_params[ref]': 'ref-replay' })).status, 200);
  const first = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(first?.status, 'active', 'paying again lifts a refund suspension');

  // Refunded again, then the original notification is replayed.
  await db.update(s.clans).set({ status: 'suspended' }).where(eq(s.clans.id, clan.id));
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_refund', newValue: '{}' });
  await postWebhook({ sale_id: 'sale-r1', 'url_params[ref]': 'ref-replay' });
  const replayed = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(replayed?.status, 'suspended', 'the same sale twice is one sale');
});

test('a sale is never matched to a clan by its typed-in contact email', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'email-squat', name: 'Squatter', contactEmail: 'victim@example.com' })
    .returning();
  await postWebhook({ sale_id: 'sale-e1', email: 'victim@example.com' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'free', 'an unverified email is not who paid');
});

test('a payment does not lift a suspension staff applied', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'staff-suspended', name: 'Staff Suspended', status: 'suspended', gumroadRef: 'ref-staff' })
    .returning();
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_refund', newValue: '{}' });
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'platform_clan_updated', newValue: '{}' });
  await postWebhook({ sale_id: 'sale-s1', 'url_params[ref]': 'ref-staff' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.status, 'suspended');
  assert.notEqual(after?.plan, 'free', 'the purchase itself still lands');
});

// ── Ending, and taking it up again ────────────────────────────────────────────────────────────

test('a lapsed subscription drops the plan, leaves the clan standing, and keeps the id', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'lapsing', name: 'Lapsing Clan', plan: 'silver', memberCap: 300, status: 'active', gumroadSubscriptionId: 'sub-lapse' })
    .returning();
  assert.equal((await postWebhook({ resource_name: 'subscription_ended', subscription_id: 'sub-lapse' })).status, 200);
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.plan, 'free');
  assert.equal(after?.memberCap, PLANS.free.memberCap);
  assert.equal(after?.status, 'active', 'the site stays up — this is the whole point');
  assert.equal(after?.gumroadSubscriptionId, 'sub-lapse', 'kept, so a restart can find the clan');
});

test('a restart after the end gives back the plan that was paid for', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'restarting', name: 'Restarting', plan: 'gold', memberCap: 600, status: 'active', gumroadSubscriptionId: 'sub-restart' })
    .returning();
  await postWebhook({ resource_name: 'subscription_ended', subscription_id: 'sub-restart' });
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) }))?.plan, 'free');

  assert.equal((await postWebhook({ resource_name: 'subscription_restarted', subscription_id: 'sub-restart', recurrence: 'monthly' })).status, 200);
  const back = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(back?.plan, 'gold');
  assert.equal(back?.memberCap, PLANS.gold.memberCap);
  assert.ok(back?.currentPeriodEnd && Date.parse(back.currentPeriodEnd) > Date.now(), 'the next charge is due a month out');

  // Replayed once it's been applied: the last billing word is the restart, so nothing to restore.
  await db.update(s.clans).set({ plan: 'free' }).where(eq(s.clans.id, clan.id));
  await postWebhook({ resource_name: 'subscription_restarted', subscription_id: 'sub-restart' });
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) }))?.plan, 'free');
});

test('a restart lifts no suspension and restores nothing after a refund', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'restart-refund', name: 'Restart Refund', plan: 'silver', status: 'active', gumroadSubscriptionId: 'sub-rr' })
    .returning();
  await postWebhook({ resource_name: 'subscription_ended', subscription_id: 'sub-rr' });
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_refund', newValue: '{}' });
  await postWebhook({ resource_name: 'subscription_restarted', subscription_id: 'sub-rr' });
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) }))?.plan, 'free');

  await db.update(s.clans).set({ status: 'suspended' }).where(eq(s.clans.id, clan.id));
  await postWebhook({ resource_name: 'subscription_restarted', subscription_id: 'sub-rr' });
  assert.equal((await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) }))?.status, 'suspended');
});

test('a restart while cancelling just clears the cancel', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'uncancel', name: 'Uncancel', plan: 'bronze', status: 'active', gumroadSubscriptionId: 'sub-unc', cancelAtPeriodEnd: true })
    .returning();
  await postWebhook({ resource_name: 'subscription_restarted', subscription_id: 'sub-unc' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.equal(after?.cancelAtPeriodEnd, false);
  assert.equal(after?.plan, 'bronze');
});

test('a renewal records when the next one is due, so a missed one shows as overdue', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'renewing', name: 'Renewing', plan: 'silver', status: 'active', gumroadSubscriptionId: 'sub-renew' })
    .returning();
  await postWebhook({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-renew-1', subscription_id: 'sub-renew', recurrence: 'yearly' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  const days = (Date.parse(after!.currentPeriodEnd!) - Date.now()) / 86_400_000;
  assert.ok(days > 360 && days < 370, `a yearly charge is due in a year, got ${days}`);
});

test('a renewal redelivered weeks late is dated from its charge, not from its arrival', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'late-ping', name: 'Late Ping', plan: 'silver', status: 'active', gumroadSubscriptionId: 'sub-late' })
    .returning();
  const charged = new Date(Date.now() - 50 * 86_400_000).toISOString();
  await postWebhook({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-late-1', subscription_id: 'sub-late', recurrence: 'monthly', sale_timestamp: charged });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.ok(Date.parse(after!.currentPeriodEnd!) < Date.now(), 'a month after a charge 50 days ago is already behind us');
});

test('a sale keeps the email the owner gave Anvil', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'own-email', name: 'Own Email', contactEmail: 'owner@anvil.test', gumroadRef: 'ref-own-email' })
    .returning();
  await postWebhook({ sale_id: 'sale-oe1', 'url_params[ref]': 'ref-own-email', email: 'payer@elsewhere.test' });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  assert.notEqual(after?.plan, 'free');
  assert.equal(after?.contactEmail, 'owner@anvil.test');
});

// ── Lapses Gumroad never announces ────────────────────────────────────────────────────────────

test('the daily check ends a membership Gumroad stopped running, and a later charge gives it back', async () => {
  const { db, schema: s } = await loadDb();
  const { sweepLapsedBilling } = await import('../src/lib/billingLapse.ts');
  const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const [failed, undated, healthy, notDue, comped] = await db
    .insert(s.clans)
    .values([
      // lfl's shape: paid once, the next charge failed, no end ever sent.
      { slug: 'sweep-failed', name: 'Failed', plan: 'silver', memberCap: 300, status: 'active', gumroadSubscriptionId: 'sub-failed', currentPeriodEnd: past },
      { slug: 'sweep-undated', name: 'Undated', plan: 'gold', memberCap: 600, status: 'active', gumroadSubscriptionId: 'sub-undated' },
      { slug: 'sweep-healthy', name: 'Healthy', plan: 'bronze', memberCap: 150, status: 'active', gumroadSubscriptionId: 'sub-healthy' },
      { slug: 'sweep-notdue', name: 'Not Due', plan: 'silver', memberCap: 300, status: 'active', gumroadSubscriptionId: 'sub-notdue', currentPeriodEnd: future },
      { slug: 'sweep-comped', name: 'Comped', plan: 'gold', memberCap: 600, status: 'active' },
    ])
    .returning();

  const statuses: Record<string, string> = { 'sub-failed': 'failed_payment', 'sub-undated': 'cancelled', 'sub-healthy': 'alive', 'sub-notdue': 'failed_payment' };
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    const sub = /\/subscribers\/([^/?]+)/.exec(u)?.[1];
    if (sub) {
      const id = decodeURIComponent(sub);
      asked.push(id);
      return Response.json({ success: true, subscriber: { id, status: statuses[id] } });
    }
    const sale = /\/sales\/([^/?]+)/.exec(u)?.[1];
    if (sale) return Response.json({ success: true, sale: { id: decodeURIComponent(sale) } });
    return new Response('not mocked', { status: 500 });
  }) as typeof fetch;
  process.env.GUMROAD_ACCESS_TOKEN = 'test-token';
  try {
    const result = await sweepLapsedBilling();
    // Other tests' paying clans share this database; only this test's own rows are asserted on.
    assert.deepEqual(result.ended.filter((slug) => slug.startsWith('sweep-')).sort(), ['sweep-failed', 'sweep-undated']);
    assert.ok(!asked.includes('sub-notdue'), 'a clan not due yet is not asked about');

    const get = async (id: number) => db.query.clans.findFirst({ where: eq(s.clans.id, id) });
    assert.equal((await get(failed.id))?.plan, 'free');
    assert.equal((await get(failed.id))?.status, 'active', 'a lapse never takes the site down');
    assert.equal((await get(undated.id))?.plan, 'free');
    assert.equal((await get(healthy.id))?.plan, 'bronze');
    assert.equal((await get(notDue.id))?.plan, 'silver', 'not due yet, not asked');
    assert.equal((await get(comped.id))?.plan, 'gold', 'a comp has no subscription to chase');

    // The card is fixed and Gumroad charges it: the plan that was paid for comes back.
    await postWebhook({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-failed-2', subscription_id: 'sub-failed', recurrence: 'monthly' });
    const back = await get(failed.id);
    assert.equal(back?.plan, 'silver');
    assert.equal(back?.memberCap, PLANS.silver.memberCap);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GUMROAD_ACCESS_TOKEN;
  }
});

test('without a Gumroad token the daily check asks nobody and ends nothing', async () => {
  const { sweepLapsedBilling } = await import('../src/lib/billingLapse.ts');
  const result = await sweepLapsedBilling();
  assert.equal(result.skipped, 'no-token');
  assert.deepEqual(result.ended, []);
});

test('a renewal stamped in the future is dated from now, so it cannot hide a lapse', async () => {
  const { db, schema: s } = await loadDb();
  const [clan] = await db
    .insert(s.clans)
    .values({ slug: 'future-ping', name: 'Future Ping', plan: 'silver', status: 'active', gumroadSubscriptionId: 'sub-future' })
    .returning();
  const ahead = new Date(Date.now() + 5 * 365 * 86_400_000).toISOString();
  await postWebhook({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-future-1', subscription_id: 'sub-future', recurrence: 'monthly', sale_timestamp: ahead });
  const after = await db.query.clans.findFirst({ where: eq(s.clans.id, clan.id) });
  const days = (Date.parse(after!.currentPeriodEnd!) - Date.now()) / 86_400_000;
  assert.ok(days < 32, `due a month out at most, got ${days}`);
});
