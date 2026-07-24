import { tileWeight } from './utils';
import type { StatContributionSnapshot } from './statTracking';

// One tile a member contributed to, with their amount on it (kills / drops / items / gp, or — for
// skill/boss tiles — their XP or KC gain).
export interface MemberTileContribution {
  tileId: number;
  label: string;
  tileType: string | null;
  // 'skill' | 'boss' for hiscores-tracked tiles (amount is an XP / KC gain); null for submission tiles.
  statType: string | null;
  amount: number; // summed amount: kill/drop count, gp, or XP/KC gained
  count: number; // number of the member's submissions on this tile (0 for stat-tracked tiles)
  completed: boolean; // did the team complete this tile
}

// Per-member contribution rollup for a single team.
export interface MemberContribution {
  playerId: number;
  name: string;
  // Split-by-contribution share of the team's earned tile weight (points mode). A completed tile's
  // weight is divided among the members who contributed to it — proportional to the amount each
  // submitted, or (for skill/boss tiles) the XP/KC each gained. Rounded for display, so the members'
  // points may not sum to the exact team total.
  points: number;
  // Distinct completed, non-optional tiles the member contributed to (a submission, or a stat gain).
  tasks: number;
  // Distinct not-yet-completed tiles they've put work into — effort that hasn't scored yet.
  inProgress: number;
  // Total credited submissions (kept for sort tiebreaks; the raw count is noisy for kill-count
  // tiles — one submission per kill — so it's not surfaced as a headline number).
  submissions: number;
  // Per-tile detail, so a member row can drill down into exactly what they did.
  contributions: MemberTileContribution[];
  // Non-null = the member was subbed out (players.frozenAt). Their contribution stays in the totals
  // (frozen gains still count) but the UI marks them so it's clear they're no longer active.
  frozenAt?: string | null;
}

// Event-wide MVP: the single highest-scoring contributor across every team (not the best player on
// the top team). Carries their team so the UI can colour/label it.
export interface EventMvp {
  playerId: number;
  name: string;
  points: number;
  tasks: number;
  teamId: number;
  teamName: string;
  teamColor: string;
}

// The top contributor on a single team — the team-card MVP and the in-team MVP cards.
export interface TeamMvp {
  playerId: number;
  name: string;
  points: number;
  tasks: number;
}

// Pull the leader out of a computeMemberBreakdown() result (already sorted best-first). Returns null
// until someone has actually scored or completed a task, so an untouched team shows no MVP.
export function topMember(members: MemberContribution[]): TeamMvp | null {
  const top = members[0];
  if (!top || (top.points <= 0 && top.tasks <= 0)) return null;
  return { playerId: top.playerId, name: top.name, points: top.points, tasks: top.tasks };
}

/**
 * Multi-account 'per-person' rollup: merge each person's several account-rows into ONE contributor so
 * MVP + the breakdown list count the PERSON, not each alt. Rows sharing an owner (userId) are merged —
 * points sum, tile contributions union by tileId (tasks/inProgress re-derived from the union), and the
 * display name becomes "<lead RSN> +N". Guests (no owner) and single-account people pass through
 * untouched, so this is a no-op for 'per-account' events and every existing (maxAccounts=1) event.
 */
export function rollupByOwner(
  members: MemberContribution[],
  ownerByPlayerId: Map<number, number | null>,
): MemberContribution[] {
  const groups = new Map<string, MemberContribution[]>();
  for (const m of members) {
    const owner = ownerByPlayerId.get(m.playerId);
    const key = owner != null ? `u${owner}` : `p${m.playerId}`;
    const arr = groups.get(key);
    if (arr) arr.push(m);
    else groups.set(key, [m]);
  }
  const out: MemberContribution[] = [];
  for (const grp of groups.values()) {
    if (grp.length === 1) {
      out.push(grp[0]);
      continue;
    }
    const byTile = new Map<number, MemberTileContribution>();
    let submissions = 0;
    for (const m of grp) {
      submissions += m.submissions;
      for (const c of m.contributions) {
        const ex = byTile.get(c.tileId);
        if (ex) {
          ex.amount += c.amount;
          ex.count += c.count;
          ex.completed = ex.completed || c.completed;
        } else {
          byTile.set(c.tileId, { ...c });
        }
      }
    }
    const contributions = [...byTile.values()];
    const lead = grp.reduce((a, b) => (b.points > a.points ? b : a));
    out.push({
      playerId: lead.playerId,
      name: `${lead.name} +${grp.length - 1}`,
      points: grp.reduce((s, m) => s + m.points, 0),
      tasks: contributions.filter((c) => c.completed).length,
      inProgress: contributions.filter((c) => !c.completed).length,
      submissions,
      contributions,
      frozenAt: grp.every((m) => m.frozenAt) ? lead.frozenAt : null,
    });
  }
  return out.sort(
    (a, b) => b.points - a.points || b.tasks - a.tasks || b.inProgress - a.inProgress || b.submissions - a.submissions,
  );
}

