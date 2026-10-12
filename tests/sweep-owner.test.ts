// Who fetches the hiscores (lib/sweepOwner). Anything but an explicit "forge" keeps it in this app —
// a typo must never hand the sweep to a service that may not be running.
//
// Run: npx tsx --test tests/sweep-owner.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { declaredSweepOwner } from '../src/lib/sweepOwner.ts';

test('only an explicit "forge" hands fetching to Forge', () => {
  assert.equal(declaredSweepOwner({}), 'site');
  assert.equal(declaredSweepOwner({ STATS_SWEEP_OWNER: '' }), 'site');
  assert.equal(declaredSweepOwner({ STATS_SWEEP_OWNER: 'site' }), 'site');
  assert.equal(declaredSweepOwner({ STATS_SWEEP_OWNER: 'forg' }), 'site');
  assert.equal(declaredSweepOwner({ STATS_SWEEP_OWNER: 'forge' }), 'forge');
  assert.equal(declaredSweepOwner({ STATS_SWEEP_OWNER: '  Forge ' }), 'forge');
});
