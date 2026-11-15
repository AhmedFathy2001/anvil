// What the admin Plan page may say a plan includes (lib/plans truthfulFeatures).
// Run: node --experimental-strip-types --test tests/plans.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, truthfulFeatures } from '../src/lib/plans.ts';

test('Discord posts are not listed as a paid feature (they work on Free)', () => {
  for (const id of ['bronze', 'silver', 'gold'] as const) {
    assert.ok(!truthfulFeatures(PLANS[id]).some((f) => /discord/i.test(f)), id);
  }
});

test('a gated feature is still named, in words that match what is gated', () => {
  assert.ok(truthfulFeatures(PLANS.silver).includes('Host events together with other clans'));
  assert.ok(truthfulFeatures(PLANS.gold).includes('Custom domain'));
});
