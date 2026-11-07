// The unmatched Gumroad purchases inbox, pure half (lib/unmatchedPurchaseRules): what row a dropped
// sale becomes, what later notifications do to it, and which spaces staff may attach it to.
//
// Run: node --import tsx --test tests/unmatched-purchase-rules.test.ts (no database)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseWebhook } from '../src/lib/gumroad.ts';
import {
  attachTargetProblem,
  cleanNote,
  eventFromRow,
  gumroadStateAfter,
  planIdOf,
  planKindOf,
  replaceProblem,
  unmatchedRowFromEvent,
  MAX_NOTE,
} from '../src/lib/unmatchedPurchaseRules.ts';

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const ping = (f: Record<string, string>) => parseWebhook(new URLSearchParams({ seller_id: 's', ...f }).toString());

test('the product decides the kind: creator product or tier → creator, otherwise a clan plan', () => {
  withEnv({ GUMROAD_PRODUCT_CREATOR_SILVER: 'prod-cs', GUMROAD_PRODUCT_SILVER: 'prod-s' }, () => {
    assert.equal(planKindOf({ productId: 'prod-cs', tier: null }), 'creator');
    assert.equal(planKindOf({ productId: 'prod-s', tier: 'Silver' }), 'plan');
    assert.equal(planKindOf({ productId: null, tier: 'Creator Silver' }), 'creator');
    assert.equal(planKindOf({ productId: null, tier: 'Gold' }), 'plan');
    // Nothing recognisable is filed as a clan plan (the clan storefront's leniency).
    assert.equal(planKindOf({ productId: 'mystery', tier: null }), 'plan');
  });
});

test('the plan id is read in the row’s own catalogue, null when unknown', () => {
  assert.equal(planIdOf({ productId: null, tier: 'Silver' }, 'plan'), 'silver');
  assert.equal(planIdOf({ productId: null, tier: 'Creator Silver' }, 'creator'), 'creator_silver');
  assert.equal(planIdOf({ productId: null, tier: 'Creator Silver' }, 'plan'), null, 'never a creator id on a clan row');
  assert.equal(planIdOf({ productId: null, tier: 'Champion' }, 'supporter'), 'champion');
  assert.equal(planIdOf({ productId: null, tier: 'Gold' }, 'supporter'), null);
  assert.equal(planIdOf({ productId: 'mystery', tier: null }, 'plan'), null);
});

test('a dropped sale becomes a row with everything staff need to place it', () => {
  const ev = ping({
    sale_id: 'sale-1',
    subscription_id: 'sub-1',
    product_id: 'prod-x',
    product_name: 'Anvil Creator Silver',
    product_permalink: 'creator-silver',
    'variants[Tier]': 'Creator Silver',
    recurrence: 'monthly',
    price: '1500',
    currency: 'usd',
    email: 'buyer@example.com',
    'url_params[ref]': 'clanref',
    'url_params[via]': 'friend',
    free_trial_ends_at: '2026-12-01T00:00:00Z',
    sale_timestamp: '2026-11-01T00:00:00Z',
  });
  const row = unmatchedRowFromEvent(ev, { kind: 'creator', reason: 'cross-catalogue', refClanId: 7 });
  assert.deepEqual(row, {
    kind: 'creator',
    reason: 'cross-catalogue',
    gumroadSaleId: 'sale-1',
    gumroadSubscriptionId: 'sub-1',
    productId: 'prod-x',
    productName: 'Anvil Creator Silver',
    productPermalink: 'creator-silver',
    tier: 'Creator Silver',
    planId: 'creator_silver',
    recurrence: 'monthly',
    priceCents: 1500,
    currency: 'usd',
    buyerEmail: 'buyer@example.com',
    ref: 'clanref',
    urlParams: { ref: 'clanref', via: 'friend' },
    freeTrialEndsAt: '2026-12-01T00:00:00Z',
    saleTimestamp: '2026-11-01T00:00:00Z',
    refClanId: 7,
  });
});

