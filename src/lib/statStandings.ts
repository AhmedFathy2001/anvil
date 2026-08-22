import { db } from '@/db';
import { tiles, players, teams, completions, events } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { parseEventRules } from '@/lib/eventRules';
import { scoreTeams } from '@/lib/boardScoring';
import { statKeys, statLabel } from '@/lib/tileKinds';
import { jsonStatValue, effectiveValue, parseContributionSnapshot } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';

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

// Sum a (possibly composite) stat's value out of a stored hiscores JSON blob via the shared
// per-key reader (skills carry `xp`, bosses `score` with -1 unranked floored to 0).
const readStat = (json: string | null | undefined, statType: string, keys: string[]): number =>
  keys.reduce((sum, k) => sum + jsonStatValue(json, statType, k), 0);

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
  // Member-scoped real-time overlay (shared with weekly), folded into current as a per-key max.
  const memberLive = await liveStatsForMembers(drafted.map((p) => p.clanMemberId));

  // Completed stat tiles carry a frozen per-member split. Once a (team, tile) is done we display each
  // member's contribution from that snapshot rather than the live gain, so a finished tile stops
  // climbing past its goal. Key: `${teamId}-${tileId}` → playerId → frozen gained.
  const statTileIds = statTiles.map((t) => t.id);
  const frozenByTeamTile = new Map<string, Map<number, number>>();
  if (statTileIds.length > 0) {
    const comps = await db
      .select({
        teamId: completions.teamId,
        tileId: completions.tileId,
        statContributions: completions.statContributions,
      })
      .from(completions)
      .where(inArray(completions.tileId, statTileIds));
    for (const c of comps) {
      const snap = parseContributionSnapshot(c.statContributions);
      if (!snap) continue; // legacy completion w/o a frozen split → keep showing live
      frozenByTeamTile.set(
        `${c.teamId}-${c.tileId}`,
        new Map(snap.split.map((r) => [r.playerId, r.gained])),
      );
    }
  }

  return statTiles.map((tile) => {
    const keys = statKeys(tile.trackedStat);
    const rows: StatStandingPlayer[] = drafted
      .map((p) => {
        const baseline = readStat(p.statsSnapshot, tile.statType!, keys);
        // If this player's team already completed the tile, freeze the display at the snapshotted gain.
        const frozen = p.teamId != null ? frozenByTeamTile.get(`${p.teamId}-${tile.id}`) : undefined;
        if (frozen) {
          const gained = frozen.get(p.id) ?? 0;
          return {
            playerId: p.id,
            name: p.name,
            teamId: p.teamId,
            baseline,
            current: baseline + gained,
            gained,
            hasBaseline: !!p.statsSnapshot,
          };
        }
        // Benched (sub-out) player: pin to their frozen snapshot, ignoring the live overlay so their
        // gain stays put at the sub moment even if the plugin/hiscores would otherwise move it.
        if (p.frozenAt) {
          const current = readStat(p.frozenStats, tile.statType!, keys);
          return {
            playerId: p.id,
            name: p.name,
            teamId: p.teamId,
            baseline,
            current,
            gained: Math.max(0, current - baseline),
            hasBaseline: !!p.statsSnapshot,
          };
        }
        // Effective current folds in the plugin's real-time push (max per key), so standings reflect a
        // fresh kill / training burst before the hiscores sweep catches up — for boss KC AND skill XP.
        const plug = (p.clanMemberId != null && memberLive.get(p.clanMemberId)) || {};
        const current = keys.reduce(
          (sum, k) => sum + effectiveValue(jsonStatValue(p.cachedStats, tile.statType!, k), plug, k),
          0,
        );
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
  /** Everything the team has earned — board points plus mission bonus. Ranks on this. */
  score: number;
  /** The board half of `score`, which is what `pct` and `total` are about. */
  boardScore: number;
  /** The mission half — bonus, on top of a total it never moves. */
  bonusScore: number;
  total: number;
  unit: string; // 'pts' | 'tiles'
  pct: number;
}

// Every team's current score vs the board total — the at-a-glance "who's ahead" leaderboard.
// Points-scoring events sum tile point weights; classic/race events count completed tiles.
// Optional tiles don't count toward the total (mirrors the scoring elsewhere).
// Rule-modified completions (first-team bonus, reveal decay) score their FROZEN awardedPoints;
// reveal-policy events count only revealed tiles in the total so mid-event percentages track
// what's actually in play. First bonuses can push a score past the total — pct clamps at 100.
export async function getTeamStandings(eventId: number, scoringMode: string): Promise<TeamStanding[]> {
  const [eventRow, eventTeams, allEventTiles] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, eventId), columns: { rules: true } }),
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
  ]);
  const rules = parseEventRules(eventRow?.rules);
  const tileIds = allEventTiles.map((t) => t.id);
  const eventCompletions = tileIds.length
    ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
    : [];

  const scores = new Map(
    scoreTeams({
      scoringMode,
      rules,
      tiles: allEventTiles,
      completions: eventCompletions,
      teams: eventTeams,
    }).map((s) => [s.teamId, s]),
  );

  return eventTeams
    .map((team) => ({ ...scores.get(team.id)!, name: team.name, color: team.color }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
