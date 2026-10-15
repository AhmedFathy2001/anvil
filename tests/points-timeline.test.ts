// Points over time (lib/pointsTimeline) — the stats page's team and top-scorer curves.
//
// Run: npx tsx --test tests/points-timeline.test.ts
// (tsx for the `@/` alias; the module itself is pure and touches no database.)
//
// The curves must land exactly on the numbers the rest of the site shows: the last team point is
// scoreTeams, the last player point is the MVP split. These cases pin the rules that feed both.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePointsTimeline, timelineBuckets, timelineStep, type TimelineCompletion } from '../src/lib/pointsTimeline.ts';

const H = 3_600_000;
const D = 24 * H;
const START = Date.parse('2026-10-01T00:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const TEAMS = [{ id: 1 }, { id: 2 }];
const PLAYERS = [
  { id: 11, name: 'Alice', teamId: 1 },
  { id: 12, name: 'Bob', teamId: 1 },
  { id: 21, name: 'Cara', teamId: 2 },
];
const TILES = [
  { id: 1, points: 10 },
  { id: 2, points: 20 },
  { id: 3, points: 30, optional: 1 },
  { id: 4, points: 40, trackedStat: 'zulrah', statType: 'boss' },
];

const run = (completions: TimelineCompletion[], over: Partial<Parameters<typeof computePointsTimeline>[0]> = {}) =>
  computePointsTimeline({
    scoringMode: 'points',
    startMs: START,
    toMs: START + 4 * H,
    teams: TEAMS,
    players: PLAYERS,
    tiles: TILES,
    completions,
    submissions: [],
    ...over,
  });

const team = (t: ReturnType<typeof run>, id: number) => t.teams.find((x) => x.teamId === id)!.values;
const player = (t: ReturnType<typeof run>, name: string) => t.players.find((x) => x.name === name)?.values;

test('bucketing: hourly up to a week, 6-hourly up to a month, daily after', () => {
  assert.equal(timelineStep(7 * D), H);
  assert.equal(timelineStep(7 * D + 1), 6 * H);
  assert.equal(timelineStep(31 * D), 6 * H);
  assert.equal(timelineStep(60 * D), D);
  // Start, every whole step before the end, then the end itself — never a duplicate last point.
  assert.deepEqual(timelineBuckets(0, 3 * H, H), [0, H, 2 * H, 3 * H]);
  assert.deepEqual(timelineBuckets(0, 2.5 * H, H), [0, H, 2 * H, 2.5 * H]);
  assert.deepEqual(timelineBuckets(0, 0, H), [0]);
});

test('team curve steps up at each completion and starts at zero', () => {
  const t = run([
    { teamId: 1, tileId: 1, completedAt: iso(START + 30 * 60_000), creditPlayerId: 11 },
    { teamId: 1, tileId: 2, completedAt: iso(START + 2 * H + 1), creditPlayerId: 11 },
    { teamId: 2, tileId: 2, completedAt: iso(START + 3 * H), creditPlayerId: 21 },
  ]);
  assert.deepEqual(t.at, [START, START + H, START + 2 * H, START + 3 * H, START + 4 * H]);
  assert.deepEqual(team(t, 1), [0, 10, 10, 30, 30]);
  // A completion exactly on a boundary counts at that boundary.
  assert.deepEqual(team(t, 2), [0, 0, 0, 20, 20]);
  assert.equal(t.unit, 'pts');
});

test('a frozen awardedPoints replaces the tile weight', () => {
  const t = run([{ teamId: 1, tileId: 1, completedAt: iso(START + H), awardedPoints: 15, creditPlayerId: 11 }]);
  assert.deepEqual(team(t, 1), [0, 15, 15, 15, 15]);
  assert.deepEqual(player(t, 'Alice'), [0, 15, 15, 15, 15]);
});

test('optional tiles score nothing, for the team or the player', () => {
  const t = run([{ teamId: 1, tileId: 3, completedAt: iso(START + H), creditPlayerId: 11 }]);
  assert.deepEqual(team(t, 1), [0, 0, 0, 0, 0]);
  assert.equal(player(t, 'Alice'), undefined); // nobody with points makes the top list
});

test('classic mode counts tiles, not points', () => {
  const t = run(
    [
      { teamId: 1, tileId: 1, completedAt: iso(START + H) },
      { teamId: 1, tileId: 2, completedAt: iso(START + 2 * H) },
    ],
    { scoringMode: 'classic' },
  );
  assert.deepEqual(team(t, 1), [0, 1, 2, 2, 2]);
  assert.equal(t.unit, 'tiles');
});

test('a stat tile splits by its frozen contributions, at the moment it completed', () => {
  const t = run([
    {
      teamId: 1,
      tileId: 4,
      completedAt: iso(START + 2 * H),
      statContributions: { goal: 40, total: 40, split: [{ playerId: 11, gained: 30 }, { playerId: 12, gained: 10 }] },
    },
  ]);
  assert.deepEqual(player(t, 'Alice'), [0, 0, 30, 30, 30]);
  assert.deepEqual(player(t, 'Bob'), [0, 0, 10, 10, 10]);
  assert.deepEqual(t.players.map((p) => p.name), ['Alice', 'Bob']);
});

test('submission tiles split by amount; top N keeps the best by final points', () => {
  const t = run(
    [
      { teamId: 1, tileId: 2, completedAt: iso(START + H) },
      { teamId: 2, tileId: 1, completedAt: iso(START + 3 * H), creditPlayerId: 21 },
    ],
    {
      submissions: [
        { teamId: 1, tileId: 2, creditPlayerId: 11, amount: 3 },
        { teamId: 1, tileId: 2, creditPlayerId: 12, amount: 1 },
        // Work on a tile the team never finished moves nothing.
        { teamId: 2, tileId: 2, creditPlayerId: 21, amount: 9 },
      ],
      topN: 2,
    },
  );
  assert.deepEqual(player(t, 'Alice'), [0, 15, 15, 15, 15]);
  assert.deepEqual(player(t, 'Cara'), [0, 0, 0, 10, 10]);
  assert.deepEqual(t.players.map((p) => p.name), ['Alice', 'Cara']);
});

test('nothing before the start scores', () => {
  const t = run([{ teamId: 1, tileId: 1, completedAt: iso(START - H), creditPlayerId: 11 }]);
  assert.deepEqual(team(t, 1), [0, 0, 0, 0, 0]);
});
