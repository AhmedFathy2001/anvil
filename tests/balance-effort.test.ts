import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeEffort } from '../src/lib/balanceEffort.ts';
import { expectedCollectionHours, type DropEffortAction } from '../src/lib/dropEffort.ts';
import type { Tile } from '../src/lib/types.ts';
import { parseTileEffortConfig } from '../src/lib/tileEffortConfig.ts';
import { parseTileGrid, tileToCsvCells, TILE_CSV_COLUMNS } from '../src/lib/csvTiles.ts';
import { tileBalanceRevision } from '../src/lib/tileBalanceRevision.ts';

const closeTo = (actual: number | null, expected: number, epsilon = 1e-6) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) <= epsilon, `expected ${expected}, got ${actual}`);
};

test('collection effort uses coupon-collector time for every item from one exclusive table', () => {
  const requirements = [
    { itemId: 1, name: 'A', requiredAmount: 1 },
    { itemId: 2, name: 'B', requiredAmount: 1 },
  ];
  const actions: DropEffortAction[] = [{
    source: 'Shared table',
    hours: 1,
    exclusive: true,
    outcomes: [
      { requirement: 0, chance: 0.01, quantity: 1 },
      { requirement: 1, chance: 0.01, quantity: 1 },
    ],
  }];

  // First distinct item takes 50 rolls on average; the remaining item takes another 100.
  closeTo(expectedCollectionHours(requirements, 'all', actions), 150);
});

test('collection effort follows any/all groups and groupRequire', () => {
  const requirements = [
    { itemId: 1, name: 'A', requiredAmount: 1, group: 'Boss one', groupRequire: 1 },
    { itemId: 2, name: 'B', requiredAmount: 1, group: 'Boss one', groupRequire: 1 },
    { itemId: 3, name: 'C', requiredAmount: 1, group: 'Boss two', groupRequire: 1 },
  ];
  const actions: DropEffortAction[] = [
    {
      source: 'Boss one', hours: 1, exclusive: true,
      outcomes: [
        { requirement: 0, chance: 0.01, quantity: 1 },
        { requirement: 1, chance: 0.01, quantity: 1 },
      ],
    },
    {
      source: 'Boss two', hours: 1, exclusive: true,
      outcomes: [{ requirement: 2, chance: 0.04, quantity: 1 }],
    },
  ];

  closeTo(expectedCollectionHours(requirements, 'any', actions), 25);
  closeTo(expectedCollectionHours(requirements, 'all', actions), 75);
});

test('collection effort supports required quantities and average drop bundles', () => {
  const requirements = [{ itemId: 1, name: 'Stack', requiredAmount: 5 }];
  const actions: DropEffortAction[] = [{
    source: 'Monster',
    hours: 1,
    exclusive: false,
    outcomes: [{ requirement: 0, chance: 0.1, quantity: 2 }],
  }];

  closeTo(expectedCollectionHours(requirements, 'any', actions), 30);
});

function raidDropTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 1,
    eventId: 1,
    position: 0,
    label: 'Twisted bow',
    tileType: 'drop',
    requiredAmount: 1,
    trackedItemIds: JSON.stringify([20997]),
    sourceNpcs: JSON.stringify(['Chambers of Xeric']),
    points: 100,
    ...overrides,
  };
}

test('raid uniques join their conditional reward share to the clan unique-rate assumption', () => {
  const base = analyzeEffort([raidDropTile()], { pointsMode: true }).perTile[0];
  assert.ok(base.hours, 'raid drop should be modelled');
  // Tbow is 1/30 of the table and the default personal purple assumption is 1/30.
  // Average CoX completion time is 45m / 90% success = 50m, so 900 * 5/6 = 750h.
  closeTo(base.hours![1], 750);
  assert.match(base.note ?? '', /raid_luck_rates/);

  const tuned = analyzeEffort([raidDropTile()], {
    pointsMode: true,
    raidRatesOverride: { chambersOfXeric: 15 },
  }).perTile[0];
  closeTo(tuned.hours![1], 375);
});

test('shared drops use the selected NPCs exact rates instead of a general item rate', () => {
  const sharedDrop = raidDropTile({
    label: 'Shared revenant drop',
    trackedItemIds: JSON.stringify([21804]),
    sourceNpcs: JSON.stringify(['Revenant dragon']),
  });
  const ratesOverride = {
    activities: {
      'Revenant dragon': { killSeconds: [60, 60, 60], floor: 'mid' },
      'Revenant goblin': { killSeconds: [60, 60, 60], floor: 'mid' },
    },
  };

  const dragon = analyzeEffort([sharedDrop], { pointsMode: true, ratesOverride }).perTile[0];
  const goblin = analyzeEffort([{
    ...sharedDrop,
    sourceNpcs: JSON.stringify(['Revenant goblin']),
  }], { pointsMode: true, ratesOverride }).perTile[0];
  const either = analyzeEffort([{
    ...sharedDrop,
    sourceNpcs: JSON.stringify(['Revenant dragon', 'Revenant goblin']),
  }], { pointsMode: true, ratesOverride }).perTile[0];

  // Same one-minute kill time, so the source-specific wiki denominators determine the result:
  // dragon ~= 1/2,666.67 and goblin ~= 1/9,773.33. Allowing both assumes an efficient player
  // camps the faster valid option rather than averaging two monsters they do not have to kill.
  closeTo(dragon.hours![1], 2666.67 / 60);
  closeTo(goblin.hours![1], 9773.33 / 60);
  closeTo(either.hours![1], dragon.hours![1]);
});

