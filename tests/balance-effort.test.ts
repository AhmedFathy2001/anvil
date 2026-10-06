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
  // Tbow is 1/30 of the table and the default personal purple assumption is 1/30. A typical
  // three-player raid has three personal reward rolls; the team hit chance is 1-(899/900)^3 — and
  // each raid costs all three players' time, so the price is in PLAYER-hours (× 3).
  closeTo(base.hours![1], (1 / (1 - Math.pow(899 / 900, 3))) * (50 / 60) * 3);
  assert.match(base.note ?? '', /raid_luck_rates/);

  const tuned = analyzeEffort([raidDropTile()], {
    pointsMode: true,
    raidRatesOverride: { chambersOfXeric: 15 },
  }).perTile[0];
  closeTo(tuned.hours![1], (1 / (1 - Math.pow(449 / 450, 3))) * (50 / 60) * 3);
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
  // Shadow is 1/24 conditional on a personal purple. A typical three-player raid has three rolls,
  // and three players' time (player-hours).
  closeTo(effort.hours![1], (1 / (1 - Math.pow(239 / 240, 3))) * (40 / 60) * 3);
});

test('multi-target kill tiles choose the fastest valid target instead of a listed superior', () => {
  const effort = analyzeEffort([{
    ...raidDropTile(),
    tileType: 'kill',
    trackedItemIds: null,
    sourceNpcs: null,
    requiredAmount: 500,
    targetNpcs: JSON.stringify(['Bloodveld', 'Insatiable Bloodveld']),
  }], { pointsMode: true }).perTile[0];

  closeTo(effort.hours![1], (500 * 16) / 3600);
  assert.match(effort.note ?? '', /generic mob/);
  assert.equal(effort.suggestionStatus, 'needs-calibration');
  assert.equal(effort.suggestedPoints, null);
});

