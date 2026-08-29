// The freemium switch (lib/entitlements + lib/plans): generous now, gated when enforced.
//
// Run: npx tsx --test tests/entitlements.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clanCan, freemiumEnforced, minPlanNameFor } from '../src/lib/entitlements.ts';
import { PLANS, planHasCapability } from '../src/lib/plans.ts';

test('generous phase (default): everyone can do everything', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.equal(freemiumEnforced(), false);
  assert.equal(clanCan('free', 'host-multi-clan'), true, 'a free clan can host now');
  assert.equal(clanCan(null, 'custom-domain'), true);
  assert.equal(clanCan(undefined, 'discord-notifications'), true);
});

test('enforced: capabilities gate by tier', () => {
  process.env.FREEMIUM_ENFORCED = 'true';
  try {
    // host-multi-clan is Silver+.
    assert.equal(clanCan('free', 'host-multi-clan'), false);
    assert.equal(clanCan('bronze', 'host-multi-clan'), false);
    assert.equal(clanCan('silver', 'host-multi-clan'), true);
    assert.equal(clanCan('gold', 'host-multi-clan'), true);
    // discord-notifications is Bronze+.
    assert.equal(clanCan('free', 'discord-notifications'), false);
    assert.equal(clanCan('bronze', 'discord-notifications'), true);
    // custom-domain is Gold only.
    assert.equal(clanCan('silver', 'custom-domain'), false);
    assert.equal(clanCan('gold', 'custom-domain'), true);
    // custom sits above gold → has everything.
    assert.equal(clanCan('custom', 'custom-domain'), true);
  } finally {
    delete process.env.FREEMIUM_ENFORCED;
  }
});

test('planHasCapability + upsell copy line up with the model', () => {
  assert.equal(planHasCapability(PLANS.free, 'host-multi-clan'), false);
  assert.equal(planHasCapability(PLANS.silver, 'host-multi-clan'), true);
  assert.equal(minPlanNameFor('host-multi-clan'), 'Silver');
  assert.equal(minPlanNameFor('custom-domain'), 'Gold');
});
