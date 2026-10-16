// lib/eventWrappedRules: the pure half of Wrapped. Shaping, formatting and card picks.
//
// Run: npx tsx --test tests/event-wrapped-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardFeature,
  cardHours,
  formatHours,
  luckLine,
  ordinal,
  playerCardStats,
  shapeWrapped,
  shortNumber,
  type WrappedLuckRow,
  type WrappedMomentRow,
  type WrappedPlayer,
  type WrappedStanding,
} from '../src/lib/eventWrappedRules';
import type { WrappedPersonStats } from '@/lib/eventRecap';

function person(over: Partial<WrappedPersonStats> & { personKey: string }): WrappedPersonStats {
  return {
    name: over.personKey,
    teamId: null,
    playerIds: [],
    xpGained: 0,
    kcGained: 0,
    minutesPlayed: 0,
    deaths: 0,
    biggestHit: 0,
    tilesFinished: 0,
    topBoss: null,
    topSkill: null,
    awardsWon: [],
    ...over,
  };
}

const standings: WrappedStanding[] = [
  { teamId: 1, name: 'Team Blue', color: '#00f', score: 10, unit: 'tiles' },
  { teamId: 2, name: 'Team Red', color: '#f00', score: 30, unit: 'tiles' },
];

function moment(over: Partial<WrappedMomentRow> & { kind: string }): WrappedMomentRow {
  return { playerId: null, teamId: null, itemId: null, itemName: null, valueGp: null, ...over };
}

function playerFixture(over: Partial<WrappedPlayer> = {}): WrappedPlayer {
  return {
    personKey: 'p',
    playerIds: [],
    name: 'P',
    team: null,
    placeInTeam: null,
    minutesPlayed: 0,
    xpGained: 0,
    kcGained: 0,
    deaths: 0,
    biggestHit: 0,
    tilesFinished: 0,
    topBoss: null,
    topSkill: null,
    biggestDrop: null,
    pets: [],
    spooned: null,
    dry: null,
    awards: [],
    ...over,
  };
}

test('shapeWrapped: alts are one person across both seats playerIds', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'alice', name: 'Alice', playerIds: [11, 12], tilesFinished: 2 })],
    awards: [],
    standings: [],
    moments: [
      moment({ playerId: 11, kind: 'unique', itemId: 1, itemName: 'Ultor vestige', valueGp: 5 }),
      moment({ playerId: 12, kind: 'pet', itemId: 2, itemName: 'Pet snakeling' }),
    ],
    luck: [],
  });
  assert.equal(out.players.length, 1);
  assert.deepEqual(out.players[0].pets.map((p) => p.itemName), ['Pet snakeling']);
  assert.equal(out.players[0].biggestDrop?.itemName, 'Ultor vestige');
});

test('shapeWrapped: a pet beats the biggest drop in cardFeature', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'a', playerIds: [1], tilesFinished: 1 })],
    awards: [],
    standings: [],
    moments: [
      moment({ playerId: 1, kind: 'unique', itemId: 10, itemName: 'Big unique', valueGp: 999_000_000 }),
      moment({ playerId: 1, kind: 'pet', itemId: 20, itemName: 'Pet thing' }),
    ],
    luck: [],
  });
  const feature = cardFeature(out.players[0]);
  assert.equal(feature?.kicker, 'Pet');
  assert.equal(feature?.name, 'Pet thing');
  assert.equal(feature?.detail, null);
});

test('shapeWrapped: biggestDrop is the highest valueGp among unique/loot and ignores deaths', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'a', playerIds: [1], tilesFinished: 1 })],
    awards: [],
    standings: [],
    moments: [
      moment({ playerId: 1, kind: 'loot', itemId: 1, itemName: 'Cheap loot', valueGp: 100 }),
      moment({ playerId: 1, kind: 'death', itemId: 2, itemName: 'Death thing', valueGp: 9_000_000 }),
      moment({ playerId: 1, kind: 'unique', itemId: 3, itemName: 'Good unique', valueGp: 5_000 }),
      moment({ playerId: 1, kind: 'loot', itemId: 4, itemName: 'Best loot', valueGp: 7_000 }),
    ],
    luck: [],
  });
  assert.equal(out.players[0].biggestDrop?.itemName, 'Best loot');
  assert.equal(out.players[0].biggestDrop?.valueGp, 7_000);
});

