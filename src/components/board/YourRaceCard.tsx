'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { isBranchingRoute, raceFieldSize, raceGraph, rankRaceTeams, roadChoiceLine, teamRoute } from '@/lib/raceRoutes';
import { useRacePicks, type RaceDetailContext } from './RaceTileDetail';

/**
 * "Your race" — a branching tile race at a glance on the event page: the viewer team's position
 * (n of N, rank), its tiles up next as sprite chips that open their details, the leader, and on a
 * bigger field how many are level and ahead. Null off a branching race or without a team in view.
 */
export default function YourRaceCard({ ctx }: { ctx: RaceDetailContext }) {
  const graph = useMemo(() => raceGraph(ctx.tiles), [ctx.tiles]);
  const picks = useRacePicks(ctx.tiles[0]?.eventId, ctx.viewerTeamId);
  if (!isBranchingRoute(ctx.tiles) || ctx.viewerTeamId == null) return null;
  const team = ctx.teams.find((t) => t.id === ctx.viewerTeamId);
  if (!team) return null;
  const steps = graph.lastStep + 1;
  const route = teamRoute(graph, ctx.completions.filter((c) => c.teamId === team.id).map((c) => c.tileId), picks);
  const standings = rankRaceTeams(graph, ctx.teams, ctx.completions);
  const mine = standings.find((s) => s.teamId === team.id);
  const leader = standings[0];
  const leaderTeam = leader ? ctx.teams.find((t) => t.id === leader.teamId) : undefined;
  const size = raceFieldSize(ctx.teams.length);
  const ahead = standings.filter((s) => s.stepsDone > route.stepsDone).length;
  const level = standings.filter((s) => s.teamId !== team.id && s.stepsDone === route.stepsDone).length;
  const byId = new Map(ctx.tiles.map((t) => [t.id, t]));
  const next = route.pickFrom.length ? route.pickFrom : route.open;

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-3 sm:p-4 space-y-3" aria-label="Your race">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />Your race</h3>
        <span className="text-2xl font-bold text-gold tabular-nums">{route.finished ? '🏁' : `${route.stepsDone} of ${steps}`}</span>
        {mine && <span className="text-sm text-text-muted">Rank {mine.rank} of {standings.length}</span>}
        {leaderTeam && leader.teamId !== team.id && (
          <span className="text-xs text-text-muted">Leader: <span style={{ color: leaderTeam.color }}>{leaderTeam.name}</span> · {leader.finished ? 'finished' : `${leader.stepsDone} of ${steps}`}</span>
        )}
      </div>
      <div className="h-2 rounded-full bg-[#251e18] overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${steps ? (route.stepsDone / steps) * 100 : 0}%` }} />
      </div>
      {size !== 'few' && <p className="text-xs text-text-muted">{ahead} {size === 'huge' ? 'players' : 'teams'} ahead · {level} level with you</p>}
      {!route.finished && next.length > 0 && (
        <div>
          <p className="text-xs text-text-muted mb-1.5">{route.pickFrom.length ? 'Pick your road:' : next.length > 1 ? 'Up next — whichever you get first sets your road:' : 'Up next:'}</p>
          <div className="flex flex-wrap gap-2">
            {next.map((id) => (
              <button
                key={id}
                type="button"
                onClick={ctx.onOpenTile ? () => ctx.onOpenTile!(id) : undefined}
                className={cn('inline-flex items-center gap-2 rounded-full border-2 border-dashed border-gold/70 bg-gold/10 pl-1 pr-3 py-1 text-xs text-foreground hover:bg-gold/20')}
                title={roadChoiceLine(graph, route, id)}
              >
                <span className="w-7 h-7 rounded-full bg-[#1c1714] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {byId.get(id)?.icon ? <img src={byId.get(id)!.icon!} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} /> : null}
                </span>
                <span className="truncate max-w-[12rem]">{byId.get(id)?.label ?? `Tile ${id}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
