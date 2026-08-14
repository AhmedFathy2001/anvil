import {
  computeIndividualStandings,
  type IndividualStanding,
  type StatGainMap,
} from '@/lib/memberBreakdown';
import { boardTiles } from '@/lib/eventRules';
import { isPointsMode, tileWeight } from '@/lib/utils';
import type { StatContributionSnapshot } from '@/lib/statTracking';
import {
  bestClaim,
  bestStreak,
  bestWeek,
  buildFeed,
  claimStreak,
  monthLabel,
  monthWindow,
  monthWindowFor,
  pastSeasonKeys,
  projectSeason,
  rankMovement,
  seasonNumber,
  seasonProgress,
  trailingWindow,
  weekBuckets,
  type Claim,
  type FeedItem,
} from '@/lib/ladderInsights';

/**
 * Everything the ladder page renders, assembled once on the server.
 *
 * A ladder asks different questions from a team board — which season is this, when does it reset,
 * where am I, who is on a run, what just happened — and all of them are derived from rows the page
 * has already loaded. Keeping the derivation here means the client component is a renderer, and the
 * numbers on screen are computed by the same functions that award the points (decayedPoints) and
 * rank the board (computeIndividualStandings), never by a second implementation that can drift.
 */

export type LadderLifecycle =
  /** No end date: a rolling board that wipes on the 1st. Seasons, a hall, a reset clock. */
  | 'season'
  /** No end date and no reset: one board forever. Records instead of seasons. */
  | 'endless'
  /** Has an end date: a one-shot run. No seasons, no hall, no reset. */
  | 'bounded';

export interface LadderScope {
  key: 'season' | 'alltime' | 'week';
  label: string;
  rows: IndividualStanding[];
  /** Rank change vs the same board a week ago; null = wasn't on it. Keyed by row playerId. */
  movement: Record<number, number | null>;
  note: string;
}

export interface LadderMe {
  playerId: number;
  name: string;
  rank: number;
  points: number;
  tasks: number;
  movement: number | null;
  /** Points needed to overtake the player directly above, and who that is. Null when 1st. */
  gap: { points: number; name: string } | null;
  streak: number;
  bestClaim: { label: string; points: number } | null;
  weeks: { points: number; tasks: number }[];
  projection: number | null;
}

export interface LadderChampion {
  name: string;
  points: number;
  tasks: number;
  /** Consecutive days they've held first place (capped at the 30-day lookback). */
  heldDays: number;
  streak: number;
}

export interface LadderHallCard {
  key: string;
  label: string;
  value: string;
  sub: string;
}

export interface LadderView {
  lifecycle: LadderLifecycle;
  /** Season identity — null on a bounded or endless ladder. */
  season: { number: number; label: string; resetAt: string; day: number; days: number } | null;
  scopes: LadderScope[];
  defaultScope: LadderScope['key'];
  champion: LadderChampion | null;
  /** The one chasing the crown — second place, and how far back. */
  chaser: { name: string; behind: number; tasks: number } | null;
  me: LadderMe | null;
  hall: { title: string; note: string; cards: LadderHallCard[] } | null;
  feed: FeedItem[];
  /** Open task ids the viewer has already claimed — the board marks them. */
  myClaimedTileIds: number[];
  /** How many players have claimed each tile, for the live board. */
  claimsByTile: Record<number, number>;
  /** Current claim streak in days, per row playerId — the flame on a row. */
  streaks: Record<number, number>;
  /** Points per day over the last 7 days for the top three, for their sparklines. */
  sparks: Record<number, number[]>;
  totalPlayers: number;
}

interface ViewCompletion {
  id: number;
  teamId: number;
  tileId: number;
  completedAt: string;
  creditPlayerId?: number | null;
  statContributions: StatContributionSnapshot | null;
  awardedPoints: number | null;
}

interface ViewTile {
  id: number;
  label: string;
  points?: number | null;
  optional?: number | null;
  mission?: boolean | number | null;
  revealedAt?: string | null;
  closedAt?: string | null;
}

interface ViewPlayer {
  id: number;
  name: string;
  teamId: number | null;
  frozenAt?: string | null;
}

export interface LadderViewInput {
  event: {
    id: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    scoringMode: string | null;
    accountSlotMode: string | null;
    rules: string | null;
  };
  tiles: ViewTile[];
  teams: { id: number; name: string; color: string }[];
  players: ViewPlayer[];
  completions: ViewCompletion[];
  submissions: { tileId: number; teamId: number; creditPlayerId: number | null; amount: number }[];
  statGains: StatGainMap;
  ownerByPlayerId: Map<number, number | null>;
  /** Player rows in this event belonging to the signed-in viewer (any of their accounts). */
  myPlayerIds: number[];
  now?: Date;
}