interface BreakdownPlayer {
  id: number;
  name: string;
  teamId: number | null;
  frozenAt?: string | null;
}
interface BreakdownTile {
  id: number;
  label?: string | null;
  tileType?: string | null;
  trackedStat?: string | null; // set on skill/boss tiles — completed via hiscores, not submissions
  statType?: string | null; // 'skill' | 'boss'
  points?: number | null;
  optional?: number | null;
}
interface BreakdownCompletion {
  teamId: number;
  tileId: number;
  // Frozen per-member KC/XP split captured when a STAT tile completed. When present, it (not the live
  // `statGains`) is the source of each member's share of this tile — the whole point is that a finished
  // tile's attribution stops drifting as the underlying stat keeps climbing. NULL/absent for submission
  // tiles and for legacy stat completions predating the freeze (those fall back to live statGains).
  statContributions?: StatContributionSnapshot | null;
  // Frozen rule-modified award (first-team bonus / reveal decay). When set, it replaces the tile's
  // live point weight in the member split so MVP math matches the team's actual score.
  awardedPoints?: number | null;
}
interface BreakdownSubmission {
  teamId: number;
  tileId: number;
  creditPlayerId: number | null;
  amount: number;
}
// Per stat tile, each player's gain on the tracked stat (XP / KC). tileId → rows.
export type StatGainMap = Record<number, { playerId: number; gained: number }[]>;

/**
 * Break a team's contribution down per member. Completions are team-level (there's no
 * "member X completed this tile" record), so credit is derived from each member's actual work:
 *  • submission tiles (drop/kill/gp/…) split by the amount each member submitted;
 *  • skill/boss tiles split by the XP / KC each member gained (from `statGains`).
 * A completed, non-optional tile's point weight is divided among its contributors in proportion to
 * that work (a 500-kill tile worth 25 pts → 300/200 kills = 15/10 pts; a 1M-XP tile → by XP gained).
 *
 * Each member also carries a per-tile `contributions` list for a drill-down. Every roster member is
 * returned, sorted by points, then tasks.
 */