test('a tile-level raid profile selects the mode and overrides unique odds and completion time', () => {
  const shadow = raidDropTile({
    label: "Tumeken's shadow",
    trackedItemIds: JSON.stringify([27277]),
    sourceNpcs: JSON.stringify(['Tombs of Amascut']),
    effortConfig: JSON.stringify({
      raid: {
        mode: 'tombsOfAmascutExpertMode',
        uniqueDenominator: 10,
        completionMinutes: 40,
        raidLevel: 400,
      },
    }),
  });
  const effort = analyzeEffort([shadow], { pointsMode: true }).perTile[0];
  assert.ok(effort.hours, 'expert ToA profile should resolve through the shared normal reward table');
  // Shadow is 1/24 conditional on a purple: 24 * 10 raids * 40 minutes.
  closeTo(effort.hours![1], 160);
});

test('tile effort config is defensive and skill rating controls only the small premium', () => {
  assert.deepEqual(parseTileEffortConfig('{"skillRating":4}'), { skillRating: 4 });
  assert.equal(parseTileEffortConfig('{not json'), null);
  assert.equal(parseTileEffortConfig({ skillRating: 9 }), null);

  const tile = raidDropTile({ effortConfig: JSON.stringify({ skillRating: 4 }) });
  const effort = analyzeEffort([tile], { pointsMode: true }).perTile[0];
  assert.equal(effort.skillRating, 4);
  assert.equal(effort.difficulty, 1.2);
});

test('skill floors add only a modest premium after attempt success is priced', () => {
  const elite = analyzeEffort([
    {
      ...raidDropTile(),
      tileType: 'timed',
      trackedItemIds: null,
      sourceNpcs: null,
      timedActivity: 'Inferno',
      timeThresholdSeconds: 65 * 60,
    },
  ], { pointsMode: true }).perTile[0];

  assert.equal(elite.floor, 'elite');
  assert.equal(elite.difficulty, 1.2);
});

test('manual expected hours model bespoke objectives without folding in the skill premium', () => {
  const ca = analyzeEffort([{
    ...raidDropTile(),
    label: 'Bespoke combat achievement',
    tileType: 'ca',
    requiredAmount: 1,
    trackedItemIds: null,
    sourceNpcs: null,
    effortConfig: JSON.stringify({ expectedHours: 2, skillRating: 4 }),
  }], { pointsMode: true }).perTile[0];

  assert.deepEqual(ca.hours, [1.6, 2, 2.7]);
  assert.equal(ca.difficulty, 1.2);
  assert.equal(ca.pricingHours, 2);
  assert.match(ca.note ?? '', /manual calibration/);
});

test('cumulative milestones price only the work beyond the earlier tile', () => {
  const base = {
    ...raidDropTile(),
    tileType: 'standard',
    trackedItemIds: null,
    sourceNpcs: null,
    trackedStat: 'mining',
    statType: 'skill',
    effortConfig: null,
  };
  const report = analyzeEffort([
    { ...base, id: 1, label: '100 Mining XP', statGoal: 100 },
    { ...base, id: 2, label: '500 Mining XP', statGoal: 500 },
  ], {
    pointsMode: true,
    ratesOverride: { skills: { mining: { xpPerHour: [100, 100, 100], floor: 'anyone' } } },
  });
  const first = report.perTile[0];
  const later = report.perTile[1];
  closeTo(first.pricingHours, 1);
  closeTo(later.grossPricingHours, 5);
  closeTo(later.overlapCreditHours, 1);
  closeTo(later.pricingHours, 4);
  assert.match(later.note ?? '', /earlier cumulative milestone/);
});

test('effort calibration survives the canonical CSV round trip', () => {
  const tile = raidDropTile({
    effortConfig: JSON.stringify({
      skillRating: 4,
      expectedHours: 2.25,
      raid: {
        mode: 'tombsOfAmascutExpertMode',
        uniqueDenominator: 10.5,
        completionMinutes: 40,
        raidLevel: 400,
      },
    }),
  });
  const cells = tileToCsvCells(tile);
  const back = parseTileGrid([[...TILE_CSV_COLUMNS], cells]).rows[0];
  assert.deepEqual(back.effortConfig, {
    skillRating: 4,
    expectedHours: 2.25,
    raid: {
      mode: 'tombsOfAmascutExpertMode',
      uniqueDenominator: 10.5,
      completionMinutes: 40,
      raidLevel: 400,
    },
  });
});

test('bulk suggestion revision is stable by tile id and changes with points or edits', () => {
  const rows = [
    { id: 2, points: 25, updatedAt: '2026-01-02T00:00:00Z' },
    { id: 1, points: 10, updatedAt: null },
  ];
  const revision = tileBalanceRevision(rows);

  assert.equal(tileBalanceRevision([...rows].reverse()), revision);
  assert.notEqual(tileBalanceRevision([{ ...rows[0], points: 30 }, rows[1]]), revision);
  assert.notEqual(tileBalanceRevision([{ ...rows[0], updatedAt: '2026-01-03T00:00:00Z' }, rows[1]]), revision);
});
