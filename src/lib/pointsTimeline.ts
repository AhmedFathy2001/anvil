import { scoreTeams, type ScoringTile } from '@/lib/boardScoring';
import { DAY_MS, HOUR_MS, stampMs } from '@/lib/eventDay';
import type { EventRules } from '@/lib/eventRules';
import { computeMemberBreakdown, rollupByOwner, type StatGainMap } from '@/lib/memberBreakdown';
import type { StatContributionSnapshot } from '@/lib/statTracking';

// Points over time: every team's score, and the top scorers' points, at each step of the event.
//
// Nothing here is a new rule. A team's curve is lib/boardScoring `scoreTeams` over the completions
// that existed at each moment (frozen awardedPoints, optional tiles out, tile count on a classic
// board, missions on top as bonus — they carry a completedAt like any tile). A player's curve is the
// MVP split (lib/memberBreakdown) over the same slice, so a tile's points land on its contributors at
// the moment the tile completed, and the last point equals the MVP / individual ladder number.
//
// Pure (no `@/db`): the stats page loads the rows, already filtered by eventActivityIsValid.

export interface TimelineCompletion {
  teamId: number;
  tileId: number;
  completedAt: string;
  awardedPoints?: number | null;
  creditPlayerId?: number | null;
  statContributions?: StatContributionSnapshot | null;
}

export interface TimelineTile extends ScoringTile {
  label?: string | null;
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  points?: number | null;
  optional?: number | null;
}

export interface TimelinePlayer {
  id: number;
  name: string;
  teamId: number | null;
  frozenAt?: string | null;
}

export interface PointsTimeline {
  /** Epoch ms of each point: the start (all zero), every step boundary, then now / the end. */
  at: number[];
  stepMs: number;
  unit: 'pts' | 'tiles';
  teams: { teamId: number; values: number[] }[];
  /**
   * Everyone who was in the top `topN` at ANY point (capped at `maxLines`), plus the viewer, best final
   * score first. `teamId` colours them; `key` is stable per person; `isViewer` marks the viewer's line.
   */
  players: { key: string; playerId: number; name: string; teamId: number; values: number[]; isViewer?: boolean }[];
}

/** Hourly up to a week, 6-hourly up to a month, daily beyond — a few hundred points at most. */
export function timelineStep(spanMs: number): number {
  if (spanMs <= 7 * DAY_MS) return HOUR_MS;
  if (spanMs <= 31 * DAY_MS) return 6 * HOUR_MS;
  return DAY_MS;
}

/** start, start+step, … strictly before `toMs`, then `toMs` itself. */
export function timelineBuckets(startMs: number, toMs: number, stepMs: number): number[] {
  const at = [startMs];
  for (let t = startMs + stepMs; t < toMs; t += stepMs) at.push(t);
  if (toMs > startMs) at.push(toMs);
  return at;
}

