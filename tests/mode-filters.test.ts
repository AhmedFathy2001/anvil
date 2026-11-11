// A game mode's own post thresholds (lib/modeFilters): drop rarity, drop value and level milestones,
// looser or stricter than the main game. Pure — no database.
//
// Run: npx tsx --test tests/mode-filters.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_MODE_FILTERS,
  dropPassesFloor,
  mergeModeThresholds,
  modeDropAllows,
  modeFilterAllows,
  modeLevelRules,
  parseModeDropFloor,
  parseModeDropValue,
  parseModeLevels,
  pluginPostsModeLevels,
  storedModeDropBoth,
  storedModeDropFloor,
  storedModeDropValue,
  storedModeLevels,
  unionLevelRules,
  type ModeFilters,
} from '../src/lib/modeFilters.ts';
import { DEFAULT_LEVEL_RULES, skillLevelMatches, totalLevelMatches, type LevelRules } from '../src/lib/levelRules.ts';
import { modeDropFloorKey, modeDropValueKey, modeLevelsKey } from '../src/lib/worldModes.ts';

const item = { name: 'Thing', qty: 1, value: 100 };
const drop = (extra: Record<string, unknown> = {}) => ({ items: [item], ...extra });
const only99s = { ...DEFAULT_LEVEL_RULES, skillStep: 0, totalStep: 0, maxTotal: false };

const filters = (f: Partial<ModeFilters>): ModeFilters => ({ ...NO_MODE_FILTERS, ...f });

test('no thresholds: drops pass exactly as before, and a mode posts no level-ups', () => {
  for (const [kind, facts] of [
    ['drop', drop()],
    ['drop', drop({ dropRate: 1 / 50 })],
    ['drop', { items: [item, item] }],
    ['pet', {}],
    ['quest', { quest: 'Cook' }],
    [undefined, undefined],
  ] as const) {
    assert.equal(modeFilterAllows(kind, facts, NO_MODE_FILTERS), true, String(kind));
  }
  // A separate character's levels never posted before; with no rules they still don't.
  assert.equal(modeFilterAllows('level', { level: 42 }, NO_MODE_FILTERS), false);
  assert.equal(modeFilterAllows('level99', { skill: 'attack' }, NO_MODE_FILTERS), false);
  assert.equal(modeFilterAllows('totalLevel', { total: 1900, milestone: 1900 }, NO_MODE_FILTERS), false);
});

test('no thresholds here, but another clan loosened the mode: its extra drops stay out', () => {
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 200, modeOnly: true }), NO_MODE_FILTERS), false);
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 20000 }), NO_MODE_FILTERS), true, 'a main-game drop still posts');
  assert.equal(modeDropAllows(drop({ notable: 'loot', modeOnly: true }), NO_MODE_FILTERS), true, 'always-post items');
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
  const f = filters({ dropFloor: 5000 });
  assert.equal(modeFilterAllows('drop', drop({ dropRate: 1 / 100 }), f), false);
  assert.equal(modeFilterAllows('pet', { dropRate: 1 / 100 }, f), true);
  assert.equal(modeFilterAllows(undefined, undefined, f), true, 'an old plugin embed has no facts to judge');
});

test('a LOOSER mode: 1 in 128 or 10k+ posts, even when the plugin flagged it mode-only', () => {
  const hc = filters({ dropFloor: 128, dropMinValue: 10_000 });
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 128, modeOnly: true }), hc), true, 'on the floor');
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 500, modeOnly: true }), hc), true);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 12_000 }], modeOnly: true }, hc), true, 'on value');
  assert.equal(modeDropAllows({ items: [{ ...item, value: 9_999 }], modeOnly: true }, hc), false);
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 64, modeOnly: true }), hc), false, 'too common, too cheap');
  // A haul (loot key, bundled kill) is judged on its total.
  const haul = { items: [{ ...item, value: 6_000 }, { ...item, value: 6_000 }], modeOnly: true };
  assert.equal(modeDropAllows(haul, hc), true);
});

test('a STRICTER mode still rejects what the main game would have posted', () => {
  const strict = filters({ dropFloor: 50_000, dropMinValue: 20_000_000 });
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 20_000 }), strict), false);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 5_000_000 }] }, strict), false);
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 60_000 }), strict), true);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 25_000_000 }] }, strict), true);
});

