import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LEVEL_RULES,
  DEFAULT_MILESTONE_RULES,
  effectiveClanRules,
  highestMatchingLevel,
  keepTotalXpStep,
  levelHalf,
  levelPostMatches,
  levelPostOf,
  MAX_SKILL_XP_POSTS,
  normalizeMilestoneRules,
  parseMilestoneRules,
  skillLevelMatches,
  skillXpMatches,
  totalLevelMatches,
  totalXpMatches,
  xpPostsFor,
  type LevelRules,
  type MilestoneRules,
} from '../src/lib/levelRules.ts';
import { crossedTotalXpMillions } from '../src/lib/totalXpMilestones.ts';

const rules = (patch: Partial<MilestoneRules> = {}): MilestoneRules => ({ ...DEFAULT_MILESTONE_RULES, skillXpM: [], ...patch });

// ── Defaults = the plugin's behaviour before rules existed ─────────────────────────────────────

test('defaults are the contract: 99s, every 100 total from 1800, max; 50M total XP, no skill XP', () => {
  assert.deepEqual(levelHalf(DEFAULT_LEVEL_RULES), {
    ninetyNines: true, skillStep: 0, skillFrom: 1, totalStep: 100, totalFrom: 1800, maxTotal: true,
  });
  assert.equal(DEFAULT_MILESTONE_RULES.totalXpStepM, 50);
  assert.deepEqual(DEFAULT_MILESTONE_RULES.skillXpM, []);
  assert.deepEqual(parseMilestoneRules(null), rules());
  assert.deepEqual(parseMilestoneRules('not json'), rules());
});

// ── Skill levels ────────────────────────────────────────────────────────────────────────────────

test('defaults post 99 and nothing below it', () => {
  assert.equal(skillLevelMatches(DEFAULT_LEVEL_RULES, 99), true);
  for (const l of [1, 50, 90, 98]) assert.equal(skillLevelMatches(DEFAULT_LEVEL_RULES, l), false, String(l));
});

test('99s off still posts 99 when the step rule lands on it, and not otherwise', () => {
  assert.equal(skillLevelMatches(rules({ ninetyNines: false }), 99), false);
  assert.equal(skillLevelMatches(rules({ ninetyNines: false, skillStep: 1, skillFrom: 90 }), 99), true);
  assert.equal(skillLevelMatches(rules({ ninetyNines: false, skillStep: 5, skillFrom: 5 }), 99), false);
});

test('every 5 from 5 posts 5, 10 … 95', () => {
  const r = rules({ skillStep: 5, skillFrom: 5 });
  assert.equal(skillLevelMatches(r, 5), true);
  assert.equal(skillLevelMatches(r, 70), true);
  assert.equal(skillLevelMatches(r, 95), true);
  assert.equal(skillLevelMatches(r, 71), false);
  assert.equal(skillLevelMatches(r, 4), false);
});

test('step 1 from 90 posts every level from 90 up', () => {
  const r = rules({ skillStep: 1, skillFrom: 90 });
  assert.equal(skillLevelMatches(r, 89), false);
  for (let l = 90; l <= 99; l++) assert.equal(skillLevelMatches(r, l), true, String(l));
});

test('skillFrom above the level never matches', () => {
  const r = rules({ ninetyNines: false, skillStep: 1, skillFrom: 95 });
  assert.equal(skillLevelMatches(r, 94), false);
  assert.equal(skillLevelMatches(r, 95), true);
});

test('out-of-range levels never match', () => {
  const r = rules({ skillStep: 1, skillFrom: 1 });
  for (const l of [0, -1, 100, 126, 1.5]) assert.equal(skillLevelMatches(r, l), false, String(l));
});

test('a multi-level jump picks the highest matching level, across either rule set', () => {
  const every10 = rules({ skillStep: 10, skillFrom: 10 });
  assert.equal(highestMatchingLevel(58, 73, every10), 70);
  assert.equal(highestMatchingLevel(61, 69, every10), null);
  assert.equal(highestMatchingLevel(97, 99, DEFAULT_LEVEL_RULES), 99);
  // The clan wants nothing below 99, the personal webhook wants every level from 90.
  assert.equal(highestMatchingLevel(88, 92, DEFAULT_LEVEL_RULES, rules({ skillStep: 1, skillFrom: 90 })), 92);
  assert.equal(highestMatchingLevel(88, 92, null, undefined), null);
});

