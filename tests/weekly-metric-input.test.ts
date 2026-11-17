// Several bosses, or several skills, in one weekly competition: what a form may ask for, how the
// set reads in words, and that everything which reads a skill metric adds a set up the way the boss
// side always has.
//
// Pure — no database.
//
// Run: npx tsx --test tests/weekly-metric-input.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_WEEKLY_METRIC_KEYS, checkWeeklyMetric, joinWeeklyMetricPicks, weeklyMetricPicks } from '../src/lib/weeklyMetricInput.ts';
import { BOSSES, RAIDS_ANY_MODE, bossMetricLabel, bossMetricPicks, weeklyMetricLabel } from '../src/lib/constants.ts';
import { defaultWeeklyTitle } from '../src/lib/weeklyRepeatPlan.ts';
import { getMaxRatePerHour, SKILL_MAX_XP_PER_HOUR, DEFAULT_BOSS_MAX_KC_PER_HOUR } from '../src/lib/gainsValidation.ts';
import { metricGain, type DailyRow } from '../src/lib/competitionInsights.ts';
import { effectiveMetricValue, liveMetricValue, readMetricFromSnapshot } from '../src/lib/weeklyMetric.ts';
import type { HiscoresSnapshot } from '../src/lib/hiscores.ts';

const metric = (r: ReturnType<typeof checkWeeklyMetric>) => (r.ok ? r.metric : `refused: ${r.error}`);
const refused = (r: ReturnType<typeof checkWeeklyMetric>) => !r.ok;

test('one boss or one skill passes through as it always did', () => {
  assert.equal(metric(checkWeeklyMetric('boss', 'zulrah')), 'zulrah');
  assert.equal(metric(checkWeeklyMetric('skill', 'agility')), 'agility');
  assert.equal(metric(checkWeeklyMetric('skill', 'overall')), 'overall');
  for (const raid of RAIDS_ANY_MODE) assert.equal(metric(checkWeeklyMetric('boss', raid.key)), raid.key, 'the any-mode raids are valid lists');
});

test('a hand-made list is tidied: trimmed, no repeats, order kept', () => {
  assert.equal(metric(checkWeeklyMetric('boss', ' vorkath , zulrah,vorkath ,')), 'vorkath,zulrah');
  assert.equal(metric(checkWeeklyMetric('skill', 'attack,strength,attack')), 'attack,strength');
});

test('every key has to be a real one of the right kind', () => {
  assert.ok(refused(checkWeeklyMetric('boss', 'vorkath,notABoss')));
  assert.ok(refused(checkWeeklyMetric('boss', 'agility')), 'a skill is not a boss');
  assert.ok(refused(checkWeeklyMetric('skill', 'attack,zulrah')), 'a boss is not a skill');
  assert.ok(refused(checkWeeklyMetric('boss', '')));
  assert.ok(refused(checkWeeklyMetric('boss', ',,')));
  assert.ok(refused(checkWeeklyMetric('boss', undefined)));
  assert.ok(refused(checkWeeklyMetric('skill', ['attack'])), 'an array is not the stored form');
});

test('the list is capped', () => {
  const keys = BOSSES.map((b) => b.key);
  assert.ok(keys.length > MAX_WEEKLY_METRIC_KEYS, 'the fixture needs more bosses than the cap');
  assert.ok(checkWeeklyMetric('boss', keys.slice(0, MAX_WEEKLY_METRIC_KEYS).join(',')).ok);
  assert.ok(refused(checkWeeklyMetric('boss', keys.slice(0, MAX_WEEKLY_METRIC_KEYS + 1).join(','))));
});

test('overall stands alone: beside another skill it would count that skill twice', () => {
  assert.ok(refused(checkWeeklyMetric('skill', 'overall,attack')));
});

test('other competition types are not this check’s business', () => {
  assert.equal(metric(checkWeeklyMetric('efficiency', 'ehp')), 'ehp');
});

test('a boss list reads as what was picked: a raid with every mode in it is one entry', () => {
  const cox = 'chambersOfXeric,chambersOfXericChallengeMode';
  assert.deepEqual(bossMetricPicks('vorkath'), ['vorkath']);
  assert.deepEqual(bossMetricPicks(cox), [cox]);
  assert.deepEqual(bossMetricPicks(`vorkath,${cox},zulrah`), ['vorkath', cox, 'zulrah']);
  assert.deepEqual(bossMetricPicks('chambersOfXeric,vorkath,chambersOfXericChallengeMode'), [cox, 'vorkath'], 'modes picked apart still make the raid');
  assert.deepEqual(bossMetricPicks('chambersOfXeric,vorkath'), ['chambersOfXeric', 'vorkath'], 'one mode alone stays one mode');
  // The picker's round trip.
  assert.equal(joinWeeklyMetricPicks(weeklyMetricPicks('boss', `vorkath,${cox}`)), `vorkath,${cox}`);
  assert.equal(joinWeeklyMetricPicks(['attack', 'strength', 'attack']), 'attack,strength');
  assert.deepEqual(weeklyMetricPicks('skill', 'attack,strength'), ['attack', 'strength']);
});

