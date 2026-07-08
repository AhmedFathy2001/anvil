import { db } from '@/db';
import { tiles, players, teams, completions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { statKeys, statLabel } from '@/lib/tileKinds';
import { parsePluginStats } from '@/lib/pluginStats';

export interface StatStandingPlayer {
  playerId: number;
  name: string;
  teamId: number | null;
  baseline: number;
  current: number;
  gained: number;
  // false = this player has no captured starting snapshot yet — the tell that a baseline
  // didn't load. Surfaced in the UI so admins can spot it before the event relies on it.
  hasBaseline: boolean;
}

export interface StatTileStanding {
  tileId: number;
  label: string;
  statType: string; // 'skill' | 'boss'
  trackedStatLabel: string; // humanized tracked stat (e.g. "Chambers of Xeric + CoX: CM")
  statGoal: number;
  players: StatStandingPlayer[];
}

// Sum a (possibly composite) stat's value out of a stored hiscores JSON blob. Mirrors the reads
// in the per-player snapshot route: skills carry `xp`, bosses carry `score` (with -1 meaning
// "unranked", which we floor to 0). A composite trackedStat sums across its keys.
function readStat(json: string | null | undefined, statType: string, keys: string[]): number {
  if (!json) return 0;
  let parsed: { skills?: Record<string, { xp?: number }>; bosses?: Record<string, { score?: number }> };
  try {
    parsed = JSON.parse(json);
  } catch {
    return 0;
  }
  return keys.reduce((sum, k) => {
    if (statType === 'skill') return sum + (parsed.skills?.[k]?.xp ?? 0);
    const score = parsed.bosses?.[k]?.score ?? 0;
    return sum + (score < 0 ? 0 : score);
  }, 0);
}

// Per stat-tracked tile, every drafted player's baseline (event-start snapshot) vs their current
// stat, so admins can confirm the starting line actually loaded and watch gains accrue. Read-only;
// derived from the same statsSnapshot / cachedStats the scoring uses. Non-stat tiles are omitted.
export async function getStatStandings(eventId: number): Promise<StatTileStanding[]> {
  const [eventTiles, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
    db.select().from(players).where(eq(players.eventId, eventId)),
  ]);

  const statTiles = eventTiles
    .filter((t) => t.trackedStat && t.statType && t.statGoal)
    .sort((a, b) => a.position - b.position);

  // Only drafted players (on a team) are tracked for stat gains.
  const drafted = eventPlayers.filter((p) => p.teamId !== null);

  return statTiles.map((tile) => {
    const keys = statKeys(tile.trackedStat);
    const rows: StatStandingPlayer[] = drafted
      .map((p) => {
        const baseline = readStat(p.statsSnapshot, tile.statType!, keys);
        // Effective current folds in the plugin's real-time boss KC (max per key), so standings
        // reflect a fresh kill before the hourly hiscores cron catches up. Skills never push.
        const plug = parsePluginStats(p.pluginStats);
        const current = tile.statType === 'skill'
          ? readStat(p.cachedStats, tile.statType!, keys)
          : keys.reduce((sum, k) => sum + Math.max(readStat(p.cachedStats, 'boss', [k]), plug[k] ?? 0), 0);
        return {
          playerId: p.id,
          name: p.name,
          teamId: p.teamId,
          baseline,
          current,
          gained: Math.max(0, current - baseline),
          hasBaseline: !!p.statsSnapshot,
        };
      })
      .sort((a, b) => b.gained - a.gained || a.name.localeCompare(b.name));
    return {
      tileId: tile.id,
      label: tile.label,
      statType: tile.statType!,
      trackedStatLabel: statLabel(tile.trackedStat, tile.statType),
      statGoal: tile.statGoal!,
      players: rows,
    };
  });
}

export interface TeamStanding {
  teamId: number;
  name: string;
  color: string;
  score: number;
  total: number;
  unit: string; // 'pts' | 'tiles'
  pct: number;
}

// Every team's current score vs the board total — the at-a-glance "who's ahead" leaderboard.
// Points-scoring events sum tile point weights; classic/race events count completed tiles.
// Optional tiles don't count toward the total (mirrors the scoring elsewhere).
export async function getTeamStandings(eventId: number, scoringMode: string): Promise<TeamStanding[]> {
  const [eventTeams, eventTiles] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
  ]);
  const tileIds = eventTiles.map((t) => t.id);
  const eventCompletions = tileIds.length
    ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
    : [];

  const pointsMode = scoringMode === 'points';
  const scoredTiles = eventTiles.filter((t) => !t.optional);
  const weightById = new Map(scoredTiles.map((t) => [t.id, pointsMode ? (t.points ?? 0) : 1]));
  const total = scoredTiles.reduce((sum, t) => sum + (pointsMode ? (t.points ?? 0) : 1), 0);

  return eventTeams
    .map((team) => {
      const score = eventCompletions
        .filter((c) => c.teamId === team.id && weightById.has(c.tileId))
        .reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0);
      return {
        teamId: team.id,
        name: team.name,
        color: team.color,
        score,
        total,
        unit: pointsMode ? 'pts' : 'tiles',
        pct: total > 0 ? Math.round((score / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