/** Which lifecycle a ladder is running — the single fact the whole page's framing hangs off. */
export function ladderLifecycle(event: { endDate: string | null; rules: string | null }): LadderLifecycle {
  if (event.endDate) return 'bounded';
  // An endless ladder is opt-in via rules; the default rolling board resets monthly.
  const raw = event.rules ? (JSON.parse(safeJson(event.rules)) as { ladderReset?: unknown }) : null;
  return raw?.ladderReset === 'never' ? 'endless' : 'season';
}

const safeJson = (s: string) => {
  try {
    JSON.parse(s);
    return s;
  } catch {
    return '{}';
  }
};

/**
 * Map every player id onto the standings row that represents them. On a 'per-person' event a
 * person's alts collapse into one row keyed by their top-scoring account, so an alt's claim has to
 * land on the lead's row or the streak and the board would disagree about who did what.
 */
function leadIdMap(
  rows: IndividualStanding[],
  ownerByPlayerId: Map<number, number | null>,
  perPerson: boolean,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.playerId, r.playerId);
  if (!perPerson) return map;
  const leadByOwner = new Map<number, number>();
  for (const r of rows) {
    const owner = ownerByPlayerId.get(r.playerId);
    if (owner != null && !leadByOwner.has(owner)) leadByOwner.set(owner, r.playerId);
  }
  for (const [playerId, owner] of ownerByPlayerId) {
    if (owner == null) continue;
    const lead = leadByOwner.get(owner);
    if (lead != null) map.set(playerId, lead);
  }
  return map;
}

/**
 * Turn completions into per-person claims. Credit comes from the completion itself where the engine
 * recorded it (stat tiles and solo counts stamp `creditPlayerId`, stat tiles also freeze a split);
 * otherwise a single-member team IS the person, which is the default ladder enrollment. Anything
 * left is a genuine team effort and stays unattributed rather than being guessed at.
 */
export function buildClaims(input: {
  completions: ViewCompletion[];
  tiles: ViewTile[];
  players: ViewPlayer[];
  scoringMode: string | null;
  leadOf: Map<number, number>;
}): Claim[] {
  const { completions, tiles, players, scoringMode, leadOf } = input;
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const soloPlayerByTeam = new Map<number, number | null>();
  for (const p of players) {
    if (p.teamId == null) continue;
    soloPlayerByTeam.set(p.teamId, soloPlayerByTeam.has(p.teamId) ? null : p.id);
  }

  const claims: Claim[] = [];
  for (const c of completions) {
    const tile = tileById.get(c.tileId);
    if (!tile) continue;
    let playerId: number | null = c.creditPlayerId ?? null;
    if (playerId == null && c.statContributions?.split?.length) {
      playerId = [...c.statContributions.split].sort((a, b) => b.gained - a.gained)[0].playerId;
    }
    if (playerId == null) playerId = soloPlayerByTeam.get(c.teamId) ?? null;
    const points =
      isPointsMode(scoringMode) && c.awardedPoints != null
        ? c.awardedPoints
        : tileWeight(scoringMode, tile.points);
    claims.push({
      playerId: playerId == null ? null : leadOf.get(playerId) ?? playerId,
      teamId: c.teamId,
      tileId: c.tileId,
      at: c.completedAt,
      points,
      label: tile.label,
    });
  }
  return claims;
}

const movementMap = (rows: IndividualStanding[], before: IndividualStanding[]) =>
  Object.fromEntries(rankMovement(rows, before)) as Record<number, number | null>;

