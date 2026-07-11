import { tileWeight } from './utils';

// Per-member contribution rollup for a single team.
export interface MemberContribution {
  playerId: number;
  name: string;
  // Split-by-contribution share of the team's earned tile weight (points mode). A completed tile's
  // weight is divided among the members who submitted toward it, proportional to the amount each
  // contributed. Rounded for display, so the members' points may not sum to the exact team total.
  points: number;
  // Distinct completed, non-optional tiles the member contributed at least one submission to.
  tasks: number;
  // Count of the member's credited submissions for this team.
  submissions: number;
}

interface BreakdownPlayer {
  id: number;
  name: string;
  teamId: number | null;
}
interface BreakdownTile {
  id: number;
  points?: number | null;
  optional?: number | null;
}
interface BreakdownCompletion {
  teamId: number;
  tileId: number;
}
interface BreakdownSubmission {
  teamId: number;
  tileId: number;
  creditPlayerId: number | null;
  amount: number;
}

/**
 * Break a team's contribution down per member. Completions are team-level (there's no
 * "member X completed this tile" record), so credit is derived from submissions: each completed,
 * non-optional tile's point weight is split among the members who submitted toward it, proportional
 * to how much each contributed (a 500-kill tile worth 25 pts → 300/200 kills = 15/10 pts). Tiles
 * that complete with no per-member submissions (e.g. stat-based boss/XP tiles) can't be attributed,
 * so their points simply aren't credited to anyone here.
 *
 * Every roster member is returned (including zero-contribution ones), sorted by points, then tasks,
 * then submissions.
 */
export function computeMemberBreakdown(params: {
  teamId: number;
  scoringMode: string | null | undefined;
  players: BreakdownPlayer[];
  tiles: BreakdownTile[];
  completions: BreakdownCompletion[];
  submissions: BreakdownSubmission[];
}): MemberContribution[] {
  const { teamId, scoringMode, players, tiles, completions, submissions } = params;
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const completedTileIds = new Set(
    completions.filter((c) => c.teamId === teamId).map((c) => c.tileId),
  );
  const teamSubs = submissions.filter((s) => s.teamId === teamId && s.creditPlayerId != null);

  const pointsByPlayer = new Map<number, number>();
  const tasksByPlayer = new Map<number, Set<number>>();
  const subCountByPlayer = new Map<number, number>();

  for (const s of teamSubs) {
    const pid = s.creditPlayerId as number;
    subCountByPlayer.set(pid, (subCountByPlayer.get(pid) ?? 0) + 1);
  }

  for (const tileId of completedTileIds) {
    const tile = tileById.get(tileId);
    if (!tile || tile.optional) continue; // optional tiles don't score

    const subs = teamSubs.filter((s) => s.tileId === tileId);
    if (subs.length === 0) continue; // e.g. a stat tile — no per-member credit to split

    const amountByPlayer = new Map<number, number>();
    for (const s of subs) {
      const pid = s.creditPlayerId as number;
      amountByPlayer.set(pid, (amountByPlayer.get(pid) ?? 0) + Math.max(0, s.amount));
      if (!tasksByPlayer.has(pid)) tasksByPlayer.set(pid, new Set());
      tasksByPlayer.get(pid)!.add(tileId);
    }

    const weight = tileWeight(scoringMode, tile.points);
    const total = Array.from(amountByPlayer.values()).reduce((a, b) => a + b, 0);
    if (weight <= 0 || total <= 0) continue;
    for (const [pid, amt] of amountByPlayer) {
      pointsByPlayer.set(pid, (pointsByPlayer.get(pid) ?? 0) + weight * (amt / total));
    }
  }

  return players
    .filter((p) => p.teamId === teamId)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      points: Math.round(pointsByPlayer.get(p.id) ?? 0),
      tasks: tasksByPlayer.get(p.id)?.size ?? 0,
      submissions: subCountByPlayer.get(p.id) ?? 0,
    }))
    .sort(
      (a, b) => b.points - a.points || b.tasks - a.tasks || b.submissions - a.submissions,
    );
}
