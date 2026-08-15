// The task library's shape panel (lib/libraryShape) — the distribution and defects a curator
// needs to see before generating a board.
//
// Run: node --experimental-strip-types --test tests/library-shape.test.ts
// (lib/libraryShape imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { libraryShape, type ShapeBand, type ShapeTask } from '../src/lib/libraryShape.ts';

const BANDS: ShapeBand[] = [
  { key: 'troll', label: 'Troll' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
  { key: 'ultra', label: 'Ultra' },
];

let nextId = 1;
const task = (over: Partial<ShapeTask> = {}): ShapeTask => ({
  id: nextId++,
  label: `Task ${nextId}`,
  points: 120,
  category: 'Boss KC',
  tier: 'medium',
  tileType: 'kill',
  ...over,
});

const many = (n: number, over: Partial<ShapeTask> = {}) =>
  Array.from({ length: n }, () => task(over));

const findingKeys = (tasks: ShapeTask[]) => libraryShape(tasks, BANDS).findings.map((f) => f.key);

test('an empty library reports nothing rather than inventing problems', () => {
  const shape = libraryShape([], BANDS);
  assert.equal(shape.total, 0);
  assert.deepEqual(shape.findings, []);
  assert.equal(shape.thinnest, null);
  assert.equal(shape.tiers.length, BANDS.length);
  assert.ok(shape.tiers.every((t) => t.count === 0 && t.share === 0));
});

test('tiers carry their count, share and the point range actually present', () => {
  const shape = libraryShape(
    [
      task({ tier: 'easy', points: 20 }),
      task({ tier: 'easy', points: 60 }),
      task({ tier: 'medium', points: 120 }),
      task({ tier: 'medium', points: 130 }),
    ],
    BANDS,
  );
  const easy = shape.tiers.find((t) => t.key === 'easy')!;
  assert.equal(easy.count, 2);
  assert.equal(easy.share, 0.5);
  assert.deepEqual(easy.range, { min: 20, max: 60 });
  assert.equal(shape.tiers.find((t) => t.key === 'hard')!.range, null);
});

test('categories and kinds are tallied biggest first', () => {
  const shape = libraryShape(
    [
      task({ category: 'Slayer', tileType: 'drop' }),
      task({ category: 'Slayer', tileType: 'drop' }),
      task({ category: 'Raids', tileType: 'timed' }),
    ],
    BANDS,
  );
  assert.deepEqual(shape.categories, [
    { key: 'Slayer', count: 2 },
    { key: 'Raids', count: 1 },
  ]);
  assert.equal(shape.kinds[0].key, 'drop');
});

test('an uncategorised task is counted in the total but not as a category', () => {
  const shape = libraryShape([task({ category: null }), task({ category: 'Slayer' })], BANDS);
  assert.equal(shape.total, 2);
  assert.deepEqual(shape.categories, [{ key: 'Slayer', count: 1 }]);
});

test('the same task twice is a warning, and names the rows', () => {
  const a = task({ id: 101, label: 'Abyssal whip' });
  const b = task({ id: 102, label: 'abyssal  whip' }); // different casing and spacing
  const shape = libraryShape([a, b, task({ label: 'Dragon boots' })], BANDS);
  const dupe = shape.findings.find((f) => f.key === 'duplicates')!;
  assert.equal(dupe.level, 'warn');
  assert.match(dupe.message, /1 task is in the pool twice/);
  assert.deepEqual(dupe.ids.sort(), [101, 102]);
});

test('a task worth nothing is a warning', () => {
  const shape = libraryShape([task({ id: 7, points: 0 }), ...many(4)], BANDS);
  const zero = shape.findings.find((f) => f.key === 'zero-points')!;
  assert.equal(zero.level, 'warn');
  assert.deepEqual(zero.ids, [7]);
});

test('a band nothing falls into is a warning naming the band', () => {
  const shape = libraryShape(many(6, { tier: 'medium' }), BANDS);
  const empty = shape.findings.find((f) => f.key === 'empty-bands')!;
  assert.equal(empty.level, 'warn');
  assert.match(empty.message, /Troll, Easy, Hard, Ultra have no tasks/);
});

test('a thin band states the repeat ceiling as a fact', () => {
  const shape = libraryShape([...many(20, { tier: 'medium' }), ...many(4, { tier: 'ultra' })], BANDS);
  const thin = shape.findings.find((f) => f.key === 'thin-ultra')!;
  assert.equal(thin.level, 'info');
  assert.match(thin.message, /Ultra holds 4 tasks — ask a board for more than 4 and one repeats/);
});

test('a comfortable band is not flagged as thin', () => {
  assert.equal(
    findingKeys([...many(20, { tier: 'medium' }), ...many(9, { tier: 'ultra' })]).includes('thin-ultra'),
    false,
  );
});

test('a lopsided pool is flagged once it is big enough to mean something', () => {
  const lopsided = [...many(8, { category: 'Slayer' }), ...many(4, { category: 'Raids' })];
  const finding = libraryShape(lopsided, BANDS).findings.find((f) => f.key === 'lopsided')!;
  assert.match(finding.message, /67% of the pool is Slayer/);

  // The same ratio in a five-task library is just a small library, not a lean.
  const tiny = [...many(4, { category: 'Slayer' }), task({ category: 'Raids' })];
  assert.equal(findingKeys(tiny).includes('lopsided'), false);
});

test('an evenly spread pool raises no lean', () => {
  const even = [
    ...many(5, { category: 'Slayer' }),
    ...many(5, { category: 'Raids' }),
    ...many(5, { category: 'Skilling' }),
  ];
  assert.equal(findingKeys(even).includes('lopsided'), false);
});

test('thinnest is the smallest band that holds anything, ignoring empty ones', () => {
  const shape = libraryShape(
    [...many(20, { tier: 'medium' }), ...many(3, { tier: 'ultra' }), ...many(8, { tier: 'easy' })],
    BANDS,
  );
  assert.equal(shape.thinnest?.key, 'ultra');
  assert.equal(shape.thinnest?.count, 3);
});

test('warnings sort ahead of information', () => {
  const shape = libraryShape(
    [task({ id: 1, label: 'Dup', points: 0 }), task({ id: 2, label: 'Dup' }), ...many(3, { tier: 'ultra' })],
    BANDS,
  );
  const levels = shape.findings.map((f) => f.level);
  assert.equal(levels[0], 'warn');
  assert.ok(levels.indexOf('info') === -1 || levels.indexOf('info') > levels.lastIndexOf('warn'));
});

test('shares always add up to the whole library', () => {
  const tasks = [...many(3, { tier: 'easy' }), ...many(5, { tier: 'medium' }), ...many(2, { tier: 'hard' })];
  const shape = libraryShape(tasks, BANDS);
  const sum = shape.tiers.reduce((n, t) => n + t.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `shares summed to ${sum}`);
  assert.equal(shape.tiers.reduce((n, t) => n + t.count, 0), tasks.length);
});

test('a task whose tier is null is counted in the total but sits in no band', () => {
  const shape = libraryShape([task({ tier: null }), ...many(3, { tier: 'medium' })], BANDS);
  assert.equal(shape.total, 4);
  assert.equal(shape.tiers.reduce((n, t) => n + t.count, 0), 3);
});