export function buildLadderView(input: LadderViewInput): LadderView {
  const { event, tiles, teams, players, completions, submissions, statGains, ownerByPlayerId, myPlayerIds } = input;
  const now = input.now ?? new Date();
  const perPerson = event.accountSlotMode === 'per-person';
  const lifecycle = ladderLifecycle(event);

  const base = {
    scoringMode: event.scoringMode,
    teams,
    players,
    tiles,
    submissions,
    statGains,
    ownerByPlayerId,
    accountSlotMode: event.accountSlotMode,
  };
  const standingsFor = (start?: string, end?: string) =>
    computeIndividualStandings({
      ...base,
      completions: completions.filter(
        (c) => (start === undefined || c.completedAt >= start) && (end === undefined || c.completedAt < end),
      ),
    });

  const allTime = standingsFor();
  const leadOf = leadIdMap(allTime, ownerByPlayerId, perPerson);
  const claims = buildClaims({ completions, tiles, players, scoringMode: event.scoringMode, leadOf });

  const month = monthWindow(now);
  const week = trailingWindow(7, now);
  const weekAgo = week.start;

  // Every board is the same computation over a different slice of time, and its movement is that
  // same board as it stood a week ago — so "▲3" means exactly "three places better than last week".
  const seasonRows = lifecycle === 'bounded' ? allTime : standingsFor(month.start, month.end);
  const seasonBefore =
    lifecycle === 'bounded' ? standingsFor(undefined, weekAgo) : standingsFor(month.start, weekAgo);
  const allTimeBefore = standingsFor(undefined, weekAgo);
  const weekRows = standingsFor(week.start);
  const weekBefore = standingsFor(trailingWindow(14, now).start, weekAgo);

  const seasonLabel =
    lifecycle === 'bounded' ? 'Whole run' : lifecycle === 'endless' ? 'This month' : 'This season';
  const resetAt = month.end;
  const prog = seasonProgress(now);
  const season =
    lifecycle === 'season'
      ? {
          number: seasonNumber(event.startDate, now),
          label: monthLabel(month.start.slice(0, 7)),
          resetAt,
          day: prog.day,
          days: prog.days,
        }
      : null;

  const scopes: LadderScope[] = [
    {
      key: 'season',
      label: seasonLabel,
      rows: seasonRows,
      movement: movementMap(seasonRows, seasonBefore),
      note:
        lifecycle === 'bounded'
          ? 'the whole run — final standings lock at the end'
          : lifecycle === 'endless'
            ? `${monthLabel(month.start.slice(0, 7))} · the board never wipes`
            : `Season ${season!.number} · resets ${new Date(resetAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    },
  ];
  if (lifecycle !== 'bounded') {
    scopes.push({
      key: 'alltime',
      label: 'All-time',
      rows: allTime,
      movement: movementMap(allTime, allTimeBefore),
      note: 'every season since the ladder opened',
    });
  }
  scopes.push({
    key: 'week',
    label: 'Last 7 days',
    rows: weekRows,
    movement: movementMap(weekRows, weekBefore),
    note: 'rolling — who is actually moving right now',
  });
  // An open-ended ladder opens on the live race; a one-shot run opens on the run itself.
  const defaultScope: LadderScope['key'] = lifecycle === 'endless' ? 'alltime' : 'season';

  // Champion: how long they've actually held first, by re-ranking the board as it stood on each of
  // the last 30 days. Cheap (the rows are already in memory) and exact — no snapshot table.
  let champion: LadderChampion | null = null;
  const leader = seasonRows[0];
  if (leader) {
    let heldDays = 0;
    for (let d = 1; d <= 30; d++) {
      const asOf = new Date(now.getTime() - d * 86_400_000).toISOString();
      const rows = lifecycle === 'bounded' ? standingsFor(undefined, asOf) : standingsFor(month.start, asOf);
      if (rows[0]?.playerId === leader.playerId) heldDays = d;
      else break;
    }
    champion = {
      name: leader.name,
      points: leader.points,
      tasks: leader.tasks,
      heldDays,
      streak: claimStreak(claims, leader.playerId, now).current,
    };
  }
  const runnerUp = seasonRows[1];
  const chaser = runnerUp
    ? { name: runnerUp.name, behind: Math.round(seasonRows[0].points - runnerUp.points), tasks: runnerUp.tasks }
    : null;

  // "You" — the viewer's own row on the season board, plus the personal reads that hang off it.
  let me: LadderMe | null = null;
  const myRowIds = new Set(myPlayerIds.map((id) => leadOf.get(id) ?? id));
  const myIndex = seasonRows.findIndex((r) => myRowIds.has(r.playerId));
  if (myIndex >= 0) {
    const row = seasonRows[myIndex];
    const above = myIndex > 0 ? seasonRows[myIndex - 1] : null;
    const best = bestClaim(claims, row.playerId);
    me = {
      playerId: row.playerId,
      name: row.name,
      rank: myIndex + 1,
      points: row.points,
      tasks: row.tasks,
      movement: scopes[0].movement[row.playerId] ?? null,
      gap: above ? { points: Math.round(above.points - row.points), name: above.name } : null,
      streak: claimStreak(claims, row.playerId, now).current,
      bestClaim: best ? { label: best.label ?? 'a task', points: best.points } : null,
      weeks: weekBuckets(claims, row.playerId, 3, now).map((w) => ({ points: w.points, tasks: w.tasks })),
      projection:
        lifecycle === 'bounded'
          ? null
          : projectSeason(row.points, month.start, month.end, now),
    };
  }

  // History. A bounded ladder has none — it is one run, and when it ends it is a finished event.
  let hall: LadderView['hall'] = null;
  if (lifecycle === 'season') {
    const cards: LadderHallCard[] = [];
    for (const key of pastSeasonKeys(claims, now, 2)) {
      const w = monthWindowFor(key);
      const rows = standingsFor(w.start, w.end);
      if (!rows.length) continue;
      const margin = rows.length > 1 ? Math.round(rows[0].points - rows[1].points) : rows[0].points;
      cards.push({
        key,
        label: monthLabel(key),
        value: rows[0].name,
        sub: `${Math.round(rows[0].points).toLocaleString()} pts · won by ${margin.toLocaleString()}`,
      });
    }
    pushRecords(cards, claims, standingsFor, now);
    hall = cards.length
      ? { title: 'Hall of the ladder', note: 'what the resets left behind', cards }
      : null;
  } else if (lifecycle === 'endless') {
    const cards: LadderHallCard[] = [];
    pushRecords(cards, claims, standingsFor, now);
    hall = cards.length
      ? { title: 'Records', note: 'nothing resets, so these are the marks to beat', cards }
      : null;
  }

  const nameByPlayer = new Map(allTime.map((r) => [r.playerId, r.name]));
  const board = boardTiles(tiles);
  const feed = buildFeed(
    claims,
    board
      .filter((t) => t.revealedAt || t.closedAt)
      .map((t) => ({ label: t.label, revealedAt: t.revealedAt, closedAt: t.closedAt })),
    (id) => nameByPlayer.get(id),
    8,
  );

  // Streaks for everyone on the season board (the flame), and a 7-day shape for the podium three.
  const streaks: Record<number, number> = {};
  for (const row of seasonRows.slice(0, 60)) {
    const s = claimStreak(claims, row.playerId, now).current;
    if (s > 1) streaks[row.playerId] = s;
  }
  const sparks: Record<number, number[]> = {};
  for (const row of seasonRows.slice(0, 3)) {
    sparks[row.playerId] = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
      return claims
        .filter((c) => c.playerId === row.playerId && c.at.slice(0, 10) === day)
        .reduce((sum, c) => sum + c.points, 0);
    });
  }

  const claimsByTile: Record<number, number> = {};
  for (const c of completions) claimsByTile[c.tileId] = (claimsByTile[c.tileId] ?? 0) + 1;
  const myTeamIds = new Set(
    players.filter((p) => myPlayerIds.includes(p.id) && p.teamId != null).map((p) => p.teamId as number),
  );
  const myClaimedTileIds = [
    ...new Set(completions.filter((c) => myTeamIds.has(c.teamId)).map((c) => c.tileId)),
  ];

  return {
    lifecycle,
    season,
    scopes,
    defaultScope,
    champion,
    chaser,
    me,
    hall,
    feed,
    myClaimedTileIds,
    claimsByTile,
    streaks,
    sparks,
    totalPlayers: allTime.length,
  };
}

/** The marks that survive a reset: best season, longest streak, best week. */
function pushRecords(
  cards: LadderHallCard[],
  claims: Claim[],
  standingsFor: (start?: string, end?: string) => IndividualStanding[],
  now: Date,
): void {
  const nameOf = (playerId: number) =>
    standingsFor().find((r) => r.playerId === playerId)?.name ?? 'Unknown';

  let bestSeason: { name: string; points: number; label: string } | null = null;
  for (const key of pastSeasonKeys(claims, now, 12)) {
    const w = monthWindowFor(key);
    const top = standingsFor(w.start, w.end)[0];
    if (top && (!bestSeason || top.points > bestSeason.points)) {
      bestSeason = { name: top.name, points: Math.round(top.points), label: monthLabel(key) };
    }
  }
  if (bestSeason) {
    cards.push({
      key: 'best-season',
      label: 'Best month',
      value: `${bestSeason.points.toLocaleString()} pts`,
      sub: `${bestSeason.name} · ${bestSeason.label}`,
    });
  }

  const streak = bestStreak(claims, now);
  if (streak && streak.days > 1) {
    cards.push({
      key: 'streak',
      label: 'Longest streak',
      value: `${streak.days} days`,
      sub: nameOf(streak.playerId),
    });
  }

  const week = bestWeek(claims);
  if (week && week.tasks > 1) {
    cards.push({
      key: 'best-week',
      label: 'Most tasks in a week',
      value: String(week.tasks),
      sub: `${nameOf(week.playerId)} · ${Math.round(week.points).toLocaleString()} pts`,
    });
  }
}
