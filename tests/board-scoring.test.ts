// Board scoring (lib/boardScoring) — the one function every surface sums a team's points with.
//
// Run: npx tsx --test tests/board-scoring.test.ts
// (tsx for the `@/` alias; the module itself is pure and touches no database.)
//
// The behaviour under test exists because these numbers used to be computed eleven different ways.
// The two that mattered disagreed about missions: the scoreboard scored them at zero, and
// getTeamStandings — the function payouts reads — scored them at full value AND counted unannounced
// ones in the denominator. So the cases below are mostly about missions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreTeams, scoreTeam, formatScore, type ScoringTile } from '../src/lib/boardScoring.ts';
import { DEFAULT_EVENT_RULES, type EventRules } from '../src/lib/eventRules.ts';

const RULES: EventRules = DEFAULT_EVENT_RULES;
const TEAMS = [{ id: 1 }, { id: 2 }];

/** Four board tiles worth 10/20/30/40, so any subset sums to something recognisable. */
const BOARD: ScoringTile[] = [
  { id: 1, points: 10 },
  { id: 2, points: 20 },
  { id: 3, points: 30 },
  { id: 4, points: 40 },
];

const points = (over: Partial<Parameters<typeof scoreTeams>[0]> = {}) =>
  scoreTeams({ scoringMode: 'points', rules: RULES, tiles: BOARD, completions: [], teams: TEAMS, ...over });

test('points mode: a team scores the tiles it finished, out of the board total', () => {
  const [a, b] = points({ completions: [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 3 }, { teamId: 2, tileId: 4 }] });
  assert.equal(a.score, 40);
  assert.equal(a.total, 100);
  assert.equal(a.pct, 40);
  assert.equal(a.unit, 'pts');
  assert.equal(b.score, 40);
  // Nobody has a bonus on a board with no missions.
  assert.equal(a.bonusScore, 0);
  assert.equal(b.bonusScore, 0);
});

test('classic mode: every tile is worth one, and the unit says so', () => {
  const [a] = scoreTeams({
    scoringMode: 'tiles',
    rules: RULES,
    tiles: BOARD,
    completions: [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 4 }],
    teams: TEAMS,
  });
  assert.equal(a.score, 2);
  assert.equal(a.total, 4);
  assert.equal(a.unit, 'tiles');
});

// ── Missions ────────────────────────────────────────────────────────────────────────────────────

const WITH_MISSIONS: ScoringTile[] = [
  ...BOARD,
  { id: 90, points: 50, mission: 1, revealedAt: '2026-08-19T00:00:00.000Z' }, // announced
  { id: 91, points: 70, mission: 1 }, // still hidden
];

test('a mission never moves the board total — announced or not', () => {
  const without = points()[0];
  const with_ = points({ tiles: WITH_MISSIONS })[0];
  // 100, both ways. This is the whole point: announcing a mission mid-event must not shift the
  // denominator under every team at once.
  assert.equal(without.total, 100);
  assert.equal(with_.total, 100);
});

test('a mission scores as BONUS, on top of the board', () => {
  const [a] = points({
    tiles: WITH_MISSIONS,
    completions: [{ teamId: 1, tileId: 2 }, { teamId: 1, tileId: 90 }],
  });
  assert.equal(a.boardScore, 20);
  assert.equal(a.bonusScore, 50);
  assert.equal(a.score, 70);
  // The percentage is BOARD progress. The bonus is real points but not board progress, so 20/100.
  assert.equal(a.pct, 20);
});

test('a bonus can carry a team past the board total', () => {
  const [a] = points({
    tiles: WITH_MISSIONS,
    completions: [1, 2, 3, 4, 90].map((tileId) => ({ teamId: 1, tileId })),
  });
  assert.equal(a.boardScore, 100);
  assert.equal(a.bonusScore, 50);
  assert.equal(a.score, 150);
  assert.ok(a.score > a.total, 'a bonus is allowed to exceed the board');
  assert.equal(a.pct, 100, 'but board progress still clamps at 100');
});