export function computePointsTimeline(args: {
  scoringMode: string | null | undefined;
  rules?: EventRules;
  startMs: number;
  /** min(end, now): the last point. */
  toMs: number;
  teams: { id: number }[];
  players: TimelinePlayer[];
  tiles: TimelineTile[];
  completions: TimelineCompletion[];
  submissions: { teamId: number; tileId: number; creditPlayerId: number | null; amount: number }[];
  statGains?: StatGainMap;
  ownerByPlayerId?: Map<number, number | null>;
  accountSlotMode?: string | null;
  topN?: number;
  /** At most this many lines from the ever-top-N (the viewer's own is extra). Default 10. */
  maxLines?: number;
  /** The viewer's event rows — their line is always drawn, top scorer or not. */
  viewerPlayerIds?: number[];
}): PointsTimeline {
  const { scoringMode, rules, startMs, toMs, teams, players, tiles, submissions, statGains, topN = 6, maxLines = 10 } = args;
  const perPerson = args.accountSlotMode === 'per-person' && !!args.ownerByPlayerId;
  const stepMs = timelineStep(toMs - startMs);
  const at = timelineBuckets(startMs, toMs, stepMs);

  // Oldest first, so "everything up to t" is a prefix. Nothing before the start scores (the caller
  // already applied eventActivityIsValid; this keeps the curve honest if it didn't).
  const timed = args.completions
    .map((c) => ({ c, ms: stampMs(c.completedAt) }))
    .filter((x): x is { c: TimelineCompletion; ms: number } => x.ms != null && x.ms >= startMs)
    .sort((a, b) => a.ms - b.ms);
  const upTo = (ms: number) => {
    let n = 0;
    while (n < timed.length && timed[n].ms <= ms) n++;
    return timed.slice(0, n).map((x) => x.c);
  };

  // Only submissions on tiles a team actually finished can move a split; the rest is in-progress work.
  const finished = new Set(timed.map(({ c }) => `${c.teamId}-${c.tileId}`));
  const subsByTeam = new Map<number, typeof submissions>();
  for (const s of submissions) {
    if (!finished.has(`${s.teamId}-${s.tileId}`)) continue;
    const list = subsByTeam.get(s.teamId) ?? [];
    list.push(s);
    subsByTeam.set(s.teamId, list);
  }

  const teamValues = new Map(teams.map((t) => [t.id, [] as number[]]));
  const personValues = new Map<string, { playerId: number; name: string; teamId: number; values: number[] }>();
  const keyOf = (teamId: number, playerId: number) => {
    const owner = perPerson ? args.ownerByPlayerId!.get(playerId) : null;
    return owner != null ? `${teamId}-u${owner}` : `p${playerId}`;
  };
  // A team's split only changes when its completions do, so reuse the last one until then.
  const lastSplit = new Map<number, { count: number; points: Map<string, { playerId: number; name: string; points: number }> }>();

  let unit: 'pts' | 'tiles' = scoringMode === 'points' ? 'pts' : 'tiles';
  at.forEach((ms, i) => {
    const done = upTo(ms);
    const scored = scoreTeams({ scoringMode, rules, tiles, completions: done, teams });
    unit = scored[0]?.unit ?? unit;
    for (const s of scored) teamValues.get(s.teamId)?.push(s.score);

    for (const team of teams) {
      const mine = done.filter((c) => c.teamId === team.id);
      let split = lastSplit.get(team.id);
      if (!split || split.count !== mine.length) {
        const raw = computeMemberBreakdown({
          teamId: team.id,
          scoringMode,
          players,
          tiles,
          completions: mine,
          submissions: subsByTeam.get(team.id) ?? [],
          statGains,
        });
        const members = perPerson ? rollupByOwner(raw, args.ownerByPlayerId!) : raw;
        split = { count: mine.length, points: new Map(members.map((m) => [keyOf(team.id, m.playerId), { playerId: m.playerId, name: m.name, points: m.points }])) };
        lastSplit.set(team.id, split);
      }
      for (const [key, m] of split.points) {
        let row = personValues.get(key);
        if (!row) {
          row = { playerId: m.playerId, name: m.name, teamId: team.id, values: new Array(i).fill(0) };
          personValues.set(key, row);
        }
        // Name and lead account follow the latest split (a rolled-up person's lead can change).
        row.playerId = m.playerId;
        row.name = m.name;
        row.values.push(m.points);
      }
    }
    // Every roster member is in every split; this only pads a row that somehow went missing.
    for (const row of personValues.values()) if (row.values.length < i + 1) row.values.push(row.values[row.values.length - 1] ?? 0);
  });

  // Who is drawn: anyone who was in the top N at any step, not just at the end — someone who led day 1
  // and has since slipped is part of the story and shouldn't vanish. Best final score first, capped.
  // The viewer always gets a line of their own, so everyone can find themselves.
  const last = (v: number[]) => v[v.length - 1] ?? 0;
  const rows = [...personValues.entries()];
  const everTop = new Set<string>();
  at.forEach((_, i) => {
    rows
      .filter(([, r]) => (r.values[i] ?? 0) > 0)
      .sort(([, a], [, b]) => (b.values[i] ?? 0) - (a.values[i] ?? 0) || a.name.localeCompare(b.name))
      .slice(0, topN)
      .forEach(([key]) => everTop.add(key));
  });
  const byFinal = ([, a]: [string, { name: string; values: number[] }], [, b]: [string, { name: string; values: number[] }]) =>
    last(b.values) - last(a.values) || a.name.localeCompare(b.name);
  const viewerIds = new Set(args.viewerPlayerIds ?? []);
  const isViewer = (r: { playerId: number }) => viewerIds.has(r.playerId);
  const shown = rows.filter(([key]) => everTop.has(key)).sort(byFinal).slice(0, maxLines);
  for (const entry of rows) {
    if (isViewer(entry[1]) && !shown.some(([key]) => key === entry[0])) shown.push(entry);
  }
  const top = shown.sort(byFinal).map(([key, r]) => ({ key, ...r, ...(isViewer(r) ? { isViewer: true } : {}) }));

  return {
    at,
    stepMs,
    unit,
    teams: teams.map((t) => ({ teamId: t.id, values: teamValues.get(t.id) ?? [] })),
    players: top,
  };
}
