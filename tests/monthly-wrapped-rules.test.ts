// lib/monthlyWrappedRules: the pure half of monthly Wrapped. Month keys, PB times, shaping and card picks.
//
// Run: npx tsx --test tests/monthly-wrapped-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isMonthKey,
  monthKeyOf,
  monthLabel,
  monthHasAnything,
  monthlyCardStats,
  monthlyFeature,
  monthlyHighlights,
  nextMonthKey,
  pbTime,
  previousMonthKeyOf,
  shapeMonthlyWrapped,
  type MonthDayRow,
  type MonthlyWrapped,
  type MonthMilestoneRow,
  type MonthMomentRow,
  type MonthClogRow,
  type MonthPbRow,
} from '../src/lib/monthlyWrappedRules';

const day = (over: Partial<MonthDayRow> = {}): MonthDayRow => ({
  xpGained: 0,
  ehpMilliGained: 0,
  ehbMilliGained: 0,
  deltas: null,
  ...over,
});

interface ShapeOver {
  days?: MonthDayRow[];
  milestones?: MonthMilestoneRow[];
  clog?: MonthClogRow[];
  pbs?: MonthPbRow[];
  moments?: MonthMomentRow[];
  rarity?: Map<number, { denominator: number; source: string }>;
  petIds?: Set<number>;
  now?: Date;
  monthKey?: string;
}

function shape(over: ShapeOver = {}): MonthlyWrapped {
  return shapeMonthlyWrapped({
    rsn: 'Tester',
    monthKey: over.monthKey ?? '2026-09',
    now: over.now ?? new Date('2026-10-16T12:00:00Z'),
    days: over.days ?? [],
    milestones: over.milestones ?? [],
    clog: over.clog ?? [],
    pbs: over.pbs ?? [],
    moments: over.moments ?? [],
    rarity: over.rarity ?? new Map(),
    petIds: over.petIds ?? new Set(),
  });
}

/** An empty month, to override one field at a time in the card-pick tests. */
const base = (): MonthlyWrapped => shape();

// ---------- month keys ----------

test('isMonthKey accepts YYYY-MM and rejects out-of-range or malformed keys', () => {
  assert.equal(isMonthKey('2026-10'), true);
  assert.equal(isMonthKey('2026-13'), false);
  assert.equal(isMonthKey('2026-1'), false);
  assert.equal(isMonthKey('abc'), false);
});

test('monthLabel spells the month and year', () => {
  assert.equal(monthLabel('2026-10'), 'October 2026');
});

test('nextMonthKey and previousMonthKeyOf roll the year', () => {
  assert.equal(nextMonthKey('2026-12'), '2027-01');
  assert.equal(previousMonthKeyOf('2026-01'), '2025-12');
});

test('monthKeyOf uses the UTC calendar month', () => {
  assert.equal(monthKeyOf(new Date('2026-10-31T23:59:59Z')), '2026-10');
});

// ---------- PB time ----------

test('pbTime formats minutes and seconds, and adds hours past the hour', () => {
  assert.equal(pbTime(8340), '1:23.40');
  assert.equal(pbTime(372300), '1:02:03.00');
});

// ---------- shaping ----------

test('shapeMonthlyWrapped sums xpGained across days', () => {
  const w = shape({ days: [day({ xpGained: 1000 }), day({ xpGained: 2500 }), day({ xpGained: 500 })] });
  assert.equal(w.xpGained, 4000);
  assert.equal(w.monthLabel, 'September 2026');
});

test('shapeMonthlyWrapped sums boss KC from delta JSON and labels top bosses', () => {
  const w = shape({
    days: [
      day({ xpGained: 1, deltas: JSON.stringify({ bosses: { zulrah: 5, vorkath: 2 } }) }),
      day({ xpGained: 1, deltas: JSON.stringify({ bosses: { zulrah: 3 } }) }),
    ],
  });
  assert.equal(w.kcGained, 10);
  assert.deepEqual(w.topBosses[0], { key: 'zulrah', name: 'Zulrah', kc: 8 });
  assert.deepEqual(
    w.topBosses.map((b) => b.kc),
    [...w.topBosses.map((b) => b.kc)].sort((a, b) => b - a),
  );
});

