import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/tileLibrarySeed.json';
import { BUILTIN_PRESETS, STARTER_BOARDS, starterRows } from '../src/lib/eventPresets.ts';

const seedKeys = new Set((seed as { tasks: { key: string }[] }).tasks.map((t) => t.key));

test('every starter board names 25 different tasks that exist in the seed', () => {
  for (const [name, keys] of Object.entries(STARTER_BOARDS)) {
    assert.equal(keys.length, 25, `${name} fills a 5×5`);
    assert.equal(new Set(keys).size, 25, `${name} repeats a task`);
    for (const k of keys) assert.ok(seedKeys.has(k), `${name}: "${k}" is not in tileLibrarySeed.json`);
  }
});

test('a starter board fills every square, with easy and hard spread out', () => {
  const rows = starterRows('mixed');
  assert.equal(rows.length, 25);
  assert.ok(rows.every((r) => r && r.label && r.tileType), 'every square has a set-up tile');
  // The top row is not just the five cheapest tasks.
  const sorted = rows.map((r) => r.points ?? 0).sort((a, b) => a - b);
  const topRow = rows.slice(0, 5).map((r) => r.points ?? 0);
  assert.ok(Math.max(...topRow) > sorted[4], 'top row mixes difficulty');
});

test('the starter presets carry their tiles and come first', () => {
  const starters = BUILTIN_PRESETS.filter((p) => p.key.startsWith('starter-'));
  assert.equal(starters.length, 4);
  assert.ok(BUILTIN_PRESETS[0].key.startsWith('starter-'));
  for (const p of starters) {
    assert.equal(p.csv?.rows.length, 25);
    assert.deepEqual(p.csv?.labels, p.csv?.rows.map((r) => r.label));
  }
});

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