test('shapeWrapped: all-zero person with no drops or awards gets no card', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'idle', playerIds: [5] }), person({ personKey: 'busy', playerIds: [6], minutesPlayed: 30 })],
    awards: [],
    standings: [],
    moments: [],
    luck: [],
  });
  assert.deepEqual(out.players.map((p) => p.personKey), ['busy']);
});

test('shapeWrapped: placeInTeam orders by tiles, then kills, then XP', () => {
  const out = shapeWrapped({
    people: [
      person({ personKey: 'low', name: 'Low', teamId: 1, playerIds: [1], tilesFinished: 1, kcGained: 50, xpGained: 9 }),
      person({ personKey: 'top', name: 'Top', teamId: 1, playerIds: [2], tilesFinished: 3, kcGained: 1, xpGained: 1 }),
      person({ personKey: 'kc', name: 'Kc', teamId: 1, playerIds: [3], tilesFinished: 1, kcGained: 60, xpGained: 1 }),
      person({ personKey: 'xp', name: 'Xp', teamId: 1, playerIds: [4], tilesFinished: 1, kcGained: 50, xpGained: 99 }),
    ],
    awards: [],
    standings,
    moments: [],
    luck: [],
  });
  const place = Object.fromEntries(out.players.map((p) => [p.personKey, p.placeInTeam?.rank]));
  assert.deepEqual(place, { top: 1, kc: 2, xp: 3, low: 4 });
  assert.equal(out.players[0].placeInTeam?.of, 4);
});

test('shapeWrapped: a one-person team gives placeInTeam null', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'solo', teamId: 2, playerIds: [7], tilesFinished: 4 })],
    awards: [],
    standings,
    moments: [],
    luck: [],
  });
  assert.equal(out.players[0].placeInTeam, null);
});

test('shapeWrapped: team rank by score desc and team mvp is the top contributor', () => {
  const out = shapeWrapped({
    people: [
      person({ personKey: 'b1', name: 'Blue One', teamId: 1, playerIds: [1], tilesFinished: 1 }),
      person({ personKey: 'b2', name: 'Blue Two', teamId: 1, playerIds: [2], tilesFinished: 5 }),
      person({ personKey: 'r1', name: 'Red One', teamId: 2, playerIds: [3], tilesFinished: 2 }),
    ],
    awards: [],
    standings,
    moments: [],
    luck: [],
  });
  const red = out.teams.find((t) => t.id === 2)!;
  const blue = out.teams.find((t) => t.id === 1)!;
  assert.equal(red.rank, 1);
  assert.equal(blue.rank, 2);
  assert.equal(red.of, 2);
  assert.equal(blue.mvp, 'Blue Two');
  assert.equal(red.mvp, 'Red One');
});

test('shapeWrapped: team awards are matched by winner.teamName', () => {
  const out = shapeWrapped({
    people: [person({ personKey: 'r1', name: 'Red One', teamId: 2, playerIds: [3], tilesFinished: 1 })],
    awards: [
      { emoji: '🏆', title: 'MVP', winner: { name: 'Red One', teamName: 'Team Red' } },
      { emoji: '💀', title: 'Feeder', winner: { name: 'Blue Guy', teamName: 'Team Blue' } },
      { emoji: '🎲', title: 'Unaffiliated', winner: { name: 'Nobody', teamName: null } },
    ],
    standings,
    moments: [],
    luck: [],
  });
  assert.deepEqual(out.teams.find((t) => t.id === 2)!.awards, [{ emoji: '🏆', title: 'MVP', winner: 'Red One' }]);
  assert.deepEqual(out.teams.find((t) => t.id === 1)!.awards.map((a) => a.title), ['Feeder']);
});

