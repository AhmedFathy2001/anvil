// A game mode's own post filters (lib/modeFilters): rarer drops only, fewer level posts.
// Pure — no database.
//
// Run: npx tsx --test tests/mode-filters.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_MODE_FILTERS,
  dropPassesFloor,
  modeFilterAllows,
  parseModeDropFloor,
  parseModeLevels,
  storedModeDropFloor,
  storedModeLevels,
  type ModeFilters,
} from '../src/lib/modeFilters.ts';
import { DEFAULT_LEVEL_RULES } from '../src/lib/levelRules.ts';
import { modeDropFloorKey, modeLevelsKey } from '../src/lib/worldModes.ts';

const item = { name: 'Thing', qty: 1, value: 100 };
const drop = (extra: Record<string, unknown> = {}) => ({ items: [item], ...extra });
const only99s = { ...DEFAULT_LEVEL_RULES, skillStep: 0, totalStep: 0, maxTotal: false };

test('no filters: every post passes, exactly as before', () => {
  for (const [kind, facts] of [
    ['drop', drop()],
    ['drop', drop({ dropRate: 1 / 50 })],
    ['drop', { items: [item, item] }],
    ['level', { level: 42, skill: 'attack', at99: 0, skills: 23 }],
    ['totalLevel', { total: 500, milestone: 500 }],
    ['pet', {}],
    [undefined, undefined],
  ] as const) {
    assert.equal(modeFilterAllows(kind, facts, NO_MODE_FILTERS), true, String(kind));
  }
});

test('drop floor: a known rate must be at least as rare as 1 in N', () => {
  assert.equal(dropPassesFloor(drop({ dropRate: 1 / 5000 }), 5000), true, 'exactly on the floor posts');
  assert.equal(dropPassesFloor(drop({ dropRate: 1 / 8000 }), 5000), true);
  assert.equal(dropPassesFloor(drop({ dropRate: 1 / 4999 }), 5000), false);
  assert.equal(dropPassesFloor(drop({ dropRate: 1 / 128 }), 5000), false);
});

test('drop floor: always-post items still post', () => {
  assert.equal(dropPassesFloor(drop({ notable: 'loot' }), 5000), true);
  assert.equal(dropPassesFloor(drop({ notable: 'unlock' }), 5000), true);
  assert.equal(dropPassesFloor(drop({ notable: 'loot', guaranteed: true }), 5000), true);
});

test('drop floor: drops with no rate to judge stay quiet', () => {
  assert.equal(dropPassesFloor(drop(), 5000), false, 'posted on value alone');
  assert.equal(dropPassesFloor(drop({ dropRate: null }), 5000), false);
  assert.equal(dropPassesFloor({ items: [item, item], dropRate: 1 / 9000 }, 5000), false, 'a multi-item haul');
  assert.equal(dropPassesFloor(drop({ guaranteed: true, dropRate: 1 }), 5000), false, 'guaranteed');
  assert.equal(dropPassesFloor(null, 5000), false);
});

test('drop floor only touches drops', () => {
  const f: ModeFilters = { dropFloor: 5000, levels: null };
  assert.equal(modeFilterAllows('drop', drop({ dropRate: 1 / 100 }), f), false);
  assert.equal(modeFilterAllows('pet', { dropRate: 1 / 100 }, f), true);
  assert.equal(modeFilterAllows('level', { level: 10 }, f), true);
  assert.equal(modeFilterAllows(undefined, undefined, f), true, 'an old plugin embed has no facts to judge');
});

test('level rules: only the chosen milestones post', () => {
  const f: ModeFilters = { dropFloor: null, levels: only99s };
  assert.equal(modeFilterAllows('level99', { skill: 'attack', at99: 1, skills: 23 }, f), true);
  assert.equal(modeFilterAllows('level', { level: 99 }, f), true);
  assert.equal(modeFilterAllows('level', { level: 70 }, f), false);
  assert.equal(modeFilterAllows('totalLevel', { total: 1000, milestone: 1000 }, f), false);
  assert.equal(modeFilterAllows('totalLevel', { total: 2277, maxed: true }, f), false);
  assert.equal(modeFilterAllows('drop', drop(), f), true, 'level rules leave drops alone');
  assert.equal(modeFilterAllows('quest', { quest: 'Cook' }, f), true);

  const every10: ModeFilters = { dropFloor: null, levels: { ...only99s, skillStep: 10, skillFrom: 50 } };
  assert.equal(modeFilterAllows('level', { level: 60 }, every10), true);
  assert.equal(modeFilterAllows('level', { level: 65 }, every10), false);
});

test('drop floor input: whole positive numbers, blank clears, junk is refused', () => {
  assert.equal(parseModeDropFloor('5000'), 5000);
  assert.equal(parseModeDropFloor('5,000'), 5000);
  assert.equal(parseModeDropFloor(5000), 5000);
  assert.equal(parseModeDropFloor(''), null);
  assert.equal(parseModeDropFloor('  '), null);
  assert.equal(parseModeDropFloor(null), null);
  assert.equal(parseModeDropFloor(undefined), null);
  for (const bad of ['abc', '0', '-5', '1.5', 2.5, 0, 1e12, {}, [], true]) {
    assert.equal(parseModeDropFloor(bad), undefined, JSON.stringify(bad));
  }
});

test('stored values read back, and unreadable ones mean "no override"', () => {
  assert.equal(storedModeDropFloor('5000'), 5000);
  assert.equal(storedModeDropFloor(null), null);
  assert.equal(storedModeDropFloor('junk'), null);
  assert.deepEqual(storedModeLevels(JSON.stringify(only99s)), only99s);
  assert.equal(storedModeLevels(null), null);
  assert.equal(storedModeLevels(''), null);
  assert.equal(storedModeLevels('not json'), null);
  assert.equal(storedModeLevels('[1,2]'), null);
});

test('level rules input is normalised to the level half only', () => {
  const out = parseModeLevels({ ninetyNines: true, skillStep: 500, skillFrom: -3, totalXpStepM: 50, extra: 1 });
  assert.ok(out);
  assert.equal(out.skillStep, 98, 'clamped');
  assert.equal(out.skillFrom, 1, 'clamped');
  assert.equal('totalXpStepM' in out, false, 'XP rules are not part of a mode filter');
  assert.equal('extra' in out, false);
  assert.equal(parseModeLevels(null), null);
  assert.equal(parseModeLevels([1]), null);
});

test('setting keys follow the per-mode pattern', () => {
  assert.equal(modeDropFloorKey('hardcore'), 'world_mode_drop_floor_hardcore');
  assert.equal(modeLevelsKey('hardcore'), 'world_mode_levels_hardcore');
});
