// Pet groups (lib/petGroups) — every id/name still matches the collection log's "All Pets" page, and
// 'all' is exactly that page, so a dataset rebuild can't leave the one-click fill stale.
//
// Run: node --experimental-strip-types --test tests/pet-groups.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PET_GROUPS } from '../src/lib/petGroups.ts';
import { MAX_TRACKED_ITEMS } from '../src/lib/tileItemLimits.ts';

const clog = JSON.parse(readFileSync(new URL('../src/data/clog.json', import.meta.url), 'utf8'));
const allPets: { id: number; name: string }[] = clog.activities['All Pets'];
const byId = new Map(allPets.map((p) => [p.id, p.name]));

test('every grouped pet is on the All Pets page with the same name', () => {
  for (const g of PET_GROUPS) {
    assert.ok(g.items.length > 0, g.key);
    assert.ok(g.items.length <= MAX_TRACKED_ITEMS, `${g.key} fits on one tile`);
    assert.equal(new Set(g.items.map((i) => i.id)).size, g.items.length, `${g.key} has no duplicates`);
    for (const i of g.items) assert.equal(byId.get(i.id), i.name, `${g.key}: ${i.name} #${i.id}`);
  }
});

test("'all' is the whole All Pets page", () => {
  const all = PET_GROUPS.find((g) => g.key === 'all')!;
  assert.deepEqual(new Set(all.items.map((i) => i.id)), new Set(byId.keys()));
});
