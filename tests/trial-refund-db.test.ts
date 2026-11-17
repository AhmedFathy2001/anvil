// Unused trial days given back as a partial refund when a clan subscribes early (lib/trialRefund).
// The rule is pure; the rest runs against a real database with Gumroad stood in for.
//
// Run: npx tsx --test tests/trial-refund-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('trial-refund-db');
const DAY = 86_400_000;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let R: typeof import('../src/lib/trialRefund.ts');

let n = 0;
/** A clan on an Anvil plan trial with `daysLeft` still to run. */
async function clanOnTrial(daysLeft: number) {
  const [clan] = await db.insert(s.clans).values({ slug: `refund-${n++}`, name: 'Refund Test' }).returning();
  const [trial] = await db
    .insert(s.ownerTrials)
    .values({ kind: 'plan', clanId: clan.id, tier: 'gold', days: 30, startsAt: new Date(Date.now() - (30 - daysLeft) * DAY), endsAt: new Date(Date.now() + daysLeft * DAY + 3_600_000) })
    .returning();
  return { clan, trial };
}
const sale = (over: Record<string, unknown> = {}) =>
  ({ kind: 'sale', saleId: `sale-${n++}`, subscriptionId: 'sub', priceCents: 1499, recurrence: 'monthly', isRecurringCharge: false, urlParams: {}, ...over }) as unknown as import('../src/lib/gumroad.ts').GumroadEvent;
const audit = async (clanId: number) =>
  (await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, clanId))).filter((r) => r.eventType === 'billing_trial_refund').map((r) => JSON.parse(r.newValue ?? '{}'));
const trialRow = async (id: number) => (await db.select().from(s.ownerTrials).where(eq(s.ownerTrials.id, id)))[0];

/** Gumroad stood in for: records each refund call and answers as told. */
function gumroad(answer: { status: number; body: unknown }) {
  const calls: { url: string; body: string }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  R = await import('../src/lib/trialRefund.ts');
  process.env.GUMROAD_ACCESS_TOKEN = 'test-token';
});

after(async () => {
  delete process.env.ANVIL_TRIAL_REFUND;
  await pool.end();
  await dropDatabase(DB);
});

test('the amount is the price times unused whole days over the days in the term, capped and never tiny', () => {
  const at = 1_800_000_000_000;
  const f = (daysLeft: number, priceCents = 1499, recurrence: string | null = 'monthly') =>
    R.trialRefundCents({ priceCents, recurrence, trialEndsAtMs: at + daysLeft * DAY, chargedAtMs: at });
  assert.deepEqual(f(11), { cents: 549, days: 11 }, '11 of 30 days on $14.99');
  assert.deepEqual(f(11.9), { cents: 549, days: 11 }, 'a part day is not a day');
  assert.deepEqual(f(0.5), { cents: 0, days: 0 });
  assert.deepEqual(f(-3), { cents: 0, days: 0 }, 'a trial already over gives nothing');
  assert.deepEqual(f(30), { cents: 1349, days: 30 }, 'never the whole payment: 90% at most');
  assert.deepEqual(f(11, 14990, 'yearly'), { cents: 451, days: 11 }, 'a year paid: 11 of 365 days');
  assert.deepEqual(f(1, 299), { cents: 0, days: 1 }, 'under 50 cents is not worth a card transaction');
  assert.deepEqual(f(11, 0), { cents: 0, days: 11 });
  assert.deepEqual(f(11, 1499, null), { cents: 549, days: 11 }, 'an unknown term counts as monthly');
});

test('switched off: nothing is refunded, and the sale records what it would have been', async () => {
  delete process.env.ANVIL_TRIAL_REFUND;
  const { clan, trial } = await clanOnTrial(11);
  const g = gumroad({ status: 200, body: { success: true } });
  try {
    await R.refundUnusedTrial(clan.id, sale(), Date.now());
  } finally {
    g.restore();
  }
  assert.equal(g.calls.length, 0, 'Gumroad is not called');
  const [row] = await audit(clan.id);
  assert.equal(row.dry, true);
  assert.equal(row.cents, 549);
  assert.equal((await trialRow(trial.id)).convertedAt, null, 'the trial is not claimed while it is off');
});

test('switched on: one partial refund for that sale, once, however often the notification arrives', async () => {
  process.env.ANVIL_TRIAL_REFUND = 'on';
  const { clan, trial } = await clanOnTrial(11);
  const ev = sale();
  const g = gumroad({ status: 200, body: { success: true } });
  try {
    await R.refundUnusedTrial(clan.id, ev, Date.now());
    await R.refundUnusedTrial(clan.id, ev, Date.now());
    await Promise.all([R.refundUnusedTrial(clan.id, ev, Date.now()), R.refundUnusedTrial(clan.id, sale(), Date.now())]);
  } finally {
    g.restore();
  }
  assert.equal(g.calls.length, 1, 'one call to Gumroad');
  assert.ok(g.calls[0].url.endsWith(`/v2/sales/${ev.saleId}/refund`));
  assert.equal(g.calls[0].body, 'amount_cents=549');
  const rows = await audit(clan.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].refunded, true);
  assert.equal(rows[0].sale, ev.saleId);
  assert.ok((await trialRow(trial.id)).convertedAt, 'the trial is marked as having become a paid plan');
});

test('no refund for a renewal, a free sale, a clan with no running trial, or a trial already over', async () => {
  process.env.ANVIL_TRIAL_REFUND = 'on';
  const g = gumroad({ status: 200, body: { success: true } });
  try {
    const a = await clanOnTrial(11);
    await R.refundUnusedTrial(a.clan.id, sale({ isRecurringCharge: true }), Date.now());
    await R.refundUnusedTrial(a.clan.id, sale({ priceCents: 0 }), Date.now());
    await R.refundUnusedTrial(a.clan.id, sale({ saleId: null }), Date.now());
    const [none] = await db.insert(s.clans).values({ slug: `refund-none-${n++}`, name: 'No trial' }).returning();
    await R.refundUnusedTrial(none.id, sale(), Date.now());
    const over = await clanOnTrial(-2);
    await R.refundUnusedTrial(over.clan.id, sale(), Date.now());
    const revoked = await clanOnTrial(11);
    await db.update(s.ownerTrials).set({ revokedAt: new Date() }).where(eq(s.ownerTrials.id, revoked.trial.id));
    await R.refundUnusedTrial(revoked.clan.id, sale(), Date.now());
  } finally {
    g.restore();
  }
  assert.equal(g.calls.length, 0);
});

test('a refund Gumroad refuses is recorded for staff and never thrown', async () => {
  process.env.ANVIL_TRIAL_REFUND = 'on';
  const { clan } = await clanOnTrial(11);
  const g = gumroad({ status: 403, body: { success: false, message: 'The access token does not allow refunds.' } });
  try {
    await R.refundUnusedTrial(clan.id, sale(), Date.now());
  } finally {
    g.restore();
  }
  const [row] = await audit(clan.id);
  assert.equal(row.refunded, false);
  assert.equal(row.status, 403);
  assert.match(row.error, /does not allow refunds/);
});