export function computeMemberBreakdown(params: {
  teamId: number;
  scoringMode: string | null | undefined;
  players: BreakdownPlayer[];
  tiles: BreakdownTile[];
  completions: BreakdownCompletion[];
  submissions: BreakdownSubmission[];
  statGains?: StatGainMap;
}): MemberContribution[] {
  const { teamId, scoringMode, players, tiles, completions, submissions, statGains } = params;
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const completedTileIds = new Set(
    completions.filter((c) => c.teamId === teamId).map((c) => c.tileId),
  );
  const teamPlayerIds = new Set(players.filter((p) => p.teamId === teamId).map((p) => p.id));
  const teamSubs = submissions.filter((s) => s.teamId === teamId && s.creditPlayerId != null);

  // playerId -> tileId -> { amount, count, stat }. `amount` is the split weight (submission amount,
  // or XP/KC gained); `count` is submissions (0 for stat tiles); `stat` marks a hiscores tile.
  const perPlayerTile = new Map<number, Map<number, { amount: number; count: number; stat: boolean }>>();
  const record = (pid: number, tileId: number, amount: number, count: number, stat: boolean) => {
    let byTile = perPlayerTile.get(pid);
    if (!byTile) {
      byTile = new Map();
      perPlayerTile.set(pid, byTile);
    }
    const entry = byTile.get(tileId) ?? { amount: 0, count: 0, stat };
    entry.amount += amount;
    entry.count += count;
    entry.stat = stat;
    byTile.set(tileId, entry);
  };

  for (const s of teamSubs) {
    record(s.creditPlayerId as number, s.tileId, Math.max(0, s.amount), 1, false);
  }
  // Completed stat tiles: use the split frozen at completion so each member's share can't drift as the
  // underlying KC/XP keeps climbing afterwards. Tracked here so the live pass below skips these tiles.
  const frozenStatTiles = new Set<number>();
  for (const c of completions) {
    if (c.teamId !== teamId || !c.statContributions) continue;
    const tile = tileById.get(c.tileId);
    if (!tile || !tile.trackedStat) continue;
    for (const r of c.statContributions.split) {
      if (!teamPlayerIds.has(r.playerId) || r.gained <= 0) continue;
      record(r.playerId, c.tileId, r.gained, 0, true);
    }
    frozenStatTiles.add(c.tileId);
  }
  // Skill/boss tiles without a frozen split (in-progress, or legacy completions): each team member's
  // live gain is their contribution.
  if (statGains) {
    for (const [key, rows] of Object.entries(statGains)) {
      const tileId = Number(key);
      if (frozenStatTiles.has(tileId)) continue; // already applied from the frozen split
      const tile = tileById.get(tileId);
      if (!tile || !tile.trackedStat) continue;
      for (const r of rows) {
        if (!teamPlayerIds.has(r.playerId) || r.gained <= 0) continue;
        record(r.playerId, tileId, r.gained, 0, true);
      }
    }
  }

  // Points: split each completed non-optional tile's weight among its contributors by amount.
  // A frozen awardedPoints (first-team bonus / reveal decay) replaces the live weight so the
  // member split sums to what the team actually scored.
  const awardByTile = new Map<number, number>();
  for (const c of completions) {
    if (c.teamId === teamId && c.awardedPoints != null) awardByTile.set(c.tileId, c.awardedPoints);
  }
  const pointsByPlayer = new Map<number, number>();
  for (const tileId of completedTileIds) {
    const tile = tileById.get(tileId);
    if (!tile || tile.optional) continue; // optional tiles don't score
    const weight = scoringMode === 'points' && awardByTile.has(tileId)
      ? awardByTile.get(tileId)!
      : tileWeight(scoringMode, tile.points);
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
    if (total <= 0) continue; // completed but no per-member signal (e.g. no snapshot yet)
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
          if (!e.stat) subCount += e.count;
          if (completed && tile && !tile.optional) tasks += 1;
          contributions.push({
            tileId,
            label: tile?.label ?? `Tile #${tileId}`,
            tileType: tile?.tileType ?? null,
            statType: e.stat ? (tile?.statType ?? null) : null,
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
      const inProgress = contributions.filter((c) => !c.completed).length;
      return {
        playerId: p.id,
        name: p.name,
        points: Math.round(pointsByPlayer.get(p.id) ?? 0),
        tasks,
        inProgress,
        submissions: subCount,
        contributions,
        frozenAt: p.frozenAt ?? null,
      };
    })
    // Points first, then completed tasks, then anyone with in-progress effort, then raw submissions.
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.tasks - a.tasks ||
        b.inProgress - a.inProgress ||
        b.submissions - a.submissions,
    );
}

// The event MVP — highest points (then tasks) across ALL teams' members. Returns null until someone
// has actually scored or completed a task.
export function computeEventMvp(params: {
  scoringMode: string | null | undefined;
  teams: { id: number; name: string; color: string }[];
  players: BreakdownPlayer[];
  tiles: BreakdownTile[];
  completions: BreakdownCompletion[];
  submissions: BreakdownSubmission[];
  statGains?: StatGainMap;
  // Multi-account 'per-person': roll a person's accounts into one contributor before ranking the MVP.
  ownerByPlayerId?: Map<number, number | null>;
  accountSlotMode?: string | null;
}): EventMvp | null {
  const { scoringMode, teams, players, tiles, completions, submissions, statGains, ownerByPlayerId, accountSlotMode } = params;
  const perPerson = accountSlotMode === 'per-person' && !!ownerByPlayerId;
  let best: EventMvp | null = null;
  for (const team of teams) {
    const raw = computeMemberBreakdown({
      teamId: team.id,
      scoringMode,
      players,
      tiles,
      completions,
      submissions,
      statGains,
    });
    const members = perPerson ? rollupByOwner(raw, ownerByPlayerId!) : raw;
    for (const m of members) {
      if (
        !best ||
        m.points > best.points ||
        (m.points === best.points && m.tasks > best.tasks)
      ) {
        best = {
          playerId: m.playerId,
          name: m.name,
          points: m.points,
          tasks: m.tasks,
          teamId: team.id,
          teamName: team.name,
          teamColor: team.color,
        };
      }
    }
  }
  return best && (best.points > 0 || best.tasks > 0) ? best : null;
}