test('shapeMonthlyWrapped counts only days with xp gained or a boss delta as active', () => {
  const w = shape({
    days: [
      day({ xpGained: 100 }),
      day({ xpGained: 0, deltas: null }),
      day({ xpGained: 0, deltas: JSON.stringify({ bosses: { zulrah: 1 } }) }),
      day({ xpGained: 0, deltas: JSON.stringify({ bosses: { zulrah: 0 } }) }),
    ],
  });
  assert.equal(w.daysActive, 2);
});

test('shapeMonthlyWrapped ignores malformed deltas JSON but keeps the xp', () => {
  const w = shape({ days: [day({ xpGained: 50, deltas: '{not json' })] });
  assert.equal(w.xpGained, 50);
  assert.equal(w.kcGained, 0);
  assert.equal(w.daysActive, 1);
});

test('shapeMonthlyWrapped sums EHP and EHB milli values and divides by 1000', () => {
  const w = shape({
    days: [
      day({ ehpMilliGained: 1500, ehbMilliGained: 250 }),
      day({ ehpMilliGained: 2500, ehbMilliGained: 0 }),
    ],
  });
  assert.equal(w.ehpGained, 4);
  assert.equal(w.ehbGained, 0.25);
});

test('level milestone at 99 becomes a capitalised maxed skill and is not a line', () => {
  const w = shape({ milestones: [{ kind: 'level', metric: 'agility', threshold: 99 }] });
  assert.deepEqual(w.maxed, ['Agility']);
  assert.deepEqual(w.milestones, []);
});

test('totalxp milestones keep only the highest threshold crossed', () => {
  const w = shape({
    milestones: [
      { kind: 'totalxp', metric: null, threshold: 50 },
      { kind: 'totalxp', metric: null, threshold: 250 },
    ],
  });
  assert.deepEqual(w.milestones, ['250M total XP']);
});

test('kc milestone reads as "1,000 Zulrah KC"', () => {
  const w = shape({ milestones: [{ kind: 'kc', metric: 'zulrah', threshold: 1000 }] });
  assert.deepEqual(w.milestones, ['1,000 Zulrah KC']);
});

test('slots are sorted by rarity denominator, descending, unknowns last', () => {
  const w = shape({
    clog: [
      { itemId: 1, itemName: 'Alpha', pageName: 'P' },
      { itemId: 2, itemName: 'Beta', pageName: 'P' },
      { itemId: 3, itemName: 'Gamma', pageName: 'P' },
    ],
    rarity: new Map([
      [1, { denominator: 500, source: 'x' }],
      [2, { denominator: 2000, source: 'x' }],
    ]),
  });
  assert.deepEqual(
    w.slots.map((s) => s.itemName),
    ['Beta', 'Alpha', 'Gamma'],
  );
  assert.equal(w.slots[0].denominator, 2000);
  assert.equal(w.slots[2].denominator, null);
  assert.equal(w.newSlots, 3);
});

test('a pet from the clog and the same pet name from a moment is counted once', () => {
  const w = shape({
    clog: [{ itemId: 7, itemName: 'Pet Zulrah', pageName: 'Pets' }],
    petIds: new Set([7]),
    moments: [
      { kind: 'pet', itemId: 7, itemName: 'Pet zulrah', valueGp: null, source: null },
      { kind: 'pet', itemId: 8, itemName: 'Other Pet', valueGp: null, source: null },
    ],
  });
  assert.equal(w.pets.length, 2);
  assert.equal(w.pets[0].itemName, 'Pet Zulrah');
  assert.equal(w.pets[1].itemName, 'Other Pet');
});

test('biggestDrop is the highest valueGp among unique and loot moments', () => {
  const w = shape({
    moments: [
      { kind: 'loot', itemId: 1, itemName: 'Cheap', valueGp: 100, source: null },
      { kind: 'unique', itemId: 2, itemName: 'Big', valueGp: 5000, source: null },
      { kind: 'pet', itemId: 3, itemName: 'Pet', valueGp: 999999, source: null },
      { kind: 'loot', itemId: 4, itemName: null, valueGp: 900000, source: null },
    ],
  });
  assert.equal(w.biggestDrop?.itemName, 'Big');
  assert.equal(w.biggestDrop?.valueGp, 5000);
});

