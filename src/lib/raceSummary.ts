/**
 * The words and numbers a tile race's event page and plugin panel show around the route
 * (lib/raceRoutes): the stat cards (leader, your team, busiest road, pace), the standings lines, the
 * gap watch, race-specific firsts, the race feed, the panel's summary line and its numbered step
 * list. Pure — everything is derived from the graph, the teams and their completions, so the site
 * and the plugin say the same thing.
 */
import {
  frontOpen,
  raceGraph as raceGraphOf,
  rankRaceTeams,
  roadOf,
  stepTitle,
  teamRoute,
  tileShape,
  type RaceGraph,
  type RaceStanding,
  type RaceTileState,
  type TeamRoute,
  type TeamRouteOpts,
} from '@/lib/raceRoutes';

export interface RaceTeamIn {
  id: number;
  name: string;
  color: string;
}
export interface RaceCompletionIn {
  teamId: number;
  tileId: number;
  completedAt?: string | null;
}

const HOUR = 3_600_000;
const stamp = (s: string | null | undefined): number => {
  if (!s) return NaN;
  return Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
};

/** "9h", "45m", "2d". */
export function hoursText(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

export interface RaceTeamLine {
  team: RaceTeamIn;
  rank: number;
  stepsDone: number;
  finished: boolean;
  /** Steps behind the leader (0 for the leader). */
  behind: number;
  /** The team's road letter and current tile (null at the start line). */
  road: string | null;
  currentTileId: number | null;
  /** Average time per step so far, ms (null before two finishes). */
  perStep: number | null;
  route: TeamRoute;
}

/** Every team's line, in race order (first to an end tile, then steps, then who got there first). */
export function raceLines(
  graph: RaceGraph,
  teams: RaceTeamIn[],
  completions: RaceCompletionIn[],
  picksFor?: (teamId: number) => Map<number, number> | null,
  opts: TeamRouteOpts = {},
): RaceTeamLine[] {
  const standings = rankRaceTeams(graph, teams, completions);
  const leaderSteps = standings[0]?.stepsDone ?? 0;
  const byTeam = new Map(teams.map((t) => [t.id, t]));
  return standings.map((s: RaceStanding) => {
    const mine = completions.filter((c) => c.teamId === s.teamId);
    const route = teamRoute(graph, mine.map((c) => c.tileId), picksFor?.(s.teamId) ?? null, opts);
    const cur = route.path[route.path.length - 1] ?? null;
    const times = route.path.map((id) => stamp(mine.find((c) => c.tileId === id)?.completedAt)).filter(Number.isFinite).sort((a, b) => a - b);
    const perStep = times.length >= 2 ? (times[times.length - 1] - times[0]) / (times.length - 1) : null;
    return {
      team: byTeam.get(s.teamId)!,
      rank: s.rank,
      stepsDone: s.stepsDone,
      finished: s.finished,
      behind: Math.max(0, leaderSteps - s.stepsDone),
      road: cur != null ? roadOf(graph, cur) : null,
      currentTileId: cur,
      perStep,
      route,
    };
  });
}

export interface RaceStatCards {
  leader: { name: string; color: string; line: string } | null;
  you: { line: string; sub: string } | null;
  busiest: { line: string; sub: string } | null;
  pace: { line: string; sub: string } | null;
}

/** The four cards over the race track. */
export function raceStatCards(graph: RaceGraph, lines: RaceTeamLine[], viewerTeamId: number | null): RaceStatCards {
  const steps = graph.lastStep + 1;
  const lead = lines[0];
  const leader = lead
    ? {
        name: lead.team.name,
        color: lead.team.color,
        line: lead.finished ? 'Finished' : `${lead.stepsDone} of ${steps}${lead.road ? ` · on road ${lead.road}` : ''}`,
      }
    : null;
  const me = viewerTeamId != null ? lines.find((l) => l.team.id === viewerTeamId) : undefined;
  const you = me
    ? {
        line: `${ordinal(me.rank)} · ${me.stepsDone} of ${steps}`,
        sub: me.finished ? 'Finished' : me.behind === 0 ? (lines.length > 1 ? 'In the lead' : 'On your own') : `${me.behind} behind`,
      }
    : null;
  // The link most teams travelled.
  const traffic = new Map<string, number>();
  for (const l of lines) {
    for (let i = 0; i + 1 < l.route.path.length; i++) {
      const k = `${l.route.path[i]}-${l.route.path[i + 1]}`;
      traffic.set(k, (traffic.get(k) ?? 0) + 1);
    }
  }
  let busiest: RaceStatCards['busiest'] = null;
  if (traffic.size && graph.branching) {
    const [key, n] = [...traffic].sort((a, b) => b[1] - a[1])[0];
    const to = Number(key.split('-')[1]);
    busiest = { line: `Road ${roadOf(graph, to)} at step ${graph.byId.get(to)!.step + 1}`, sub: `${n} of ${lines.length} ${lines.length === 1 ? 'team' : 'teams'} went this way` };
  }
  let pace: RaceStatCards['pace'] = null;
  if (lead?.perStep) {
    const left = steps - lead.stepsDone;
    pace = {
      line: `1 tile / ${hoursText(lead.perStep)}`,
      sub: lead.finished ? `${lead.team.name} finished` : `leader finishes in ~${hoursText(left * lead.perStep)}`,
    };
  }
  return { leader, you, busiest, pace };
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Plain sentences on who could catch whom: each team against the one just ahead of it. */
export function gapWatch(lines: RaceTeamLine[], graph: RaceGraph, max = 4): string[] {
  const out: string[] = [];
  const steps = graph.lastStep + 1;
  for (let i = 1; i < lines.length && out.length < max; i++) {
    const a = lines[i - 1];
    const b = lines[i];
    if (a.finished) {
      if (!b.finished) out.push(`${a.team.name} have finished — ${b.team.name} are ${steps - b.stepsDone} from the line.`);
      continue;
    }
    const gap = a.stepsDone - b.stepsDone;
    if (gap === 0) out.push(`${b.team.name} are level with ${a.team.name} on ${a.stepsDone} of ${steps} — the next tile decides it.`);
    else if (gap === 1) out.push(`${b.team.name} are one tile behind ${a.team.name} — one finish ties it.`);
    else out.push(`${b.team.name} are ${gap} tiles behind ${a.team.name}.`);
  }
  const lead = lines[0];
  if (lead && !lead.finished && steps - lead.stepsDone === 1 && out.length < max) out.unshift(`${lead.team.name} are one tile from the finish.`);
  return out;
}

export interface RaceFirst {
  key: 'off-the-line' | 'junction' | 'road-switch';
  title: string;
  team: RaceTeamIn;
  detail: string;
  at: string | null;
}

/** Off the line (first finish), first to a junction, first road switch. */
export function raceFirsts(graph: RaceGraph, teams: RaceTeamIn[], completions: RaceCompletionIn[], labelOf: (id: number) => string): RaceFirst[] {
  const byTeam = new Map(teams.map((t) => [t.id, t]));
  const onRoute = completions
    .filter((c) => graph.byId.has(c.tileId) && byTeam.has(c.teamId))
    .sort((a, b) => (stamp(a.completedAt) || 0) - (stamp(b.completedAt) || 0));
  const out: RaceFirst[] = [];
  const first = onRoute[0];
  if (first) out.push({ key: 'off-the-line', title: 'Off the line', team: byTeam.get(first.teamId)!, detail: labelOf(first.tileId), at: first.completedAt ?? null });
  const junction = onRoute.find((c) => tileShape(graph, c.tileId) === 'junction');
  if (junction) out.push({ key: 'junction', title: 'First to the junction', team: byTeam.get(junction.teamId)!, detail: labelOf(junction.tileId), at: junction.completedAt ?? null });
  // A road switch: a finish on a different lane from the team's last finish on a step with lanes
  // (single-tile steps are where lanes meet; they belong to no lane).
  const lastRoad = new Map<number, string>();
  for (const c of onRoute) {
    if ((graph.steps[graph.byId.get(c.tileId)!.step]?.length ?? 0) < 2) continue;
    const road = roadOf(graph, c.tileId);
    const before = lastRoad.get(c.teamId);
    if (before && before !== road) {
      out.push({ key: 'road-switch', title: 'First road switch', team: byTeam.get(c.teamId)!, detail: `Road ${before} → ${road} at ${labelOf(c.tileId)}`, at: c.completedAt ?? null });
      break;
    }
    lastRoad.set(c.teamId, road);
  }
  return out;
}

export interface RaceFeedItem {
  at: string | null;
  team: RaceTeamIn;
  tileId: number;
  line: string;
}

/** The race as it happened, newest first: who finished what, at which step and on which road. */
export function raceFeed(graph: RaceGraph, teams: RaceTeamIn[], completions: RaceCompletionIn[], labelOf: (id: number) => string, limit = 12): RaceFeedItem[] {
  const byTeam = new Map(teams.map((t) => [t.id, t]));
  const steps = graph.lastStep + 1;
  return completions
    .filter((c) => graph.byId.has(c.tileId) && byTeam.has(c.teamId))
    .sort((a, b) => (stamp(b.completedAt) || 0) - (stamp(a.completedAt) || 0))
    .slice(0, limit)
    .map((c) => {
      const n = graph.byId.get(c.tileId)!;
      const where = n.step === graph.lastStep ? 'the finish' : `step ${n.step + 1} of ${steps}`;
      const road = graph.steps[n.step].length > 1 ? ` · road ${roadOf(graph, c.tileId)}` : '';
      return { at: c.completedAt ?? null, team: byTeam.get(c.teamId)!, tileId: c.tileId, line: `${labelOf(c.tileId)} — ${where}${road}` };
    });
}

// ---- The plugin panel's ordered view ------------------------------------------------------------

/** "Lab · step 3 of 10 · 2nd, 3 behind Iron Lads" — the one line at the top of the panel's race. */
export function raceSummaryLine(graph: RaceGraph, lines: RaceTeamLine[], viewerTeamId: number | null): string {
  const steps = graph.lastStep + 1;
  const me = viewerTeamId != null ? lines.find((l) => l.team.id === viewerTeamId) : undefined;
  if (!me) {
    const lead = lines[0];
    return lead ? `${lead.team.name} lead · ${lead.stepsDone} of ${steps}` : `${steps} steps`;
  }
  const at = me.finished ? 'finished' : `step ${Math.min(steps, me.stepsDone + 1)} of ${steps}`;
  if (lines.length <= 1) return `${me.team.name} · ${at}`;
  const ahead = lines.find((l) => l.rank < me.rank && l.stepsDone > me.stepsDone);
  const leader = lines[0];
  const pos = ordinal(me.rank);
  if (me.rank === 1 || !ahead) return `${me.team.name} · ${at} · ${pos}${me.rank === 1 && lines[1] ? `, ${me.stepsDone - lines[1].stepsDone} ahead` : ''}`;
  return `${me.team.name} · ${at} · ${pos}, ${leader.stepsDone - me.stepsDone} behind ${leader.team.name}`;
}

export interface PanelStepTile {
  id: number;
  label: string;
  /** Lane letter, only where the step has more than one tile. */
  road: string | null;
  state: RaceTileState | null;
}
export interface PanelStep {
  step: number;
  title: string;
  /** "Step 3 of 10 · Junction" style heading. */
  heading: string;
  tiles: PanelStepTile[];
  /** done = the team cleared it; current = where it stands; later = still to come. */
  phase: 'done' | 'current' | 'later';
  /** Teams (or players) standing at this step right now: finished the step before, not this one. */
  crowd: number;
}

/** The route as an ordered list of steps for the panel, with the viewer team's state on each tile. */
export function panelSteps(graph: RaceGraph, route: TeamRoute | null, labelOf: (id: number) => string, lines: RaceTeamLine[] = []): PanelStep[] {
  const steps = graph.lastStep + 1;
  const at = route ? (route.finished ? steps : route.path.length) : -1;
  return graph.steps.map((ids, step) => {
    const title = stepTitle(graph, step);
    const heading = `Step ${step + 1} of ${steps}${title === 'Start' || title === 'Finish' ? ` · ${title}` : ''}`;
    return {
      step,
      title,
      heading,
      tiles: ids.map((id) => ({ id, label: labelOf(id), road: ids.length > 1 ? roadOf(graph, id) : null, state: route?.state.get(id) ?? null })),
      phase: route == null ? 'later' : step < at ? 'done' : step === at ? 'current' : 'later',
      crowd: lines.filter((l) => !l.finished && l.stepsDone === step).length,
    };
  });
}

/**
 * Put lines in a race order computed elsewhere (the server's, with completion times) — ranks and
 * order come from `standings`, never from a local re-sort. Teams the standings don't list keep
 * their place at the end.
 */
export function orderLinesBy(lines: RaceTeamLine[], standings: { teamId: number; rank: number }[]): RaceTeamLine[] {
  const pos = new Map(standings.map((s, i) => [s.teamId, i]));
  const rank = new Map(standings.map((s) => [s.teamId, s.rank]));
  const ordered = [...lines].sort((a, b) => (pos.get(a.team.id) ?? 1e9) - (pos.get(b.team.id) ?? 1e9));
  const leader = ordered[0]?.stepsDone ?? 0;
  return ordered.map((l) => ({ ...l, rank: rank.get(l.team.id) ?? l.rank, behind: Math.max(0, leader - l.stepsDone) }));
}

/**
 * Everything the event page derives about a race, from the VISIBLE board only: pass the tiles this
 * viewer may see (visibleTiles) and every completion — completions on tiles outside the visible
 * route are dropped, so a hidden tile's label, step or finish can't surface in the route, the
 * firsts, the feed or the step count. The standings are ranked here once and handed to the board.
 */
export function raceViewData(args: {
  visibleBoardTiles: (Parameters<typeof raceGraphOf>[0][number] & { label: string })[];
  teams: RaceTeamIn[];
  completions: RaceCompletionIn[];
  withFirsts: boolean;
  /** A team's live count on a tile (from the unmasked rows), for each team's progress on its step. */
  progressOf?: (teamId: number, tileId: number) => StepProgress | null;
  routeOpts?: TeamRouteOpts;
}) {
  const graph = raceGraphOf(args.visibleBoardTiles);
  const ids = new Set(graph.nodes.map((n) => n.id));
  const completions = args.completions.filter((c) => ids.has(c.tileId));
  const label = new Map(args.visibleBoardTiles.map((t) => [t.id, t.label]));
  const labelOf = (id: number) => label.get(id) ?? `Tile ${id}`;
  const standings = rankRaceTeams(graph, args.teams, completions).map((r) => ({ teamId: r.teamId, rank: r.rank, stepsDone: r.stepsDone, finished: r.finished }));
  return {
    graph,
    steps: graph.lastStep + 1,
    completions,
    standings,
    firsts: args.withFirsts ? raceFirsts(graph, args.teams, completions, labelOf) : [],
    stepProgress: args.progressOf ? teamStepProgress(graph, args.teams, completions, args.progressOf, args.routeOpts) : {},
  };
}

/** A count toward a tile's goal ("2/5"). */
export interface StepProgress {
  current: number;
  goal: number;
}

/**
 * A team's progress on the step it's on: the open tile at its next step it's furthest along on, as
 * a count. Null when nothing counts yet, the tile is a one-off (goal 1), or the team finished.
 */
export function stepProgress(graph: RaceGraph, route: TeamRoute, progressOf: (tileId: number) => StepProgress | null): StepProgress | null {
  if (route.finished) return null;
  let best: StepProgress | null = null;
  for (const id of frontOpen(graph, route)) {
    const p = progressOf(id);
    if (!p || p.goal <= 1 || p.current <= 0) continue;
    const cur = { current: Math.min(p.current, p.goal), goal: p.goal };
    if (!best || cur.current / cur.goal > best.current / best.goal) best = cur;
  }
  return best;
}

/** Every team's stepProgress, by team id (picks are left out: a choose-and-lock fork counts nothing until picked). */
export function teamStepProgress(
  graph: RaceGraph,
  teams: RaceTeamIn[],
  completions: RaceCompletionIn[],
  progressOf: (teamId: number, tileId: number) => StepProgress | null,
  opts: TeamRouteOpts = {},
): Record<number, StepProgress | null> {
  const out: Record<number, StepProgress | null> = {};
  for (const t of teams) {
    const route = teamRoute(graph, completions.filter((c) => c.teamId === t.id).map((c) => c.tileId), null, opts);
    out[t.id] = stepProgress(graph, route, (tileId) => progressOf(t.id, tileId));
  }
  return out;
}

/**
 * Where a team stands on the race standings, by step and never by tile: "Finished", "Step 3 of 5",
 * "Step 3 of 5 · 2/5" (its count on that step's tile).
 */
export function raceStandingStep(s: { stepsDone: number; finished: boolean }, steps: number, progress?: StepProgress | null): string {
  if (s.finished) return 'Finished';
  const step = `Step ${Math.min(s.stepsDone + 1, steps)} of ${steps}`;
  if (progress && progress.goal > 1) return `${step} · ${Math.min(progress.current, progress.goal).toLocaleString('en-US')}/${progress.goal.toLocaleString('en-US')}`;
  return step;
}