test('one half set: the other follows the main game, never for a mode-only post', () => {
  const rarityOnly = filters({ dropFloor: 128 });
  // Value half = the main game's 1m floor.
  assert.equal(modeDropAllows({ items: [{ ...item, value: 2_000_000 }] }, rarityOnly), true);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 2_000_000 }], modeOnly: true }, rarityOnly), false);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 500_000 }] }, rarityOnly), false);

  const valueOnly = filters({ dropMinValue: 10_000 });
  // Rarity half = the clan's main-game floor (never under 1/1000).
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 20_000 }), valueOnly, 10_000), true);
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 5_000 }), valueOnly, 10_000), false);
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 5_000 }), valueOnly, 0), true, 'the 1/1000 hard floor');
  assert.equal(modeDropAllows(drop({ dropRate: 1 / 20_000, modeOnly: true }), valueOnly, 10_000), false);
});

test('guaranteed drops never pass on rarity, but can on value', () => {
  const f = filters({ dropFloor: 2, dropMinValue: 10_000 });
  assert.equal(modeDropAllows(drop({ guaranteed: true, dropRate: 1 }), f), false);
  assert.equal(modeDropAllows({ items: [{ ...item, value: 50_000 }], guaranteed: true }, f), true);
});

test('level rules: only the chosen milestones post', () => {
  const f = filters({ levels: only99s });
  assert.equal(modeFilterAllows('level99', { skill: 'attack', at99: 1, skills: 23 }, f), true);
  assert.equal(modeFilterAllows('level', { level: 99 }, f), true);
  assert.equal(modeFilterAllows('level', { level: 70 }, f), false);
  assert.equal(modeFilterAllows('totalLevel', { total: 1000, milestone: 1000 }, f), false);
  assert.equal(modeFilterAllows('totalLevel', { total: 2277, maxed: true }, f), false);
  assert.equal(modeFilterAllows('drop', drop(), f), true, 'level rules leave drops alone');
  assert.equal(modeFilterAllows('quest', { quest: 'Cook' }, f), true);

  const every10 = filters({ levels: { ...only99s, skillStep: 10, skillFrom: 50 } });
  assert.equal(modeFilterAllows('level', { level: 60 }, every10), true);
  assert.equal(modeFilterAllows('level', { level: 65 }, every10), false);
});

test('level rules are LOOSER than the main game when asked: every 10 levels', () => {
  const every10 = filters({ levels: { ...DEFAULT_LEVEL_RULES, skillStep: 10, skillFrom: 10 } });
  for (const l of [10, 20, 30, 90, 99]) assert.equal(modeFilterAllows('level', { level: l }, every10), true, String(l));
  for (const l of [5, 11, 42]) assert.equal(modeFilterAllows('level', { level: l }, every10), false, String(l));
});

test("a member's own level-post choice still applies to a mode", () => {
  const every10 = filters({ levels: { ...DEFAULT_LEVEL_RULES, skillStep: 10, skillFrom: 10 } });
  assert.equal(modeFilterAllows('level', { level: 20 }, every10, { levelChoice: 'off' }), false);
  assert.equal(modeFilterAllows('level', { level: 20 }, every10, { levelChoice: 'ninetyNinesAndMax' }), false);
  assert.equal(modeFilterAllows('level', { level: 99 }, every10, { levelChoice: 'ninetyNinesAndMax' }), true);
  assert.equal(modeLevelRules(null, 'clan'), null);
  assert.deepEqual(modeLevelRules(only99s, 'clan'), only99s);
});

test('drop floor input: whole positive numbers, blank clears, junk is refused', () => {
  assert.equal(parseModeDropFloor('5000'), 5000);
  assert.equal(parseModeDropFloor('5,000'), 5000);
  assert.equal(parseModeDropFloor(5000), 5000);
  assert.equal(parseModeDropFloor(''), null);
  assert.equal(parseModeDropFloor('  '), null);
  assert.equal(parseModeDropFloor(null), null);
  assert.equal(parseModeDropFloor(undefined), null);
  for (const bad of ['abc', '0', '1', '-5', '1.5', 2.5, 0, 1, 1e12, {}, [], true]) {
    assert.equal(parseModeDropFloor(bad), undefined, JSON.stringify(bad));
  }
  assert.equal(parseModeDropFloor('2'), 2, 'the lowest bound');
});

test('drop value input: whole gp from 1,000, blank clears, junk is refused', () => {
  assert.equal(parseModeDropValue('10,000'), 10_000);
  assert.equal(parseModeDropValue(1000), 1000);
  assert.equal(parseModeDropValue(''), null);
  assert.equal(parseModeDropValue(null), null);
  for (const bad of ['999', 0, -1, '1.5k', 1e12, {}, true]) {
    assert.equal(parseModeDropValue(bad), undefined, JSON.stringify(bad));
  }
  assert.equal(storedModeDropValue('10000'), 10_000);
  assert.equal(storedModeDropValue('5'), null);
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
  assert.equal(modeDropValueKey('hardcore'), 'world_mode_drop_value_hardcore');
});