test('inProgress is true only when now falls in the month', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(shape({ monthKey: '2026-10', now }).inProgress, true);
  assert.equal(shape({ monthKey: '2026-09', now }).inProgress, false);
});

test('monthHasAnything is false for an empty month', () => {
  assert.equal(monthHasAnything(shape()), false);
  assert.equal(monthHasAnything(shape({ days: [day({ xpGained: 1 })] })), true);
});

// ---------- card picks ----------

test('monthlyFeature prefers a pet', () => {
  const f = monthlyFeature({
    ...base(),
    pets: [{ itemId: 7, itemName: 'Pet Zulrah', denominator: null, source: null, valueGp: null }],
    slots: [{ itemId: 9, itemName: 'Rare', denominator: 500, source: null, valueGp: null }],
    biggestDrop: { itemId: 3, itemName: 'Big', denominator: null, source: null, valueGp: 5000 },
  });
  assert.equal(f?.kicker, 'Pet');
  assert.equal(f?.name, 'Pet Zulrah');
});

test('monthlyFeature picks the rarest slot at 1 in 100 or rarer over the biggest drop', () => {
  const f = monthlyFeature({
    ...base(),
    slots: [{ itemId: 9, itemName: 'Rare', denominator: 100, source: null, valueGp: null }],
    biggestDrop: { itemId: 3, itemName: 'Big', denominator: null, source: null, valueGp: 5000 },
  });
  assert.equal(f?.kicker, 'Rarest new slot');
  assert.equal(f?.name, 'Rare');
  assert.equal(f?.detail, '1 in 100');
});

test('monthlyFeature skips a slot at 1 in 50 in favour of the biggest drop', () => {
  const f = monthlyFeature({
    ...base(),
    slots: [{ itemId: 9, itemName: 'Common', denominator: 50, source: null, valueGp: null }],
    biggestDrop: { itemId: 3, itemName: 'Big', denominator: null, source: null, valueGp: 2_500_000 },
  });
  assert.equal(f?.kicker, 'Biggest drop');
  assert.equal(f?.name, 'Big');
  assert.equal(f?.detail, '2.5M gp');
});

test('monthlyFeature falls back to the top boss as Most killed', () => {
  const f = monthlyFeature({
    ...base(),
    topBosses: [{ key: 'zulrah', name: 'Zulrah', kc: 1234 }],
  });
  assert.equal(f?.kicker, 'Most killed');
  assert.equal(f?.name, 'Zulrah');
  assert.equal(f?.detail, '1,234 KC');
});

test('monthlyFeature is null for an empty month', () => {
  assert.equal(monthlyFeature(base()), null);
});

test('monthlyCardStats shows at most 4, and skips zero values', () => {
  const w: MonthlyWrapped = {
    ...base(),
    xpGained: 2_000_000,
    kcGained: 0,
    newSlots: 3,
    ehpGained: 1.5,
    ehbGained: 0.5,
    daysActive: 5,
    pbs: [{ activity: 'Zulrah', teamSize: 1, time: '1:00.00' }],
  };
  const stats = monthlyCardStats(w);
  assert.equal(stats.length, 4);
  assert.ok(!stats.some((s) => s.label === 'Boss kills'));
  assert.deepEqual(stats.find((s) => s.label === 'New slots'), { label: 'New slots', value: '3' });
});

test('monthlyCardStats leaves out New slots when there are none', () => {
  const stats = monthlyCardStats({ ...base(), xpGained: 10 });
  assert.deepEqual(stats, [{ label: 'XP gained', value: '10' }]);
});

test('monthlyHighlights lists 99s first and caps at 3', () => {
  const h = monthlyHighlights({
    ...base(),
    maxed: ['Agility', 'Slayer'],
    milestones: ['1,000 Zulrah KC', '50M XP in Slayer', '250M total XP'],
  });
  assert.deepEqual(h, ['99 Agility', '99 Slayer', '1,000 Zulrah KC']);
});
