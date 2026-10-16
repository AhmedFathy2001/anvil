// lib/yearlyWrappedRules: the year card's extras. Best finish, stat boxes and pills.
//
// Run: npx tsx --test tests/yearly-wrapped-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bestFinish, yearlyCardStats, yearlyHighlights } from '../src/lib/yearlyWrappedRules';
import type { YearEvent, YearlyWrapped } from '../src/lib/yearlyWrappedRules';

const ev = (over: Partial<YearEvent> & { name: string }): YearEvent => ({
  eventId: 1,
  clanSlug: 'clan',
  cardKey: null,
  team: null,
  placeInTeam: null,
  points: 0,
  awards: [],
  ...over,
});

const yearWith = (events: YearEvent[]): YearlyWrapped => ({ events }) as YearlyWrapped;

// ---------- bestFinish ----------

test('bestFinish picks the lowest team rank', () => {
  const best = bestFinish([
    ev({ name: 'A', team: { name: 'Red', rank: 3, of: 5 } }),
    ev({ name: 'B', team: { name: 'Blue', rank: 1, of: 4 } }),
    ev({ name: 'C', team: { name: 'Green', rank: 2, of: 9 } }),
  ]);
  assert.equal(best?.name, 'B');
});

test('bestFinish breaks rank ties by the larger number of teams', () => {
  const best = bestFinish([
    ev({ name: 'Small', team: { name: 'x', rank: 1, of: 3 } }),
    ev({ name: 'Big', team: { name: 'y', rank: 1, of: 8 } }),
  ]);
  assert.equal(best?.name, 'Big');
});

test('bestFinish ignores events with no team', () => {
  const best = bestFinish([
    ev({ name: 'Solo', team: null, placeInTeam: { rank: 1, of: 2 } }),
    ev({ name: 'Teamed', team: { name: 'x', rank: 4, of: 6 } }),
  ]);
  assert.equal(best?.name, 'Teamed');
});

test('bestFinish returns null when there are no team finishes', () => {
  assert.equal(bestFinish([]), null);
  assert.equal(bestFinish([ev({ name: 'Solo', team: null })]), null);
});

// ---------- yearlyCardStats ----------

test('yearlyCardStats returns the base unchanged when there are no events', () => {
  const base = [
    { label: 'XP gained', value: '1M' },
    { label: 'Boss kills', value: '2K' },
    { label: 'New slots', value: '3' },
    { label: 'PBs', value: '4' },
  ];
  assert.equal(yearlyCardStats(yearWith([]), base), base);
});

test('yearlyCardStats keeps the first 3 base stats and adds Events with the count', () => {
  const base = [
    { label: 'XP gained', value: '1M' },
    { label: 'Boss kills', value: '2K' },
    { label: 'New slots', value: '3' },
    { label: 'PBs', value: '4' },
  ];
  const events = [ev({ name: 'A' }), ev({ name: 'B' })];
  assert.deepEqual(yearlyCardStats(yearWith(events), base), [
    { label: 'XP gained', value: '1M' },
    { label: 'Boss kills', value: '2K' },
    { label: 'New slots', value: '3' },
    { label: 'Events', value: '2' },
  ]);
});

test('yearlyCardStats formats the event count with thousands separators', () => {
  const events = Array.from({ length: 1234 }, (_, i) => ev({ name: `E${i}`, eventId: i }));
  const stats = yearlyCardStats(yearWith(events), [{ label: 'XP gained', value: '1M' }]);
  assert.deepEqual(stats.at(-1), { label: 'Events', value: '1,234' });
});

// ---------- yearlyHighlights ----------

test('yearlyHighlights puts the best finish first, then the base pills', () => {
  const y = yearWith([ev({ name: 'July Bingo', team: { name: 'Red', rank: 1, of: 4 } })]);
  assert.deepEqual(yearlyHighlights(y, ['99 Agility', '1,000 Zulrah KC']), ['1st in July Bingo', '99 Agility', '1,000 Zulrah KC']);
});

test('yearlyHighlights caps the pills at 3', () => {
  const y = yearWith([ev({ name: 'July Bingo', team: { name: 'Red', rank: 2, of: 4 } })]);
  const out = yearlyHighlights(y, ['a', 'b', 'c', 'd']);
  assert.equal(out.length, 3);
  assert.deepEqual(out, ['2nd in July Bingo', 'a', 'b']);
});

test('yearlyHighlights returns the base sliced to 3 when there are no team finishes', () => {
  const y = yearWith([ev({ name: 'Solo', team: null })]);
  assert.deepEqual(yearlyHighlights(y, ['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
  assert.deepEqual(yearlyHighlights(yearWith([]), ['x']), ['x']);
});
