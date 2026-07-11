import { tileWeight } from './utils';

// One tile a member contributed to, with their summed amount on it (kills / drops / items / gp).
export interface MemberTileContribution {
  tileId: number;
  label: string;
  tileType: string | null;
  amount: number; // summed submitted amount (kill count / drop count / gp / …)
  count: number; // number of the member's submissions on this tile
  completed: boolean; // did the team complete this tile
}

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
  // Total credited submissions (kept for sort tiebreaks; the raw count is noisy for kill-count
  // tiles — one submission per kill — so it's not surfaced as a headline number).
  submissions: number;
  // Per-tile detail, so a member row can drill down into exactly what they did.
  contributions: MemberTileContribution[];
}

interface BreakdownPlayer {
  id: number;
  name: string;
  teamId: number | null;
}
interface BreakdownTile {
  id: number;
  label?: string | null;
  tileType?: string | null;
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
 * Each member also carries a per-tile `contributions` list (their summed amount on every tile they
 * touched) for a drill-down. Every roster member is returned, sorted by points, then tasks.
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

  // playerId -> tileId -> { amount, count }
  const perPlayerTile = new Map<number, Map<number, { amount: number; count: number }>>();
  for (const s of teamSubs) {
    const pid = s.creditPlayerId as number;
    let byTile = perPlayerTile.get(pid);
    if (!byTile) {
      byTile = new Map();
      perPlayerTile.set(pid, byTile);
    }
    const entry = byTile.get(s.tileId) ?? { amount: 0, count: 0 };
    entry.amount += Math.max(0, s.amount);
    entry.count += 1;
    byTile.set(s.tileId, entry);
  }

  // Points: split each completed non-optional tile's weight among its contributors by amount.
  const pointsByPlayer = new Map<number, number>();
  for (const tileId of completedTileIds) {
    const tile = tileById.get(tileId);
    if (!tile || tile.optional) continue; // optional tiles don't score
    const weight = tileWeight(scoringMode, tile.points);
    if (weight <= 0) continue;
    let total = 0;
    const contribs: [number, number][] = [];
    for (const [pid, byTile] of perPlayerTile) {
      const e = byTile.get(tileId);
      if (e && e.amount > 0) {
        total += e.amount;
        contribs.push([pid, e.amount]);
      }
    }
    if (total <= 0) continue; // e.g. a stat tile — no per-member credit to split
    for (const [pid, amt] of contribs) {
      pointsByPlayer.set(pid, (pointsByPlayer.get(pid) ?? 0) + weight * (amt / total));
    }
  }

  return players
    .filter((p) => p.teamId === teamId)
    .map((p) => {
      const byTile = perPlayerTile.get(p.id);
      const contributions: MemberTileContribution[] = [];
      let subCount = 0;
      let tasks = 0;
      if (byTile) {
        for (const [tileId, e] of byTile) {
          const tile = tileById.get(tileId);
          const completed = completedTileIds.has(tileId);
          subCount += e.count;
          if (completed && tile && !tile.optional) tasks += 1;
          contributions.push({
            tileId,
            label: tile?.label ?? `Tile #${tileId}`,
            tileType: tile?.tileType ?? null,
            amount: e.amount,
            count: e.count,
            completed,
          });
        }
      }
      // Completed tiles first, then by how much they did.
      contributions.sort(
        (a, b) => Number(b.completed) - Number(a.completed) || b.amount - a.amount,
      );
      return {
        playerId: p.id,
        name: p.name,
        points: Math.round(pointsByPlayer.get(p.id) ?? 0),
        tasks,
        submissions: subCount,
        contributions,
      };
    })
    .sort(
      (a, b) => b.points - a.points || b.tasks - a.tasks || b.submissions - a.submissions,
    );
}
