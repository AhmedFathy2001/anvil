// Yearly pricing for clan and creator tiers (lib/billingInterval): Supporter's rule, a year = ten months.
//
// Run: node --import tsx --test tests/billing-interval.test.ts   (no database)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseBillingInterval, priceLine, withBilling, withRef, yearlyPerMonthUsd, yearlyPriceUsd } from '../src/lib/billingInterval';
import { SUPPORTER_TIERS } from '../src/lib/supporterTiers';
import { PLANS, checkoutUrl, checkoutUrlWithRef, planForGumroadProduct } from '../src/lib/plans';
import { CREATOR_PLANS, creatorCheckoutUrl, creatorPlanForGumroadProduct } from '../src/lib/creatorCatalog';
import { gumroadPurchase, withYearlyRecurrence } from '../src/lib/billingCatalog';

test('the yearly rule is the Supporter one: ten months for a year', () => {
  for (const t of Object.values(SUPPORTER_TIERS)) assert.equal(yearlyPriceUsd(t.monthlyUsd), t.yearlyUsd);
  assert.equal(yearlyPriceUsd(2.99), 29.9);
  assert.equal(yearlyPriceUsd(6.99), 69.9);
  assert.equal(yearlyPriceUsd(14.99), 149.9);
  assert.equal(yearlyPriceUsd(0), 0);
  assert.equal(yearlyPriceUsd(null), null);
  assert.equal(yearlyPerMonthUsd(2.99), 2.49);
  assert.equal(priceLine(2.99, 'monthly'), '$2.99/mo');
  assert.equal(priceLine(2.99, 'yearly'), '$29.90/yr · $2.49/mo');
});

test('?billing= parsing and links', () => {
  assert.equal(parseBillingInterval('yearly'), 'yearly');
  assert.equal(parseBillingInterval(['yearly']), 'yearly');
  assert.equal(parseBillingInterval('annual'), 'monthly');
  assert.equal(parseBillingInterval(undefined), 'monthly');
  assert.equal(withBilling('/pricing#creators', 'yearly'), '/pricing?billing=yearly#creators');
  assert.equal(withBilling('/pricing?billing=yearly#creators', 'monthly'), '/pricing#creators');
  assert.equal(withBilling('/clans/new?plan=gold', 'yearly'), '/clans/new?plan=gold&billing=yearly');
  assert.equal(withRef('https://g/l/x', 'a b'), 'https://g/l/x?ref=a%20b');
  assert.equal(withRef(null, 'r'), null);
});

test('yearly checkouts and products: own env slots, unset = no yearly button, same tier on purchase', () => {
  const keys = ['GUMROAD_URL_SILVER', 'GUMROAD_URL_SILVER_YEARLY', 'GUMROAD_PRODUCT_SILVER_YEARLY', 'GUMROAD_URL_CREATOR_GOLD_YEARLY', 'GUMROAD_PRODUCT_CREATOR_GOLD_YEARLY'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    process.env.GUMROAD_URL_SILVER = 'https://g/l/silver';
    assert.equal(checkoutUrl(PLANS.silver, 'yearly'), null);
    assert.equal(creatorCheckoutUrl(CREATOR_PLANS.creator_gold, 'yearly'), null);

    process.env.GUMROAD_URL_SILVER_YEARLY = 'https://g/l/silver-y';
    process.env.GUMROAD_PRODUCT_SILVER_YEARLY = 'prod-silver-y';
    process.env.GUMROAD_URL_CREATOR_GOLD_YEARLY = 'https://g/l/cgold-y';
    process.env.GUMROAD_PRODUCT_CREATOR_GOLD_YEARLY = 'prod-cgold-y';
    assert.equal(checkoutUrlWithRef(PLANS.silver, 'r1', 'yearly'), 'https://g/l/silver-y?ref=r1');
    assert.equal(checkoutUrlWithRef(PLANS.silver, 'r1'), 'https://g/l/silver?ref=r1');
    assert.equal(creatorCheckoutUrl(CREATOR_PLANS.creator_gold, 'yearly'), 'https://g/l/cgold-y');
    assert.equal(planForGumroadProduct('prod-silver-y')?.id, 'silver');
    assert.equal(creatorPlanForGumroadProduct('prod-cgold-y')?.id, 'creator_gold');
    assert.equal(gumroadPurchase({ productId: 'prod-cgold-y', tier: null })?.tier.id, 'creator_gold');
    // A yearly product's ping with no recurrence is still a one-year term; others pass through.
    assert.equal(withYearlyRecurrence({ productId: 'prod-silver-y', recurrence: null }).recurrence, 'yearly');
    assert.equal(withYearlyRecurrence({ productId: 'prod-silver-y', recurrence: 'monthly' }).recurrence, 'monthly');
    assert.equal(withYearlyRecurrence({ productId: 'other', recurrence: null }).recurrence, null);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
