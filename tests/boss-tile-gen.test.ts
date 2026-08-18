import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bossCategoryViews,
  bossKcRows,
  npcKillRows,
  parseNpcList,
  parsePoints,
  parseThresholds,
  monsterCategoryViews,
  knownMonsterNames,
} from '../src/lib/bossTileGen.ts';
import { BOSSES } from '../src/lib/constants.ts';

// Bulk authoring is where a mistake is expensive: eighty tiles land on a board at once, and the
// wrong `trackedStat` on all of them is eighty tiles that will never auto-complete. So the shape of
// a generated row is pinned here rather than discovered on a live event.

test('every categorised boss key is a real boss', () => {
  const known = new Set(BOSSES.map((b) => b.key));
  const listed = bossCategoryViews().flatMap((c) => c.bosses.map((b) => b.key));
  assert.deepEqual(listed.filter((k) => !known.has(k)), []);
});

test('no boss is missing from the picker, and none is offered twice', () => {
  const listed = bossCategoryViews().flatMap((c) => c.bosses.map((b) => b.key));
  // Every boss must be reachable: one filed nowhere would be invisible to the host, which is worse
  // than one filed vaguely — hence the Other bucket.
  assert.equal(new Set(listed).size, BOSSES.length);
  assert.equal(listed.length, BOSSES.length);
});

test('thresholds parse the way people type them', () => {
  assert.deepEqual(parseThresholds('25, 50, 100, 200'), [25, 50, 100, 200]);
  assert.deepEqual(parseThresholds('100 25\n50'), [25, 50, 100]);
  // Duplicates are the same board asked for twice.
  assert.deepEqual(parseThresholds('25, 25, 50'), [25, 50]);
  // Anything non-numeric means we misread the field — refuse rather than guess a subset.
  assert.deepEqual(parseThresholds('25, fifty'), []);
  assert.deepEqual(parseThresholds('0'), []);
});

test('one point value covers every threshold, a list must line up', () => {
  assert.deepEqual(parsePoints('10', 4), [10, 10, 10, 10]);
  assert.deepEqual(parsePoints('10, 20, 40, 80', 4), [10, 20, 40, 80]);
  // A mismatch is not something to paper over: reusing the last value would price a 200-KC tile
  // like a 25-KC one, silently.
  assert.equal(parsePoints('10, 20', 4), 'mismatch');
  assert.equal(parsePoints('', 4), null);
});

test('a boss × threshold grid comes out boss-major, one tile each', () => {
  const rows = bossKcRows({
    bosses: [{ key: 'zulrah', label: 'Zulrah' }, { key: 'vorkath', label: 'Vorkath' }],
    thresholds: [25, 50],
    points: null,
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.label), [
    '25 Zulrah KC', '50 Zulrah KC', '25 Vorkath KC', '50 Vorkath KC',
  ]);
});

test('a KC tile is stat-tracked against the hiscores key, not the label', () => {
  const [row] = bossKcRows({
    bosses: [{ key: 'chambersOfXericChallengeMode', label: 'CoX: CM' }],
    thresholds: [10],
    points: [5],
  });
  assert.equal(row.trackedStat, 'chambersOfXericChallengeMode');
  assert.equal(row.statType, 'boss');
  assert.equal(row.statGoal, 10);
  assert.equal(row.points, 5);
  // Both filters: the broad one and the boss's own.
  assert.equal(row.category, 'Bossing, CoX: CM');
});

test('points follow the threshold they were written against', () => {
  const rows = bossKcRows({
    bosses: [{ key: 'zulrah', label: 'Zulrah' }, { key: 'vorkath', label: 'Vorkath' }],
    thresholds: [25, 100],
    points: [10, 40],
  });
  assert.deepEqual(rows.map((r) => r.points), [10, 40, 10, 40]);
});

test('slayer monsters become kill tiles, since the hiscores never counted them', () => {
  const rows = npcKillRows({
    npcs: ['Abyssal demon', 'Gargoyle'],
    thresholds: [100],
    points: null,
    category: 'Slayer',
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tileType, 'kill');
  assert.deepEqual(rows[0].targetNpcs, ['Abyssal demon']);
  assert.equal(rows[0].requiredAmount, 100);
  assert.equal(rows[0].label, '100 Abyssal demon');
  assert.equal(rows[0].statGoal, undefined);
});

test('a pasted NPC list splits on lines and commas, never on spaces', () => {
  assert.deepEqual(parseNpcList('Abyssal demon, Dark beast\nSmoke devil'), [
    'Abyssal demon', 'Dark beast', 'Smoke devil',
  ]);
  assert.deepEqual(parseNpcList('Cow, Cow, '), ['Cow']);
});

// ---- slayer monsters ----------------------------------------------------------------------------

test('slayer categories carry real monsters with in-game names', () => {
  const cats = monsterCategoryViews();
  assert.ok(cats.length > 50, 'expected the wiki dataset to hold the task groups');
  const abyssal = cats.find((c) => c.label === 'Abyssal Demons');
  assert.ok(abyssal, 'Abyssal Demons should be a task group');
  // The plain monster leads its group — a host wants a tile for "Abyssal demon" first, not for the
  // Sire's respiratory system, which is what an unordered list put at the top.
  assert.equal(abyssal?.monsters[0].name, 'Abyssal demon');
  assert.equal(abyssal?.monsters[0].slayerLevel, 85);
});

test('monster names carry no wiki disambiguation, which a kill tile could never match', () => {
  for (const name of knownMonsterNames()) {
    assert.ok(!name.includes('('), `"${name}" still carries a wiki suffix`);
  }
});
