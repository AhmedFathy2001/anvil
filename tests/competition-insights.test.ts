import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeStreak,
  buildSeries,
  dailyCoverage,
  dailyTrust,
  cumulative,
  dailyLeaders,
  dailyTotals,
  dayRange,
  daysElapsed,
  heatLevel,
  metricGain,
  mostConsistent,
  projectTotal,
  type DailyRow,
} from '../src/lib/competitionInsights.ts';

const START = '2026-08-10T00:00:00.000Z';
const END = '2026-08-17T00:00:00.000Z';

const row = (rsn: string, day: string, deltas: DailyRow['deltas'], xp = 0, ehp = 0, ehb = 0): DailyRow => ({
  rsn, day, xpGained: xp, ehpMilliGained: ehp, ehbMilliGained: ehb, deltas,
});

test('the day range is the competition, capped at its end', () => {
  const days = dayRange(START, END);
  // Aug 10 00:00 → Aug 17 00:00 is seven days of play, not eight: nothing can be scored in the
  // zero-length sliver on the 17th.
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-08-10');
  assert.equal(days[6], '2026-08-16');
  // An end partway through a day still counts that day.
  assert.equal(dayRange(START, '2026-08-17T09:00:00.000Z').length, 8);
  assert.deepEqual(dayRange(END, START), []);
  assert.equal(dayRange(START, '2030-01-01T00:00:00.000Z').length, 31, 'never renders a thousand columns');
});

test('elapsed days stop at today, and at least one day always shows', () => {
  const days = dayRange(START, END);
  assert.equal(daysElapsed(days, new Date('2026-08-14T09:00:00.000Z')), 5);
  assert.equal(daysElapsed(days, new Date('2026-08-30T00:00:00.000Z')), 7, 'a finished week is all of it');
  assert.equal(daysElapsed(days, new Date('2026-08-01T00:00:00.000Z')), 1, 'before it starts, not zero');
});

test('a day row is read through the competition metric, not its total XP', () => {
  const r = row('Minjoll', '2026-08-11', { skills: { agility: 120_000, slayer: 400_000 }, bosses: { zulrah: 40 } }, 520_000);
  assert.equal(metricGain(r, 'skill', 'agility'), 120_000, "Slayer XP is not Agility XP");
  assert.equal(metricGain(r, 'boss', 'zulrah'), 40);
  assert.equal(metricGain(r, 'skill', 'mining'), 0, 'a skill that did not move is zero, not undefined');
  assert.equal(metricGain(r, 'skill', 'overall'), 520_000, 'overall is the whole day');
});

test('efficiency reads the milli-hour columns', () => {
  const r = row('Minjoll', '2026-08-11', null, 500_000, 2_400, 900);
  assert.equal(metricGain(r, 'efficiency', 'ehp'), 2_400);
  assert.equal(metricGain(r, 'efficiency', 'ehb'), 900);
});

test('series line up with the day range and ignore days outside it', () => {
  const days = dayRange(START, END);
  const rows = [
    row('Minjoll', '2026-08-10', { skills: { agility: 100 } }),
    row('Minjoll', '2026-08-12', { skills: { agility: 50 } }),
    row('Minjoll', '2026-07-30', { skills: { agility: 999 } }), // before the comp
    row('Titoo', '2026-08-12', { skills: { agility: 70 } }),
  ];
  const series = buildSeries(['Minjoll', 'Titoo'], rows, days, 'skill', 'agility');
  assert.deepEqual(series[0].days.slice(0, 3), [100, 0, 50]);
  assert.deepEqual(series[1].days.slice(0, 3), [0, 0, 70]);
  assert.equal(series[0].days.length, days.length);
});

test('totals, leaders and cumulative describe the same week', () => {
  const series = [
    { rsn: 'A', days: [10, 0, 30] },
    { rsn: 'B', days: [5, 40, 5] },
  ];
  assert.deepEqual(dailyTotals(series, 3), [15, 40, 35]);
  assert.deepEqual(dailyLeaders(series, 3), ['A', 'B', 'A']);
  assert.deepEqual(cumulative(series[0].days, 3), [10, 10, 40]);
});

test('a day nobody scored has no leader', () => {
  assert.deepEqual(dailyLeaders([{ rsn: 'A', days: [0, 0] }], 2), [null, null]);
});

test('streaks count consecutive active days only', () => {
  assert.equal(activeStreak([5, 5, 0, 5, 5, 5], 6), 3);
  assert.equal(activeStreak([0, 0, 0], 3), 0);
  assert.equal(activeStreak([5, 5, 5, 5], 2), 2, 'never counts days that have not happened');
});

test('projection needs a day of history and never shrinks a finished week', () => {
  assert.equal(projectTotal(1000, 0.5, 7), null);
  assert.equal(projectTotal(0, 3, 7), null);
  assert.equal(projectTotal(3000, 3, 7), 7000);
  assert.equal(projectTotal(3000, 7, 7), 3000);
});

test('heat levels separate a small day from a huge one', () => {
  const max = 300_000;
  assert.equal(heatLevel(0, max), 0);
  assert.equal(heatLevel(300_000, max), 4);
  assert.ok(heatLevel(5_000, max) < heatLevel(120_000, max), 'log scale keeps small days visible but distinct');
});

test('most consistent rewards steadiness, not volume', () => {
  const series = [
    { rsn: 'Spiky', days: [1000, 0, 0, 0] },
    { rsn: 'Steady', days: [100, 110, 90, 100] },
  ];
  assert.equal(mostConsistent(series, 4)?.rsn, 'Steady');
  assert.equal(mostConsistent([{ rsn: 'Nobody', days: [0, 0] }], 2), null);
});

// ── Daily trust ──────────────────────────────────────────────────────────────────────────────────

test('a week the daily rows fully explain is drawable', () => {
  assert.equal(dailyTrust(4_000_000, 4_200_000, true), 'ok');
  assert.equal(dailyCoverage(4_000_000, 4_200_000) > 0.95, true);
});

test('the live clan week that started this — 786.8K of 4.5M — is too thin to draw', () => {
  assert.equal(dailyTrust(786_800, 4_500_000, true), 'thin');
  assert.equal(Math.round(dailyCoverage(786_800, 4_500_000) * 100), 17);
});

test('exactly at the threshold counts as drawable', () => {
  assert.equal(dailyTrust(50, 100, true), 'ok');
  assert.equal(dailyTrust(49, 100, true), 'thin');
});

test('no rows, or rows that total nothing, is "none" rather than "thin"', () => {
  assert.equal(dailyTrust(0, 4_500_000, false), 'none');
  assert.equal(dailyTrust(0, 4_500_000, true), 'none');
});

test('a week where nobody gained anything draws as empty, not broken', () => {
  assert.equal(dailyTrust(0, 0, true), 'none');
  assert.equal(dailyTrust(10, 0, true), 'ok');
  assert.equal(dailyCoverage(10, 0), 0);
});

test('coverage is clamped — a stale total can never read over 100%', () => {
  assert.equal(dailyCoverage(9_000, 4_000), 1);
  assert.equal(dailyCoverage(-5, 4_000), 0);
});

test('guests do not count against the day-by-day', () => {
  // A week where clan members gained 900K (fully recorded) and guests gained another 3M. Scored
  // against everyone it reads as 23% and the charts vanish forever; scored against who CAN be
  // tracked it reads as complete, which is what it is.
  assert.equal(dailyTrust(900_000, 3_900_000, true), 'thin');
  assert.equal(dailyTrust(900_000, 900_000, true), 'ok');
});