test('shapeWrapped: luck takes the smallest tail per tone', () => {
  const row = (over: Partial<WrappedLuckRow>): WrappedLuckRow => ({
    playerId: 1,
    tone: 'dry',
    itemId: 1,
    itemName: 'Item',
    obtained: 0,
    expected: 1,
    expectedLow: 1,
    tail: 0.5,
    ...over,
  });
  const out = shapeWrapped({
    people: [person({ personKey: 'a', playerIds: [1], tilesFinished: 1 })],
    awards: [],
    standings: [],
    moments: [],
    luck: [
      row({ tone: 'spooned', itemId: 10, itemName: 'Spoon common', obtained: 3, expected: 0.4, expectedLow: 0.4, tail: 0.2 }),
      row({ tone: 'spooned', itemId: 11, itemName: 'Spoon rare', obtained: 2, expected: 0.1, expectedLow: 0.1, tail: 0.01 }),
      row({ tone: 'dry', itemId: 12, itemName: 'Dry one', obtained: 0, expected: 4, expectedLow: 4, tail: 0.3 }),
      row({ tone: 'dry', itemId: 13, itemName: 'Dry two', obtained: 0, expected: 9, expectedLow: 9, tail: 0.05 }),
    ],
  });
  assert.equal(out.players[0].spooned?.itemName, 'Spoon rare');
  assert.equal(out.players[0].dry?.itemName, 'Dry two');
});

test('luckLine prefers spooned over dry', () => {
  const spooned = { itemId: 1, itemName: 'Scythe', headline: '3 of 0.4 expected' };
  const dry = { itemId: 2, itemName: 'Tassets', headline: '0 of 4 expected' };
  assert.equal(luckLine(playerFixture({ spooned, dry })), 'Spooned: Scythe, 3 of 0.4 expected');
  assert.equal(luckLine(playerFixture({ dry })), 'Dry: Tassets, 0 of 4 expected');
  assert.equal(luckLine(playerFixture()), null);
});

test('ordinal handles teens and the 1/2/3 endings', () => {
  const cases: [number, string][] = [
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [111, '111th'],
  ];
  for (const [n, want] of cases) assert.equal(ordinal(n), want, String(n));
});

test('shortNumber matches the code: plain under 10K, rounded K, one-decimal M/B', () => {
  assert.equal(shortNumber(950), '950');
  assert.equal(shortNumber(9_999), '9,999');
  assert.equal(shortNumber(12_345), '12K');
  assert.equal(shortNumber(1_250_000), '1.3M');
  assert.equal(shortNumber(2_000_000_000), '2B');
});

test('formatHours: minutes under an hour, whole hours, and hours plus minutes', () => {
  assert.equal(formatHours(45), '45m');
  assert.equal(formatHours(60), '1h');
  assert.equal(formatHours(125), '2h 5m');
});

test('playerCardStats returns at most 4 entries and skips zeros', () => {
  const all = playerCardStats(
    playerFixture({ minutesPlayed: 90, kcGained: 5, xpGained: 100_000, tilesFinished: 3, deaths: 2 }),
  );
  assert.equal(all.length, 4);
  assert.deepEqual(all.map((s) => s.label), ['Played', 'Boss kills', 'XP gained', 'Tiles']);

  const sparse = playerCardStats(playerFixture({ minutesPlayed: 0, kcGained: 0, xpGained: 0, tilesFinished: 7, deaths: 0 }));
  assert.deepEqual(sparse, [{ label: 'Tiles', value: '7' }]);
});

test('cardHours: whole hours for the stat box, minutes under one', () => {
  assert.equal(cardHours(490), '8h');
  assert.equal(cardHours(60), '1h');
  assert.equal(cardHours(2480), '41h');
  assert.equal(cardHours(45), '45m');
  assert.equal(playerCardStats(playerFixture({ minutesPlayed: 2480 }))[0].value, '41h');
});

test('cardFeature: with no pet or drop, the boss they ground is the picture', () => {
  const f = cardFeature({ pets: [], biggestDrop: null, topBoss: { name: 'Zulrah', kc: 1204 } });
  assert.equal(f?.kicker, 'Most killed');
  assert.equal(f?.name, 'Zulrah');
  assert.equal(f?.detail, '1,204 KC');
  assert.ok(f?.image);
  assert.equal(cardFeature({ pets: [], biggestDrop: null, topBoss: null }), null);
});