test('ordinary monster drops use the mob fallback and wait for calibration before repricing', () => {
  const effort = analyzeEffort([raidDropTile({
    label: 'Abyssal whip',
    trackedItemIds: JSON.stringify([4151]),
    sourceNpcs: JSON.stringify(['Abyssal demon']),
  })], { pointsMode: true }).perTile[0];

  closeTo(effort.hours![1], (512 * 16) / 3600);
  assert.equal(effort.oneOff, false, 'a one-drop tile can still be hours of effort');
  assert.equal(effort.suggestionStatus, 'needs-calibration');
  assert.equal(effort.suggestedPoints, null);
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

test('Inferno benchmarks price one KC, GM speed, and five-KC marginal work as 100/150/200', () => {
  const base = {
    ...raidDropTile(),
    tileType: 'standard',
    trackedItemIds: null,
    sourceNpcs: null,
    trackedStat: 'tzKalZuk',
    statType: 'boss',
    effortConfig: null,
  };
  const report = analyzeEffort([
    { ...base, id: 1, label: 'One Zuk KC', statGoal: 1, points: 100 },
    {
      ...base,
      id: 2,
      label: '65-minute Inferno',
      tileType: 'timed',
      trackedStat: null,
      statGoal: null,
      timedActivity: 'Inferno',
      timeThresholdSeconds: 65 * 60,
      points: 150,
    },
    { ...base, id: 3, label: 'Five Zuk KC', statGoal: 5, points: 200 },
  ], { pointsMode: true, eventDays: 14 });

  assert.deepEqual(report.perTile.map((tile) => tile.suggestedPoints), [100, 150, 200]);
  assert.equal(report.suggestionBudget, 450);
  assert.equal(report.suggestedBudget, 450);
  assert.ok(report.perTile[2].overlapCreditHours > 0, 'five KC should price only work after the first');
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

test('suggestions redistribute an exact fixed budget instead of learning from current median prices', () => {
  const base = {
    ...raidDropTile(),
    tileType: 'standard',
    trackedItemIds: null,
    sourceNpcs: null,
    statType: 'skill',
    effortConfig: null,
  };
  const report = analyzeEffort([
    { ...base, id: 1, label: 'One hour', trackedStat: 'mining', statGoal: 100, points: 300 },
    { ...base, id: 2, label: 'Two hours', trackedStat: 'fishing', statGoal: 200, points: 200 },
    { ...base, id: 3, label: 'Three hours', trackedStat: 'woodcutting', statGoal: 300, points: 100 },
  ], {
    pointsMode: true,
    ratesOverride: {
      skills: {
        mining: { xpPerHour: [100, 100, 100], floor: 'anyone' },
        fishing: { xpPerHour: [100, 100, 100], floor: 'anyone' },
        woodcutting: { xpPerHour: [100, 100, 100], floor: 'anyone' },
      },
    },
  });

  assert.equal(report.suggestionBudget, 600);
  assert.equal(report.suggestedBudget, 600);
  assert.deepEqual(report.perTile.map((tile) => tile.suggestedPoints), [100, 200, 300]);
});

test('suggestion rounding preserves the budget when every row is close to its floor', () => {
  const base = {
    ...raidDropTile(),
    tileType: 'standard',
    trackedItemIds: null,
    sourceNpcs: null,
    trackedStat: 'mining',
    statType: 'skill',
    statGoal: 100,
    effortConfig: null,
  };
  const report = analyzeEffort(Array.from({ length: 10 }, (_, index) => ({
    ...base,
    id: index + 1,
    label: `Equal tile ${index + 1}`,
    points: index < 5 ? 5 : 6,
  })), {
    pointsMode: true,
    ratesOverride: { skills: { mining: { xpPerHour: [100, 100, 100], floor: 'anyone' } } },
  });

  assert.equal(report.suggestionBudget, 55);
  assert.equal(report.suggestedBudget, 55);
  assert.equal(report.perTile.reduce((sum, tile) => sum + (tile.suggestedPoints ?? 0), 0), 55);
});

test('deterministic objectives that do not fit the event are not auto-priced', () => {
  const effort = analyzeEffort([{
    ...raidDropTile(),
    tileType: 'standard',
    trackedItemIds: null,
    sourceNpcs: null,
    trackedStat: 'mining',
    statType: 'skill',
    statGoal: 50_000,
  }], {
    pointsMode: true,
    eventDays: 10,
    ratesOverride: { skills: { mining: { xpPerHour: [100, 100, 100], floor: 'anyone' } } },
  }).perTile[0];

  assert.equal(effort.pClass, 'unreachable');
  assert.equal(effort.suggestionStatus, 'unreachable');
  assert.equal(effort.suggestedPoints, null);
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

// ── Review fixes (2026-10-06) ────────────────────────────────────────────────────────────────

function statTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 50,
    eventId: 1,
    position: 0,
    label: 'Stat tile',
    tileType: 'standard',
    points: 50,
    ...overrides,
  } as Tile;
}

test('raid KC is priced in player-hours, not party clock time', () => {
  const t = statTile({ label: '20 CoX KC', trackedStat: 'chambersOfXeric', statType: 'boss', statGoal: 20 });
  const effort = analyzeEffort([t], { pointsMode: true }).perTile[0];
  assert.ok(effort.hours);
  // 20 raids' worth of KC across a 3-man party = 20 × one raid's time in player-hours, not 20/3.
  const solo = analyzeEffort([statTile({ label: '1 CoX KC', trackedStat: 'chambersOfXeric', statType: 'boss', statGoal: 1 })], { pointsMode: true }).perTile[0];
  closeTo(effort.hours![1], solo.hours![1] * 20);
});

test('missions are left out of the board: no median, no repricing', () => {
  const tiles = [
    statTile({ id: 1, label: 'Board', trackedStat: 'vorkath', statType: 'boss', statGoal: 50 }),
    statTile({ id: 2, label: 'Mission', trackedStat: 'vorkath', statType: 'boss', statGoal: 10, mission: 1, points: 500 }),
  ];
  const report = analyzeEffort(tiles, { pointsMode: true });
  assert.deepEqual(report.perTile.map((x) => x.tileId), [1]);
  assert.equal(report.perTile[0].overlapCreditHours, 0, 'no credit from a mission milestone');
});

test('a lifetime milestone is not priced as an in-event gain', () => {
  const t = statTile({ label: 'Reach 99 Attack', trackedStat: 'attack', statType: 'skill', statGoal: 13_034_431, statBasis: 'milestone' });
  const effort = analyzeEffort([t], { pointsMode: true }).perTile[0];
  assert.equal(effort.hours, null);
  assert.match(effort.note ?? '', /lifetime/);
});

test('group-boss drops are split across the group', () => {
  const sigil = raidDropTile({ label: 'Elysian sigil', trackedItemIds: JSON.stringify([12819]), sourceNpcs: JSON.stringify(['Corporeal Beast']) });
  const corp = (lootSplit: number) => ({
    activities: { 'corporeal beast': { killSeconds: [100, 104, 150], floor: 'high', lootSplit } },
  });
  const split = analyzeEffort([sigil], { pointsMode: true, ratesOverride: corp(5) }).perTile[0];
  const solo = analyzeEffort([sigil], { pointsMode: true, ratesOverride: corp(1) }).perTile[0];
  // Shipped default: Corp carries a 5-way split.
  const shipped = analyzeEffort([sigil], { pointsMode: true }).perTile[0];
  assert.match(String(shipped.hours?.[1]), /\d/);
  assert.ok(split.hours && solo.hours);
  closeTo(split.hours![1], solo.hours![1] * 5);
});

test('a team-tracked XP goal fits a window the whole team feeds', () => {
  const t = statTile({ label: '5M Slayer XP', trackedStat: 'slayer', statType: 'skill', statGoal: 5_000_000 });
  const two = analyzeEffort([t], { pointsMode: true, eventDays: 10 }).perTile[0];
  const eight = analyzeEffort([t], { pointsMode: true, eventDays: 10, teamSize: 8 }).perTile[0];
  assert.equal(two.pClass, 'unreachable', 'two campers can’t make it');
  assert.notEqual(eight.pClass, 'unreachable', 'eight players can');
});

test('over/underpaid flags come from the server and need five graded tiles', () => {
  const few = analyzeEffort(
    [statTile({ id: 1, trackedStat: 'vorkath', statType: 'boss', statGoal: 50, points: 500 })],
    { pointsMode: true },
  );
  assert.equal(few.perTile[0].pphFlag, null);
});

