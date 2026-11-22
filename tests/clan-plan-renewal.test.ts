import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renewingClanPlan } from '../src/lib/clanPlanRenewal';

test('a paid plan with a live membership still renews', () => {
  assert.equal(renewingClanPlan({ plan: 'silver', gumroadSubscriptionId: 'sub_1', cancelAtPeriodEnd: false }), 'sub_1');
});

test('a cancelled plan only runs out its term, so it does not count', () => {
  assert.equal(renewingClanPlan({ plan: 'silver', gumroadSubscriptionId: 'sub_1', cancelAtPeriodEnd: true }), null);
});

test('no membership, or a free plan, never blocks', () => {
  assert.equal(renewingClanPlan({ plan: 'silver', gumroadSubscriptionId: null, cancelAtPeriodEnd: false }), null);
  assert.equal(renewingClanPlan({ plan: 'free', gumroadSubscriptionId: 'sub_1', cancelAtPeriodEnd: false }), null);
});
