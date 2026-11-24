// The automatic "used it" matcher (lib/guideSetupMatch): which guide setup the plugin's pushed worn
// gear matches when a kill on the guide's boss lands. Pure.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AUTO_USED_MIN_SLOTS, matchWornSetup, type WornSetup } from '../src/lib/guideSetupMatch.ts';

const RANGED: WornSetup = { key: 'advanced-ranged-0', gear: { weapon: 20997, head: 1, body: 2, legs: 3, cape: 4, neck: 5, feet: 6, ring: 7 }, alts: { cape: [40] } };
const MAGIC: WornSetup = { key: 'advanced-magic-1', gear: { weapon: 22323, head: 11, body: 12, legs: 13, cape: 14, neck: 15, feet: 16, ring: 17 } };

test('every slot worn: that setup', () => {
  assert.equal(matchWornSetup([20997, 1, 2, 3, 4, 5, 6, 7], [MAGIC, RANGED]), 'advanced-ranged-0');
});

test('most slots worn (75%) is enough; fewer is not', () => {
  assert.equal(matchWornSetup([20997, 1, 2, 3, 4, 5], [RANGED]), 'advanced-ranged-0'); // 6 of 8
  assert.equal(matchWornSetup([20997, 1, 2, 3, 4], [RANGED]), null); // 5 of 8
});

test('the weapon must be worn when the setup names one', () => {
  assert.equal(matchWornSetup([1, 2, 3, 4, 5, 6, 7], [RANGED]), null);
});

test('a listed fallback counts for its slot, and equivalents (a charged variant) count too', () => {
  assert.equal(matchWornSetup([20997, 1, 2, 3, 40, 5, 6, 7], [RANGED]), 'advanced-ranged-0');
  const same = (id: number) => (id === 99 ? [99, 20997] : [id]);
  assert.equal(matchWornSetup([99, 1, 2, 3, 4, 5, 6, 7], [RANGED], same), 'advanced-ranged-0');
  assert.equal(matchWornSetup([99, 1, 2, 3, 4, 5, 6, 7], [RANGED]), null);
});

test('the better match wins; a thin setup never matches', () => {
  const mixed: WornSetup = { key: 'mid-0', gear: { weapon: 20997, head: 11, body: 12, legs: 3 } };
  assert.equal(matchWornSetup([20997, 11, 12, 3, 4, 5, 6, 7], [RANGED, mixed]), 'mid-0'); // 4/4 beats 6/8
  const thin: WornSetup = { key: 'thin', gear: { weapon: 20997, head: 1 } };
  assert.ok(Object.keys(thin.gear).length < AUTO_USED_MIN_SLOTS);
  assert.equal(matchWornSetup([20997, 1], [thin]), null);
});

test('nothing worn, nothing matched', () => {
  assert.equal(matchWornSetup([], [RANGED, MAGIC]), null);
});