// ── Total level ─────────────────────────────────────────────────────────────────────────────────

test('total milestones: a multiple of the step at or above the start', () => {
  assert.equal(totalLevelMatches(DEFAULT_LEVEL_RULES, 1800), true);
  assert.equal(totalLevelMatches(DEFAULT_LEVEL_RULES, 2200), true);
  assert.equal(totalLevelMatches(DEFAULT_LEVEL_RULES, 1700), false);
  assert.equal(totalLevelMatches(DEFAULT_LEVEL_RULES, 1850), false);
  assert.equal(totalLevelMatches(rules({ totalStep: 50, totalFrom: 1500 }), 1850), true);
  assert.equal(totalLevelMatches(rules({ totalStep: 0 }), 2000), false);
});

test('maxing follows maxTotal alone', () => {
  const maxed = { type: 'total', milestone: 2277, maxed: true } as const;
  assert.equal(levelPostMatches(maxed, DEFAULT_LEVEL_RULES), true);
  assert.equal(levelPostMatches(maxed, rules({ maxTotal: false })), false);
  assert.equal(levelPostMatches(maxed, rules({ totalStep: 0 })), true);
});

// ── Reading posts off the notify body ───────────────────────────────────────────────────────────

test('levelPostOf reads the new kind and both legacy kinds', () => {
  assert.deepEqual(levelPostOf('level', { skill: 'Slayer', level: 85 }), { type: 'skill', level: 85 });
  assert.deepEqual(levelPostOf('level99', { skill: 'Slayer' }), { type: 'skill', level: 99 });
  assert.deepEqual(levelPostOf('totalLevel', { total: 1903, milestone: 1900 }), { type: 'total', milestone: 1900, maxed: false });
  // A released plugin: `total` is the milestone.
  assert.deepEqual(levelPostOf('totalLevel', { total: 1800 }), { type: 'total', milestone: 1800, maxed: false });
  assert.deepEqual(levelPostOf('totalLevel', { total: 2277, maxed: true }), { type: 'total', milestone: 2277, maxed: true });
  assert.equal(levelPostOf('drop', { items: [] }), null);
  assert.equal(levelPostOf('level', { skill: 'x' }), null);
});

test('a destination with no rules (opted out) declines everything', () => {
  assert.equal(levelPostMatches({ type: 'skill', level: 99 }, null), false);
});

// ── Clan × member choice ────────────────────────────────────────────────────────────────────────

test("'clan' is the clan's rules unchanged", () => {
  const clan = rules({ skillStep: 5, skillFrom: 5, skillXpM: [50] });
  assert.deepEqual(effectiveClanRules(clan, 'clan'), clan);
});

test("'off' opts out entirely", () => {
  assert.equal(effectiveClanRules(rules(), 'off'), null);
});

test("'ninetyNinesAndMax' drops steps and XP, keeps 99s and max", () => {
  const eff = effectiveClanRules(rules({ skillStep: 1, skillFrom: 90, totalStep: 50, skillXpM: [25, 50] }), 'ninetyNinesAndMax')!;
  assert.deepEqual(levelHalf(eff), { ninetyNines: true, skillStep: 0, skillFrom: 90, totalStep: 0, totalFrom: 1800, maxTotal: true });
  assert.equal(eff.totalXpStepM, 0);
  assert.deepEqual(eff.skillXpM, []);
});

test('the member choice is stricter only: it never turns on what the clan turned off', () => {
  const eff = effectiveClanRules(rules({ ninetyNines: false, maxTotal: false }), 'ninetyNinesAndMax')!;
  assert.equal(eff.ninetyNines, false);
  assert.equal(eff.maxTotal, false);
  assert.equal(levelPostMatches({ type: 'skill', level: 99 }, eff), false);
});

// ── Normalisation ───────────────────────────────────────────────────────────────────────────────

