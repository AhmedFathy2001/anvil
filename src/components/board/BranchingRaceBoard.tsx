'use client';

import { useMemo } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { raceGraph, rankRaceTeams, teamRoute } from '@/lib/raceRoutes';
import type { TileRaceBoardProps } from '@/components/TileRaceBoard';
import RaceRouteMap, { type RouteMapTeam } from './RaceRouteMap';

/**
 * A tile race with branching routes (lib/raceRoutes). Standings first (first to an end tile wins,
 * then steps done), then the route map. With a team in view, its committed path is lit, the tiles it
 * can play next glow with a NEXT marker, and the alternatives it passed up fade out.
 */
export default function BranchingRaceBoard({
  tiles,
  completions,
  teams,
  activeTeamId,
  onTileClick,
  dropProgress,
  statProgress,
  expanded,
  matchedTileIds,
}: TileRaceBoardProps) {
  const graph = useMemo(() => raceGraph(tiles), [tiles]);
  const steps = graph.lastStep + 1;
  const renderedTeams = activeTeamId ? teams.filter((t) => t.id === activeTeamId) : teams;
  const doneBy = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const c of completions) m.set(c.teamId, [...(m.get(c.teamId) ?? []), c.tileId]);
    return m;
  }, [completions]);
  const standings = rankRaceTeams(graph, renderedTeams, completions);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const tokens = new Map<number, RouteMapTeam[]>();
  const atStart: RouteMapTeam[] = [];
  for (const t of renderedTeams) {
    const r = teamRoute(graph, doneBy.get(t.id) ?? []);
    const at = r.path[r.path.length - 1];
    if (at == null) atStart.push(t);
    else tokens.set(at, [...(tokens.get(at) ?? []), t]);
  }

  const active = activeTeamId ? teamById.get(activeTeamId) : undefined;
  const route = active ? teamRoute(graph, doneBy.get(active.id) ?? []) : null;

  const progress = new Map<number, string>();
  for (const [id, p] of dropProgress ?? []) if (p.current > 0) progress.set(id, `${formatNumber(p.current)}/${formatNumber(p.required)}`);
  for (const [id, p] of statProgress ?? []) if (p.current > 0) progress.set(id, `${formatNumber(p.current)}/${formatNumber(p.goal)}`);

  const labelOf = new Map(tiles.map((t) => [t.id, t.label]));
  const iconOf = new Map(tiles.map((t) => [t.id, t.icon ?? null]));
  const nodes = graph.nodes.map((n) => ({ id: n.id, step: n.step, next: n.next, label: labelOf.get(n.id) ?? `Tile ${n.id}`, icon: iconOf.get(n.id) }));

  return (
    <div
      className={cn(
        'w-full mx-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border space-y-4 min-w-0',
        expanded ? 'max-w-6xl' : 'max-w-4xl',
      )}
    >
      {standings.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {standings.map((s) => {
            const team = teamById.get(s.teamId)!;
            return (
              <div key={s.teamId} className="flex items-center gap-2 text-sm min-w-0">
                <span className="w-5 text-right text-xs text-text-muted tabular-nums">{s.rank}.</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                <span className="truncate flex-1 text-foreground/90">{team.name}</span>
                <span className={cn('tabular-nums text-xs', s.finished ? 'text-gold font-semibold' : 'text-text-muted')}>
                  {s.finished ? '🏁 finished' : `${s.stepsDone}/${steps} steps`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {route && !route.finished && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground/90">
          {route.open.length > 1 ? (
            <>
              <span className="font-semibold text-gold">{route.path.length === 0 ? 'Pick your start: ' : 'Crossing ahead: '}</span>
              {route.open.length} tiles are open next. Finish any one of them and your route goes that way — the others close for your team.
            </>
          ) : route.open.length === 1 ? (
            <>
              <span className="font-semibold text-gold">Next: </span>
              {labelOf.get(route.open[0])}
            </>
          ) : (
            'No open tiles — ask the host to check the route.'
          )}
        </div>
      )}

      {atStart.length > 0 && !active && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="px-2 py-1 rounded-md bg-brown-dark/60 border border-card-border font-medium">🏁 Start</span>
          <span className="flex -space-x-1">
            {atStart.map((t) => (
              <span key={t.id} className="w-3.5 h-3.5 rounded-full border border-brown-dark" style={{ backgroundColor: t.color }} title={t.name} />
            ))}
          </span>
        </div>
      )}

      <RaceRouteMap
        nodes={nodes}
        state={route?.state}
        path={route?.path}
        pathColor={active?.color ?? '#d4af37'}
        tokens={active ? undefined : tokens}
        onTileClick={onTileClick}
        progress={progress}
        matched={matchedTileIds ?? null}
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
        {route && (
          <>
            <span><span className="px-1 rounded bg-gold text-brown-dark font-bold text-[9px]">NEXT</span> open for your team</span>
            <span>✓ on your route</span>
            <span>🔒 later on a route you can still take</span>
            <span className="opacity-60">Faded: closed for your team</span>
          </>
        )}
        <span className="text-gold/80">⇄ Split / Merge / Junction: where routes branch and cross — the place to switch lanes</span>
      </div>
    </div>
  );
}
