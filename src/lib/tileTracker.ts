import { countProgress, submissionCreditKey, UNATTRIBUTED_CREDIT, type CountedSubmission } from '@/lib/countProgress';
import { collectionProgress } from '@/lib/pluginPanel';
import { isIndividualMode } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// One tile's progress for EVERY team, with each team's top contributors — what the plugin's pinned
// in-game tracker widget draws. Pure, so it is tested directly (tests/tile-tracker.test.ts); the
// route (api/plugin/event/[id]/tile/[tileId]/progress) loads the rows.
//
// Count tiles fold submissions through lib/countProgress, the same definition the completion writer
// and the in-game progress use. Stat tiles take lib/statStandings' per-player gains, which already
// carry the live plugin overlay and the frozen split of a completed tile.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** How many contributors each team lists — a widget, not a roster. */
export const TRACKER_TOP_MEMBERS = 5;

export interface TrackerTeamIn {
  teamId: number;
  name: string;
  color: string | null;
}

export interface TrackerMember {
  name: string;
  amount: number;
  mine: boolean;
}

export interface TrackerTeam {
  teamId: number;
  name: string;
  color: string | null;
  /** Progress toward the goal under the tile's mode: the team sum, or the best member on a Solo tile. */
  current: number;
  complete: boolean;
  mine: boolean;
  members: TrackerMember[];
}

export interface TrackerInput {
  teams: TrackerTeamIn[];
  trackingMode: string | null;
  completedTeamIds: Set<number>;
  viewerTeamId: number | null;
  viewerPlayerId: number | null;
  names: Map<number, string>;
}

/** Count tile: submissions already filtered to the tile, carrying their team. */
export function countTileTeams(
  input: TrackerInput,
  subs: (CountedSubmission & { teamId: number })[],
  countMode?: string | null,
): TrackerTeam[] {
  return rank(input.teams.map((t) => {
    const own = subs.filter((s) => s.teamId === t.teamId);
    const byPlayer = new Map<number, number>();
    for (const s of own) {
      const key = submissionCreditKey(s);
      byPlayer.set(key, (byPlayer.get(key) ?? 0) + s.amount);
    }
    return team(input, t, countProgress(own, input.trackingMode, countMode).current, byPlayer);
  }));
}

export interface TrackerRequirement {
  itemId: number;
  requiredAmount: number;
  group?: string | null;
  groupRequire?: number | null;
}

/**
 * Collection tile (itemRequirements): the bar counts PIECES through lib/pluginPanel collectionProgress —
 * what the side panel shows — so a Voidwaker reads 1/3 and a Barrows set 2/4, never "1/1" off the
 * tile's requiredAmount. Each item's total is the team's, like the config's per-item totals.
 */
export function collectionTileTeams(
  input: TrackerInput,
  subs: (CountedSubmission & { teamId: number })[],
  reqs: TrackerRequirement[],
  groupMode: string | null | undefined,
  setsRequired: number,
): { goal: number; teams: TrackerTeam[] } {
  const progress = (totals: Map<number, number>) =>
    collectionProgress(reqs.map((r) => ({ ...r, currentAmount: totals.get(r.itemId) ?? 0 })), groupMode, setsRequired);
  const [, goal] = progress(new Map());
  const teams = rank(input.teams.map((t) => {
    const own = subs.filter((s) => s.teamId === t.teamId);
    const totals = new Map<number, number>();
    const byPlayer = new Map<number, number>();
    for (const s of own) {
      if (s.itemId != null) totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.amount);
      const key = submissionCreditKey(s);
      byPlayer.set(key, (byPlayer.get(key) ?? 0) + s.amount);
    }
    return team(input, t, progress(totals)[0], byPlayer);
  }));
  return { goal, teams };
}

/** Stat tile: per-player gains (lib/statStandings) with their team. */
export function statTileTeams(
  input: TrackerInput,
  players: { playerId: number; teamId: number | null; gained: number }[],
): TrackerTeam[] {
  const solo = isIndividualMode(input.trackingMode);
  return rank(input.teams.map((t) => {
    const byPlayer = new Map<number, number>();
    for (const p of players) if (p.teamId === t.teamId && p.gained > 0) byPlayer.set(p.playerId, p.gained);
    const amounts = [...byPlayer.values()];
    const current = solo ? Math.max(0, ...amounts) : amounts.reduce((a, b) => a + b, 0);
    return team(input, t, current, byPlayer);
  }));
}

function team(input: TrackerInput, t: TrackerTeamIn, current: number, byPlayer: Map<number, number>): TrackerTeam {
  const members = [...byPlayer.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({
      name: id === UNATTRIBUTED_CREDIT ? 'Staff upload' : (input.names.get(id) ?? 'Unknown'),
      amount,
      mine: id !== UNATTRIBUTED_CREDIT && id === input.viewerPlayerId,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  // The viewer always sees their own line, even when they are outside the top few.
  const top = members.slice(0, TRACKER_TOP_MEMBERS);
  const me = members.find((m) => m.mine);
  if (me && !top.includes(me)) top.push(me);
  return {
    teamId: t.teamId,
    name: t.name,
    color: t.color,
    current,
    complete: input.completedTeamIds.has(t.teamId),
    mine: t.teamId === input.viewerTeamId,
    members: top,
  };
}

// The viewer's team first, then the rest by progress.
function rank(teams: TrackerTeam[]): TrackerTeam[] {
  return teams.sort((a, b) => Number(b.mine) - Number(a.mine) || b.current - a.current || a.name.localeCompare(b.name));
}