test('a bare sale keeps nulls rather than empty strings, and no ref means no ref clan', () => {
  const row = unmatchedRowFromEvent(ping({ sale_id: 'sale-2', email: '' }), { kind: 'plan', reason: 'no-ref' });
  assert.equal(row.buyerEmail, null);
  assert.equal(row.ref, null);
  assert.equal(row.urlParams, null);
  assert.equal(row.refClanId, null);
  assert.equal(row.priceCents, null);
});

test('the row replays as the same sale through the webhook’s apply', () => {
  const ev = ping({
    sale_id: 'sale-3',
    subscription_id: 'sub-3',
    product_id: 'prod-y',
    'variants[Tier]': 'Gold',
    recurrence: 'yearly',
    email: 'b@example.com',
    'url_params[via]': 'code',
    sale_timestamp: '2026-11-02T00:00:00Z',
  });
  const back = eventFromRow(unmatchedRowFromEvent(ev, { kind: 'plan', reason: 'no-ref' }));
  assert.equal(back.kind, 'sale');
  for (const k of ['saleId', 'subscriptionId', 'productId', 'tier', 'recurrence', 'email', 'saleTimestamp', 'freeTrialEndsAt'] as const) {
    assert.equal(back[k], ev[k], k);
  }
  assert.deepEqual(back.urlParams, { via: 'code' });
});

test('later notifications move gumroad_state; a sale or unknown kind does not', () => {
  assert.equal(gumroadStateAfter('recurring_charge'), 'renewed');
  assert.equal(gumroadStateAfter('cancellation'), 'cancelled');
  assert.equal(gumroadStateAfter('subscription_ended'), 'ended');
  assert.equal(gumroadStateAfter('restarted'), 'restarted');
  assert.equal(gumroadStateAfter('refund'), 'refunded');
  assert.equal(gumroadStateAfter('dispute'), 'disputed');
  assert.equal(gumroadStateAfter('sale'), null);
  assert.equal(gumroadStateAfter('other'), null);
});

test('a creator product only goes on a creator space, a clan plan only on a clan', () => {
  assert.equal(attachTargetProblem('creator', { kind: 'creator', status: 'active' }), null);
  assert.equal(attachTargetProblem('plan', { kind: 'clan', status: 'active' }), null);
  assert.match(attachTargetProblem('creator', { kind: 'clan', status: 'active' }) ?? '', /creator space/);
  assert.match(attachTargetProblem('plan', { kind: 'creator', status: 'active' }) ?? '', /only go on a clan/);
  assert.match(attachTargetProblem('supporter', { kind: 'clan', status: 'active' }) ?? '', /person/);
  assert.match(attachTargetProblem('bogus', { kind: 'clan' }) ?? '', /Unknown/);
});

test('an archived space is refused; a suspended one may take it as the webhook would', () => {
  assert.match(attachTargetProblem('plan', { kind: 'clan', status: 'archived' }) ?? '', /archived/);
  assert.equal(attachTargetProblem('plan', { kind: 'clan', status: 'suspended' }), null);
});

test('replacing a paid plan or another membership needs staff to confirm', () => {
  const free = { planIsFree: true, gumroadSubscriptionId: null };
  assert.equal(replaceProblem(free, 'sub-1', false), null, 'a free space with no membership is clear');
  assert.match(replaceProblem({ planIsFree: false, gumroadSubscriptionId: null }, 'sub-1', false) ?? '', /paid plan/);
  assert.match(replaceProblem({ planIsFree: false, gumroadSubscriptionId: 'sub-old' }, 'sub-1', false) ?? '', /sub-old/);
  // A free space still pointing at an old ended membership is also asked: the old id gets overwritten.
  assert.match(replaceProblem({ planIsFree: true, gumroadSubscriptionId: 'sub-old' }, 'sub-1', false) ?? '', /sub-old/);
  assert.equal(replaceProblem({ planIsFree: false, gumroadSubscriptionId: 'sub-old' }, 'sub-1', true), null, 'confirmed');
});

test('notes are trimmed, capped, and empty means none', () => {
  assert.equal(cleanNote('  refunded  '), 'refunded');
  assert.equal(cleanNote('   '), null);
  assert.equal(cleanNote(42), null);
  assert.equal(cleanNote('x'.repeat(MAX_NOTE + 50))?.length, MAX_NOTE);
});