// ── What the plugin is told ──

const rules = (r: Partial<LevelRules>): LevelRules => ({ ...DEFAULT_LEVEL_RULES, ...r });

test('merge: the most permissive of the clans, and null when no clan set anything', () => {
  const mode = { key: 'hardcore', label: 'Hardcore Worlds' };
  assert.equal(mergeModeThresholds(mode, []), null);
  assert.equal(mergeModeThresholds(mode, [NO_MODE_FILTERS, NO_MODE_FILTERS]), null);
  const out = mergeModeThresholds(mode, [
    filters({ dropFloor: 5000, dropMinValue: 50_000 }),
    filters({ dropFloor: 128 }),
    NO_MODE_FILTERS,
  ]);
  assert.deepEqual(out, { key: 'hardcore', label: 'Hardcore Worlds', dropRarityFloor: 128, dropMinValue: 50_000, levelRules: null });
  const lv = mergeModeThresholds(mode, [filters({ levels: only99s })]);
  assert.deepEqual(lv?.levelRules, only99s);
  assert.equal(lv?.dropRarityFloor, null);
});

test('level union: never misses a level any clan wants', () => {
  const sets = [
    rules({ ninetyNines: false, skillStep: 10, skillFrom: 10, totalStep: 250, totalFrom: 1000, maxTotal: false }),
    rules({ ninetyNines: true, skillStep: 5, skillFrom: 50, totalStep: 100, totalFrom: 1800, maxTotal: true }),
    rules({ skillStep: 7, skillFrom: 3, totalStep: 0 }),
  ];
  const u = unionLevelRules(sets);
  assert.ok(u);
  assert.equal(u.ninetyNines, true);
  assert.equal(u.maxTotal, true);
  for (let l = 1; l <= 99; l++) {
    if (sets.some((r) => skillLevelMatches(r, l))) assert.equal(skillLevelMatches(u, l), true, `level ${l}`);
  }
  for (let m = 50; m <= 2500; m += 50) {
    if (sets.some((r) => totalLevelMatches(r, m))) assert.equal(totalLevelMatches(u, m), true, `total ${m}`);
  }
  // Aligned steps stay tight: every 10 from 10 + every 5 from 50 → every 5 from 10.
  const tight = unionLevelRules([sets[0], sets[1]]);
  assert.equal(tight?.skillStep, 5);
  assert.equal(tight?.skillFrom, 10);
  assert.equal(unionLevelRules([null, undefined]), null);
  assert.deepEqual(unionLevelRules([only99s]), only99s);
});

test('mode-line level-ups stand down for a plugin that posts mode level-ups itself', () => {
  for (const v of ['1.15.1', '1.15.2', '1.16.0', '2.0', '1.15.1-dev']) assert.equal(pluginPostsModeLevels(v), true, v);
  for (const v of ['1.15.0', '1.14.9', '0.9', null, undefined, '', 'dev']) assert.equal(pluginPostsModeLevels(v), false, String(v));
});

test('both bars: a mode drop must be rare AND worth enough; a blank bar is not asked for; always-post still posts', () => {
  const rich = { name: 'Thing', qty: 1, value: 200_000 };
  const rareCheap = { items: [item], dropRate: 1 / 500 };
  const rareRich = { items: [rich], dropRate: 1 / 500 };
  const commonRich = { items: [rich], dropRate: 1 / 10 };
  const either = filters({ dropFloor: 128, dropMinValue: 150_000 });
  const both = filters({ dropFloor: 128, dropMinValue: 150_000, dropBoth: true });
  assert.equal(modeDropAllows(rareCheap, either), true);
  assert.equal(modeDropAllows(commonRich, either), true);
  assert.equal(modeDropAllows(rareCheap, both), false);
  assert.equal(modeDropAllows(commonRich, both), false);
  assert.equal(modeDropAllows(rareRich, both), true);
  assert.equal(modeDropAllows(rareCheap, filters({ dropFloor: 128, dropBoth: true })), true, 'value left blank');
  assert.equal(modeDropAllows({ items: [item], notable: 'loot' }, both), true);
  assert.equal(storedModeDropBoth('and'), true);
  assert.equal(storedModeDropBoth(null), false);
});
