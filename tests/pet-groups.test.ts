// Pet groups (lib/petGroups) — every id/name still matches the collection log's "All Pets" page, and
// 'all' is exactly that page, so a dataset rebuild can't leave the one-click fill stale. And the
// pet → hiscores boss map a pet hunt's kill count is built from (PET_BOSS_KEYS).
//
// Run: npx tsx --test tests/pet-groups.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BOSSES } from '../src/lib/constants.ts';
import { PET_BOSS_KEYS, PET_GROUPS } from '../src/lib/petGroups.ts';
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

// ── Where each pet comes from (PET_BOSS_KEYS) ────────────────────────────────────────────────────

const allPetIds = new Set(allPets.map((p) => p.id));
const bossKeys = new Set(BOSSES.map((b) => b.key));
/** "The Royal Titans" and "Royal Titans", "Kree'Arra" and "Kree'arra" are the same boss. */
const plain = (s: string) => s.trim().toLowerCase().replace(/^the\s+/, '');
/** The log pages a pet sits on, other than the two that list pets as pets. */
const pagesOf = (id: number) =>
  Object.entries(clog.activities as Record<string, { id: number }[]>)
    .filter(([name, items]) => name !== 'All Pets' && name !== 'Skilling Pets' && items.some((i) => i.id === id))
    .map(([name]) => name);

test('every pet boss key is a hiscores boss, and every mapped pet is a pet', () => {
  for (const [id, keys] of Object.entries(PET_BOSS_KEYS)) {
    assert.ok(allPetIds.has(Number(id)), `#${id} is on the All Pets page`);
    assert.ok(keys.length > 0, `#${id} has a boss`);
    assert.equal(new Set(keys).size, keys.length, `#${id} has no duplicate keys`);
    for (const k of keys) assert.ok(bossKeys.has(k), `#${id}: ${k} is a BOSSES key`);
  }
});

test('a mapped pet sits on a boss page of the collection log, and the bosses that page names are mapped', () => {
  let named = 0;
  for (const pet of allPets) {
    const keys = PET_BOSS_KEYS[pet.id];
    const pages = pagesOf(pet.id);
    if (keys) assert.ok(pages.length > 0, `${pet.name} is mapped to a boss but is on no page of its own`);
    // "Callisto and Artio" names two bosses; "Zulrah" names one. A page that names none by its
    // hiscores label (The Inferno, Dagannoth Kings) proves nothing either way.
    for (const page of pages) {
      for (const part of page.split(/\s+and\s+/)) {
        const boss = BOSSES.find((b) => plain(b.label) === plain(part));
        if (!boss) continue;
        named++;
        assert.ok(keys?.includes(boss.key), `${pet.name} is on the ${page} page, so it needs ${boss.key}`);
      }
    }
  }
  // The check above is only worth something while the pages still name most bosses by label.
  assert.ok(named >= 40, `only ${named} pet pages name a hiscores boss`);
});

test('the skilling pets with no boss stay unmapped, so their hunts offer XP instead', () => {
  const skilling = PET_GROUPS.find((g) => g.key === 'skilling')!;
  for (const name of ['Beaver', 'Heron', 'Rock golem', 'Rocky', 'Tangleroot']) {
    const pet = skilling.items.find((p) => p.name === name)!;
    assert.equal(PET_BOSS_KEYS[pet.id], undefined, name);
  }
});
