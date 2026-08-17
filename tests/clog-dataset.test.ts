// Collection-log catalogue (lib/clogDataset) — the page index every ingest checks against, and the
// whole-log grouping that turns a flat "everything you own" transmit into per-page rows.
//
// Run: npx tsx --test tests/clog-dataset.test.ts
// (tsx, not native type-stripping: the module imports the catalogue through the `@/` alias.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clogPageIndex,
  clogPageItems,
  clogPageNames,
  clogTotalSlots,
  groupObtainedItems,
} from '../src/lib/clogDataset.ts';

/** Two ids that really are on the named page, so the test moves with the catalogue. */
function firstItemsOf(page: string, n: number): number[] {
  return clogPageItems(page).slice(0, n).map((i) => i.id);
}

test('the catalogue is loaded and self-consistent', () => {
  const index = clogPageIndex();
  assert.ok(index.size > 100, `expected a real catalogue, got ${index.size} pages`);
  assert.equal(index.size, clogPageNames().length);
  assert.ok(clogTotalSlots() > 1000, 'the log has well over a thousand slots');
});

test('groupObtainedItems: an obtained item lands on its page, with its quantity', () => {
  const page = clogPageNames()[0];
  const [a, b] = firstItemsOf(page, 2);
  const { pages, unknown } = groupObtainedItems([
    { id: a, quantity: 3 },
    { id: b, quantity: 1 },
  ]);

  assert.equal(unknown, 0);
  assert.deepEqual(pages.get(page), [
    { itemId: a, quantity: 3 },
    { itemId: b, quantity: 1 },
  ]);
  // Every page is present, most of them empty — "synced, you have none of it" is an answer the
  // caller needs, and it's what lets a re-sync clear rows it no longer justifies.
  assert.equal(pages.size, clogPageIndex().size);
  const withRows = [...pages.values()].filter((rows) => rows.length > 0);
  assert.ok(withRows.length >= 1);

  // Nothing is invented: any page that carries one of these ids genuinely lists it. (Several pages
  // legitimately share an item — a clue-scroll reward or a pet — which is why this, and not "only
  // one page may carry it", is the real invariant.)
  const index = clogPageIndex();
  for (const [name, rows] of pages) {
    for (const row of rows) {
      assert.ok(index.get(name)?.has(row.itemId), `${name} was given an item it doesn't list`);
    }
  }
});

test('groupObtainedItems: a shared item lands on every page it belongs to', () => {
  // Pets sit under their boss AND under "All Pets" — the game shows both as obtained, so we do too.
  const petPage = clogPageNames().find((p) => p === 'All Pets');
  assert.ok(petPage, 'the catalogue should carry an All Pets page');
  const pet = clogPageItems(petPage!)[0].id;

  const { pages } = groupObtainedItems([{ id: pet, quantity: 1 }]);
  const carrying = [...pages.entries()].filter(([, rows]) => rows.some((r) => r.itemId === pet));
  assert.ok(carrying.length >= 1);
  assert.ok(carrying.some(([name]) => name === 'All Pets'));
  // Whatever pages hold it, each holds it exactly once.
  for (const [, rows] of carrying) {
    assert.equal(rows.filter((r) => r.itemId === pet).length, 1);
  }
});

test('groupObtainedItems: unknown ids are counted, never placed', () => {
  const page = clogPageNames()[0];
  const [known] = firstItemsOf(page, 1);
  const { pages, unknown } = groupObtainedItems([
    { id: known, quantity: 1 },
    { id: 99_999_999, quantity: 1 }, // an item Jagex added since the last `npm run data:clog`
  ]);
  assert.equal(unknown, 1);
  const placed = [...pages.values()].flat();
  assert.ok(!placed.some((r) => r.itemId === 99_999_999));
});

test('groupObtainedItems: a repeated id produces one row, with the last quantity', () => {
  const page = clogPageNames()[0];
  const [id] = firstItemsOf(page, 1);
  const { pages } = groupObtainedItems([
    { id, quantity: 1 },
    { id, quantity: 7 },
  ]);
  assert.deepEqual(pages.get(page), [{ itemId: id, quantity: 7 }]);
});

test('groupObtainedItems: nothing obtained still returns every page', () => {
  const { pages, unknown } = groupObtainedItems([]);
  assert.equal(unknown, 0);
  assert.equal(pages.size, clogPageIndex().size);
  assert.ok([...pages.values()].every((rows) => rows.length === 0));
});