test('labels name each one, and the existing ones did not change', () => {
  assert.equal(bossMetricLabel('vorkath'), 'Vorkath');
  assert.equal(bossMetricLabel('theatreOfBlood,theatreOfBloodHardMode'), 'Theatre of Blood (any mode)');
  assert.equal(bossMetricLabel('vorkath,zulrah'), 'Vorkath + Zulrah');
  assert.equal(bossMetricLabel('vorkath,theatreOfBlood,theatreOfBloodHardMode'), 'Vorkath + Theatre of Blood (any mode)');
  assert.equal(weeklyMetricLabel('skill', 'agility'), 'Agility');
  assert.equal(weeklyMetricLabel('skill', 'attack,strength'), 'Attack + Strength');
});

test('the default name lists up to three and counts the rest', () => {
  assert.equal(defaultWeeklyTitle('boss', 'zulrah'), 'BOTW: Zulrah');
  assert.equal(defaultWeeklyTitle('boss', 'vorkath,zulrah'), 'BOTW: Vorkath + Zulrah');
  assert.equal(defaultWeeklyTitle('skill', 'attack,strength,defence'), 'SOTW: Attack + Strength + Defence');
  assert.equal(defaultWeeklyTitle('skill', 'attack,strength,defence,ranged'), 'SOTW: Attack + Strength + Defence + 1 more');
  assert.equal(defaultWeeklyTitle('boss', 'vorkath,zulrah,nex,kraken,cerberus'), `BOTW: Vorkath + Zulrah + Nex + 2 more`);
  // A raid across its modes is one name, so it does not use up two of the three.
  assert.equal(
    defaultWeeklyTitle('boss', 'theatreOfBlood,theatreOfBloodHardMode,vorkath,zulrah'),
    'BOTW: Theatre of Blood (any mode) + Vorkath + Zulrah',
  );
  assert.equal(defaultWeeklyTitle('efficiency', 'ehp').startsWith('Efficiency: '), true);
});

// ── several skills, read as summed XP ─────────────────────────────────────────────────────────────

const snap = (over: Partial<HiscoresSnapshot> = {}): HiscoresSnapshot => ({ skills: {}, bosses: {}, ...over }) as HiscoresSnapshot;
const melee = () =>
  snap({ skills: { attack: { rank: 1, level: 70, xp: 1000 }, strength: { rank: 1, level: 70, xp: 500 }, defence: { rank: -1, level: 1, xp: -1 } } } as Partial<HiscoresSnapshot>);
const value = (r: ReturnType<typeof readMetricFromSnapshot>) => (r.kind === 'value' ? r.value : r.kind);

test('several skills are the sum of their XP, an unranked one counting none', () => {
  assert.equal(value(readMetricFromSnapshot(melee(), 'skill', 'attack,strength')), 1500);
  assert.equal(value(readMetricFromSnapshot(melee(), 'skill', 'attack,strength,defence')), 1500);
  assert.equal(value(readMetricFromSnapshot(melee(), 'skill', 'attack')), 1000, 'one skill is unchanged');
});

test('a skill the parser does not know fails the whole read, never a partial sum', () => {
  // A partial sum would be written as the baseline, and the missing skill's whole XP would land as
  // a gain the day the parser learns it.
  assert.equal(readMetricFromSnapshot(melee(), 'skill', 'attack,sailing').kind, 'transient');
});

test('the plugin’s live numbers fold in per skill, and are only whole with every skill', () => {
  assert.equal(value(effectiveMetricValue(melee(), 'skill', 'attack,strength', { attack: 1200 })), 1700);
  assert.equal(liveMetricValue('skill', 'attack,strength', { attack: 1200 }), null);
  assert.equal(liveMetricValue('skill', 'attack,strength', { attack: 1200, strength: 600 }), 1800);
  // Efficiency has one derived number; its metric is never a list.
  assert.equal(liveMetricValue('efficiency', 'ehp', { ehp: 7 }), 7);
});

test('the implausible-gain ceiling for several skills is the fastest of them', () => {
  assert.equal(getMaxRatePerHour('skill', 'agility'), SKILL_MAX_XP_PER_HOUR.agility);
  assert.equal(getMaxRatePerHour('skill', 'agility,fletching'), SKILL_MAX_XP_PER_HOUR.fletching);
  // A boss set keeps the default it has always had (the any-mode raids run on it today).
  assert.equal(getMaxRatePerHour('boss', 'vorkath,zulrah'), DEFAULT_BOSS_MAX_KC_PER_HOUR);
});

test('a day’s gain for several skills adds only those skills', () => {
  const row: DailyRow = {
    rsn: 'A', day: '2026-11-02', xpGained: 900, ehpMilliGained: 0, ehbMilliGained: 0,
    deltas: { skills: { attack: 100, strength: 50, slayer: 750 }, bosses: { vorkath: 3, zulrah: 4 } },
  };
  assert.equal(metricGain(row, 'skill', 'attack,strength'), 150);
  assert.equal(metricGain(row, 'skill', 'attack'), 100);
  assert.equal(metricGain(row, 'boss', 'vorkath,zulrah'), 7);
});