test('normalisation clamps, rounds the XP step onto the grain, and filters the skill XP list', () => {
  const r = normalizeMilestoneRules({
    ninetyNines: 'yes', skillStep: 500, skillFrom: 0, totalStep: -5, totalFrom: 1900.7, maxTotal: false,
    totalXpStepM: 12, skillXpM: [200, 25, 25, 33, '50'],
  });
  assert.deepEqual(r, {
    ninetyNines: true, skillStep: 98, skillFrom: 1, totalStep: 0, totalFrom: 1900, maxTotal: false,
    totalXpStepM: 10, skillXpM: [25, 50, 200],
  });
  assert.deepEqual(normalizeMilestoneRules(null), rules());
  assert.deepEqual(normalizeMilestoneRules({ skillStep: 5 }), rules({ skillStep: 5 }));
});

// ── XP milestones ───────────────────────────────────────────────────────────────────────────────

test('total XP steps follow the clan step', () => {
  assert.equal(totalXpMatches(rules(), 50), true);
  assert.equal(totalXpMatches(rules(), 75), false);
  assert.equal(totalXpMatches(rules({ totalXpStepM: 25 }), 75), true);
  assert.equal(totalXpMatches(rules({ totalXpStepM: 0 }), 50), false);
});

test('skill XP thresholds honour the clan list (rows store raw XP)', () => {
  const r = rules({ skillXpM: [25, 50, 100, 200] });
  assert.equal(skillXpMatches(r, 25_000_000), true);
  assert.equal(skillXpMatches(r, 200_000_000), true);
  assert.equal(skillXpMatches(r, 10_000_000), false);
  assert.equal(skillXpMatches(r, 150_000_000), false);
  assert.equal(skillXpMatches(rules(), 50_000_000), false);
});

test('xpPostsFor: highest total step and the highest step per skill, capped', () => {
  const rows = [
    { kind: 'totalxp', metric: null, threshold: 50 },
    { kind: 'totalxp', metric: null, threshold: 100 },
    { kind: 'totalxp', metric: null, threshold: 105 },
    { kind: 'xp', metric: 'slayer', threshold: 25_000_000 },
    { kind: 'xp', metric: 'slayer', threshold: 50_000_000 },
    { kind: 'xp', metric: 'mining', threshold: 10_000_000 },
    { kind: 'level', metric: 'slayer', threshold: 99 },
  ];
  assert.deepEqual(xpPostsFor(rules({ skillXpM: [25, 50] }), rows), {
    totalXpM: 100,
    skills: [{ skill: 'slayer', xp: 50_000_000 }],
  });
  assert.deepEqual(xpPostsFor(rules({ totalXpStepM: 5, skillXpM: [10] }), rows), {
    totalXpM: 105,
    skills: [{ skill: 'mining', xp: 10_000_000 }],
  });
  assert.deepEqual(xpPostsFor(null, rows), { totalXpM: null, skills: [] });
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => ({ kind: 'xp', metric: s, threshold: 10_000_000 }));
  assert.equal(xpPostsFor(rules({ skillXpM: [10] }), many).skills.length, MAX_SKILL_XP_POSTS);
});

test('recording keeps the 50M ladder always and finer steps only when asked', () => {
  assert.equal(keepTotalXpStep(150, []), true);
  assert.equal(keepTotalXpStep(155, []), false);
  assert.equal(keepTotalXpStep(160, [10]), true);
  assert.equal(keepTotalXpStep(165, [10, 25]), false);
  assert.equal(keepTotalXpStep(175, [10, 25]), true);
});

test('detection at the 5M grain sees a custom step crossing', () => {
  assert.deepEqual(crossedTotalXpMillions(98_000_000, 112_000_000, 5), [100, 105, 110]);
  assert.deepEqual(crossedTotalXpMillions(98_000_000, 112_000_000), [100]);
  assert.deepEqual(crossedTotalXpMillions(0, 112_000_000, 5), []);
});

// Typing check: LevelRules is the plugin-contract shape.
const _contract: LevelRules = levelHalf(DEFAULT_MILESTONE_RULES);
void _contract;