test('a board with no missions scores exactly as it did before missions existed', () => {
  const completions = [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 2 }, { teamId: 2, tileId: 3 }];
  const [a, b] = points({ completions });
  assert.deepEqual(
    { score: a.score, total: a.total, pct: a.pct, bonus: a.bonusScore },
    { score: 30, total: 100, pct: 30, bonus: 0 },
  );
  assert.deepEqual(
    { score: b.score, total: b.total, pct: b.pct, bonus: b.bonusScore },
    { score: 30, total: 100, pct: 30, bonus: 0 },
  );
});

// ── Frozen awards, optional tiles, reveal policies ──────────────────────────────────────────────

test('a frozen awardedPoints beats the tile\'s live weight — history is not re-priced', () => {
  const [a] = points({
    tiles: WITH_MISSIONS,
    // Tile 1 is worth 10 but was finished first for 25; the mission decayed from 50 to 35.
    completions: [
      { teamId: 1, tileId: 1, awardedPoints: 25 },
      { teamId: 1, tileId: 90, awardedPoints: 35 },
    ],
  });
  assert.equal(a.boardScore, 25);
  assert.equal(a.bonusScore, 35);
});

test('a frozen award is ignored in classic mode, where every tile is worth one', () => {
  const [a] = scoreTeams({
    scoringMode: 'tiles',
    rules: RULES,
    tiles: BOARD,
    completions: [{ teamId: 1, tileId: 1, awardedPoints: 25 }],
    teams: TEAMS,
  });
  assert.equal(a.score, 1);
});

test('optional tiles score nothing and are not in the total', () => {
  const tiles: ScoringTile[] = [...BOARD, { id: 5, points: 500, optional: 1 }];
  const [a] = points({ tiles, completions: [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 5 }] });
  assert.equal(a.total, 100, 'the optional tile stays out of the denominator');
  assert.equal(a.score, 10, 'and earns nothing');
});

test('a reveal board counts only the tiles drawn so far, unless told the whole pool', () => {
  const rules: EventRules = { ...RULES, revealPolicy: 'bounty' };
  const tiles: ScoringTile[] = [
    { id: 1, points: 10, revealedAt: '2026-08-16T00:00:00.000Z' },
    { id: 2, points: 20, revealedAt: '2026-08-17T00:00:00.000Z' },
    { id: 3, points: 30 },
    { id: 4, points: 40 },
  ];
  const drawn = scoreTeams({ scoringMode: 'points', rules, tiles, completions: [], teams: TEAMS })[0];
  assert.equal(drawn.total, 30, 'only what has been drawn');

  // A caller that knows the whole pool pins the denominator, so the percentage doesn't leap around
  // as tiles are drawn.
  const pooled = scoreTeams({
    scoringMode: 'points',
    rules,
    tiles,
    completions: [],
    teams: TEAMS,
    boardPointsTotal: 100,
  })[0];
  assert.equal(pooled.total, 100);
});

test('completions for tiles not on the board are ignored, not counted', () => {
  const [a] = points({ completions: [{ teamId: 1, tileId: 999 }] });
  assert.equal(a.score, 0);
});

test('a team with no completions still gets a row', () => {
  const [a, b] = points({ completions: [{ teamId: 1, tileId: 4 }] });
  assert.equal(a.score, 40);
  assert.deepEqual({ score: b.score, bonus: b.bonusScore, pct: b.pct }, { score: 0, bonus: 0, pct: 0 });
});

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────

test('scoreTeam: the single-team shorthand agrees with scoreTeams', () => {
  const completions = [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 90 }];
  const one = scoreTeam({ scoringMode: 'points', rules: RULES, tiles: WITH_MISSIONS, completions, teamId: 1 });
  const [many] = points({ tiles: WITH_MISSIONS, completions, teams: [{ id: 1 }] });
  assert.deepEqual(one, many);
});

test('formatScore: the bonus shows only when there is one', () => {
  assert.equal(formatScore({ score: 185, bonusScore: 50, unit: 'pts' }), '185 pts (+50 bonus)');
  assert.equal(formatScore({ score: 125, bonusScore: 0, unit: 'pts' }), '125 pts');
  assert.equal(formatScore({ score: 3, bonusScore: 0, unit: 'tiles' }), '3 tiles');
});
