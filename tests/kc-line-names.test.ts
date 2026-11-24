// The boss names the game's own count lines use resolve to a hiscores key (lib/pluginStats), so the
// plugin's live KC moves SOTW/BOTW and stat tiles at once instead of waiting for the hiscores sweep.
// "Your Lunar Chest count is: 51." and "Your Barrows chest count is: 162." once resolved to nothing.
// Run: npx tsx --test tests/kc-line-names.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bossKeyForName } from '../src/lib/pluginStats';

test('count-line names resolve to their hiscores key', () => {
  assert.equal(bossKeyForName('Lunar Chest'), 'lunarChests');
  assert.equal(bossKeyForName('Barrows chest'), 'barrows');
  assert.equal(bossKeyForName('Scurrius'), 'scurrius');
  assert.equal(bossKeyForName('Tombs of Amascut: Expert Mode'), 'tombsOfAmascutExpertMode');
});
