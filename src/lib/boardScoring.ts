// How a team's score is calculated — the ONE place that answers it.
//
// Before this module, eleven surfaces each hand-rolled the same reduce: the event scoreboard, the
// captain board, My Team, the player dashboard, two team boards, the admin overview, payouts, the
// event cards, the lifecycle sweep and the Discord commands. They agreed on ordinary tiles and
// disagreed about MISSIONS, which is how the site ended up showing members one set of standings
// while paying prize money against another:
//
//   - the event scoreboard scored missions at ZERO (it built its weight map from boardTiles, so a
//     mission completion matched nothing and was skipped), while
//   - getTeamStandings scored them at FULL value on a classic board and counted the unannounced
//     ones in the denominator too — and that is the function lib/payouts reads.
//
// A mission is a bonus. It drops mid-event from its own pool, scores under its own lockout /
// first-bonus / decay rules, and can expire unclaimed. So it must never move the board's total —
// announcing one mid-event would otherwise shift the denominator under every team at once — but it
// must still be worth the points it advertises. That means a team's score has two parts, and the
// percentage is measured against the board alone. A team CAN finish above 100%; that is what a
// bonus is.
//
// Pure by design (no `@/db`), so server code and client components share one implementation rather
// than two that drift — the same reason lib/eventRules is importable from both.

import { DEFAULT_EVENT_RULES, boardTiles, isMissionTile, visibleTiles, type EventRules } from '@/lib/eventRules';
import { tileWeight } from '@/lib/utils';

/** The tile fields scoring reads. A superset of this (the full row) is always fine to pass. */
export interface ScoringTile {
  id: number;
  points?: number | null;
  optional?: number | boolean | null;
  mission?: number | boolean | null;
  revealAt?: string | null;
  revealedAt?: string | null;
  closedAt?: string | null;
}

/** The completion fields scoring reads. */
export interface ScoringCompletion {
  teamId: number;
  tileId: number;
  /** Points frozen at completion by lib/completionGate (first-team bonus, reveal/mission decay). */
  awardedPoints?: number | null;
}

export interface TeamScore {
  teamId: number;
  /** Points from base board tiles — the currency the total is denominated in. */
  boardScore: number;
  /** Points from missions. On top; never counted in `total`. */
  bonusScore: number;
  /** What the team has earned altogether: boardScore + bonusScore. */
  score: number;
  /** The board's own total. Missions never move this, announced or not. */
  total: number;
  unit: 'pts' | 'tiles';
  /** Board progress only, clamped to 100 — so a bonus can't read as ">100% of the board". */
  pct: number;
}

/** True for a tile that doesn't count toward the board total (`optional` across its int/bool shapes). */
function isOptional(tile: ScoringTile): boolean {
  return tile.optional === 1 || tile.optional === true;
}

/**
 * What one completion is worth. A frozen `awardedPoints` always wins: it's what the rules decided at
 * the moment the tile was finished (first-team bonus, decay ramp), and re-deriving it later from the
 * tile's live weight would quietly re-price history. Null means no modifier applied, so the tile's
 * own weight stands.
 */
function earned(
  completion: ScoringCompletion,
  weightById: Map<number, number>,
  pointsMode: boolean,
): number {
  const weight = weightById.get(completion.tileId);
  if (weight === undefined) return 0;
  return pointsMode && completion.awardedPoints != null ? completion.awardedPoints : weight;
}

/**
 * Score every team on a board.
 *
 * `boardPointsTotal` is the whole-pool total for a reveal-policy board, for callers that know it: a
 * drip-feed board's denominator is the WHOLE pool, not the slice that happens to be open, or the
 * percentage would leap around as tiles are drawn. Callers without it pass nothing and get the total
 * of the tiles they handed over.
 *
 * `rules` is optional because most single-team surfaces (My Team, the captain board, the player
 * dashboard, the team boards) are handed tiles their page has ALREADY filtered to what the viewer
 * may see. Omitting it means "score exactly what I gave you", which is what those callers want; the
 * whole-board readers pass the real rules so a drip-feed board narrows to what's been drawn.
 */
export function scoreTeams(args: {
  scoringMode: string | null | undefined;
  rules?: EventRules;
  tiles: ScoringTile[];
  completions: ScoringCompletion[];
  teams: { id: number }[];
  boardPointsTotal?: number | null;
}): TeamScore[] {
  const { scoringMode, rules = DEFAULT_EVENT_RULES, tiles, completions, teams, boardPointsTotal = null } = args;
  const pointsMode = scoringMode === 'points';

  // The board is everything that ISN'T a mission. On a reveal-policy board it further narrows to
  // what's actually been drawn, matching what a member can see.
  const board = boardTiles(tiles);
  const scoredBoard = (rules.revealPolicy !== 'all' ? visibleTiles(rules, board) : board).filter(
    (t) => !isOptional(t),
  );
  // Missions score whenever they're completed. An unannounced one can't be (the completion gate
  // refuses it), so there's nothing to filter here beyond the mission flag itself.
  const missions = tiles.filter(isMissionTile);

  const boardWeight = new Map(scoredBoard.map((t) => [t.id, tileWeight(scoringMode, t.points)]));
  const missionWeight = new Map(missions.map((t) => [t.id, tileWeight(scoringMode, t.points)]));

  const visibleTotal = scoredBoard.reduce((sum, t) => sum + tileWeight(scoringMode, t.points), 0);
  const total = pointsMode && boardPointsTotal != null ? Math.max(visibleTotal, boardPointsTotal) : visibleTotal;

  const boardByTeam = new Map<number, number>();
  const bonusByTeam = new Map<number, number>();
  for (const c of completions) {
    if (boardWeight.has(c.tileId)) {
      boardByTeam.set(c.teamId, (boardByTeam.get(c.teamId) ?? 0) + earned(c, boardWeight, pointsMode));
    } else if (missionWeight.has(c.tileId)) {
      bonusByTeam.set(c.teamId, (bonusByTeam.get(c.teamId) ?? 0) + earned(c, missionWeight, pointsMode));
    }
  }

  return teams.map((team) => {
    const boardScore = boardByTeam.get(team.id) ?? 0;
    const bonusScore = bonusByTeam.get(team.id) ?? 0;
    return {
      teamId: team.id,
      boardScore,
      bonusScore,
      score: boardScore + bonusScore,
      total,
      unit: pointsMode ? 'pts' : 'tiles',
      // Board progress, from board points only. A first-finish bonus can push boardScore past the
      // total on its own, hence the clamp — it predates missions and is unrelated to them.
      pct: total > 0 ? Math.min(100, Math.round((boardScore / total) * 100)) : 0,
    };
  });
}

/**
 * One team's score, for the surfaces that only ever show their own ("My Team", the captain board,
 * the player dashboard). Same maths, no array ceremony.
 */
export function scoreTeam(args: {
  scoringMode: string | null | undefined;
  rules?: EventRules;
  tiles: ScoringTile[];
  completions: ScoringCompletion[];
  teamId: number;
  boardPointsTotal?: number | null;
}): TeamScore {
  const [score] = scoreTeams({ ...args, teams: [{ id: args.teamId }] });
  return score;
}

/** "185 pts" / "185 pts +50 bonus" — the house phrasing, so every surface says it the same way. */
export function formatScore(score: Pick<TeamScore, 'score' | 'bonusScore' | 'unit'>): string {
  const base = `${score.score} ${score.unit}`;
  return score.bonusScore > 0 ? `${base} (+${score.bonusScore} bonus)` : base;
}
