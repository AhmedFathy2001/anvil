import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/tileLibrarySeed.json';

// The seed is what migration 0140 loaded into the Anvil task library, and what the library's tests
// and fixtures still lean on — so it has to stay a set of tasks that can actually complete.

test('every seeded task can actually complete as written', () => {
  type SeedTask = { key: string; config: { tileType?: string; items?: unknown[]; requiredAmount?: number; targetNpcs?: string[] } };
  for (const t of (seed as { tasks: SeedTask[] }).tasks) {
    const c = t.config;
    assert.notEqual(c.tileType, 'stat', `${t.key}: "stat" is not a tile type the importer accepts`);
    if (c.tileType === 'diary') assert.ok(c.targetNpcs?.length, `${t.key}: a diary tile needs the diary it is for`);
    if (c.tileType === 'drop' && (c.items?.length ?? 0) > 1) {
      assert.equal(c.requiredAmount, 1, `${t.key}: "any of these" needs requiredAmount, or it imports as needing every item`);
    }
  }
});
