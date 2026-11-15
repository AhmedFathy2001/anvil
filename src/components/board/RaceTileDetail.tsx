'use client';

import { useMemo } from 'react';
import { raceGraph, raceProofBlock, raceRouteOpts, raceTileInfo, isBranchingRoute, rankRaceTeams, roadOf, teamRoute, type RaceRoadMode, type TeamRouteOpts } from '@/lib/raceRoutes';
import { raceTileState } from '@/lib/tileState';
import { racePickUrl, useTileData } from '@/lib/tileData';
import { cn } from '@/lib/utils';
import { TileStateBanner } from './TileState';
import { RoadBadge } from './RaceRouteMap';

export interface RaceDetailContext {
  tiles: { id: number; eventId?: number; position: number; label: string; icon?: string | null; raceStep?: number | null; raceNext?: number[] | null; parentTileId?: number | null; mission?: number | boolean | null }[];
  completions: { teamId: number; tileId: number; completedAt?: string | null }[];
  teams: { id: number; name: string; color: string }[];
  viewerTeamId?: number | null;
  /** The team a proof from this viewer would be filed for, when it is not the team being viewed (the public board's lens). */
  proofTeamId?: number | null;
  onOpenTile?: (id: number) => void;
}

/**
 * A race's road mode for a team (GET /api/events/:id/race-pick): the picks on a "Choose and lock
 * in" race (null elsewhere) and teamRoute's options ("Roads stay open").
 */
export function useRacePicks(eventId: number | undefined, teamId: number | null | undefined): { picks: Map<number, number> | null; opts: TeamRouteOpts; bank: boolean; loaded: boolean } {
  // Through the shared read cache: the board's own read of the same picks (and a hover prefetch)
  // answers this at once instead of asking again when the dialog opens.
  const d = useTileData<{ mode?: RaceRoadMode | null; bank?: boolean; picks?: Record<string, number> }>(eventId != null && teamId != null ? racePickUrl(eventId, teamId) : null);
  const mode = d?.mode ?? null;
  const picks = useMemo(
    () => (d && mode === 'choose' ? new Map(Object.entries(d.picks ?? {}).map(([k, v]) => [Number(k), Number(v)])) : null),
    [d, mode],
  );
  return { picks, opts: raceRouteOpts(mode), bank: !!d?.bank, loaded: d !== undefined };
}

/**
 * A race tile's place on the route, at the top of its details (components/TileDetailModal): the
 * state banner (Unlocked / Locked / Done, and why), where it leads and where it's reached from
 * as chips that open those tiles, and who stands on it now.
 */
export default function RaceTileDetail({ ctx, tileId }: { ctx: RaceDetailContext; tileId: number }) {
  const graph = useMemo(() => raceGraph(ctx.tiles), [ctx.tiles]);
  const eventId = ctx.tiles[0]?.eventId;
  const { picks, opts } = useRacePicks(eventId, ctx.viewerTeamId);
  if (!isBranchingRoute(ctx.tiles) || !graph.byId.has(tileId)) return null;
  const byId = new Map(ctx.tiles.map((t) => [t.id, t]));
  const label = (id: number) => byId.get(id)?.label ?? `Tile ${id}`;
  const doneBy = (teamId: number) => ctx.completions.filter((c) => c.teamId === teamId).map((c) => c.tileId);
  const route = ctx.viewerTeamId != null ? teamRoute(graph, doneBy(ctx.viewerTeamId), picks, opts) : null;
  const info = raceTileInfo(graph, route, tileId, label)!;
  const view = raceTileState(info.state) ?? { kind: 'locked' as const, label: info.stepLine };
  const doneRow = ctx.viewerTeamId != null ? ctx.completions.find((c) => c.teamId === ctx.viewerTeamId && c.tileId === tileId) : undefined;
  const title = info.state === 'open' ? 'Next for your team' : info.state === 'done' ? 'Done' : info.state === 'closed' ? 'Locked' : info.state === 'ahead' ? 'Locked' : info.stepLine;
  const standing = new Map(rankRaceTeams(graph, ctx.teams, ctx.completions).map((s) => [s.teamId, s]));
  const onIt = ctx.teams.filter((t) => {
    const r = teamRoute(graph, doneBy(t.id));
    return r.path[r.path.length - 1] === tileId;
  });

  // Per road: where a step has several tiles each carries its road letter, in road order, and three
  // or more stack one per line so five roads read as a list, not a jumble of chips.
  const roadsAt = (id: number) => (graph.steps[graph.byId.get(id)?.step ?? -1]?.length ?? 0) > 1;
  const chips = (list: number[]) => {
    const ids = [...list].sort((a, b) => roadOf(graph, a).localeCompare(roadOf(graph, b)));
    return (
    <span className={cn('mt-1', ids.length > 2 ? 'flex flex-col items-start gap-1' : 'flex flex-wrap gap-1.5')}>
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center gap-1.5">
        {roadsAt(id) && <RoadBadge letter={roadOf(graph, id)} />}
        <button type="button" onClick={ctx.onOpenTile ? () => ctx.onOpenTile!(id) : undefined} className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-brown-dark/60 pl-1 pr-2 py-0.5 text-xs text-foreground/90 hover:border-gold/60">
          <span className="w-5 h-5 rounded-full bg-[#1c1714] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {byId.get(id)?.icon ? <img src={byId.get(id)!.icon!} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} /> : null}
          </span>
          {label(id)}
        </button>
        </span>
      ))}
    </span>
    );
  };

  return (
    <div className="space-y-2 mb-4">
      <TileStateBanner view={view} title={title}>
        <p className="text-xs text-text-muted">{info.stepLine} · road {info.road}</p>
        {info.why && <p className="text-xs mt-1">{info.why}</p>}
        {doneRow?.completedAt && <p className="text-xs text-text-muted mt-1">Finished {doneRow.completedAt.slice(0, 16).replace('T', ' ')} UTC</p>}
      </TileStateBanner>
      {info.leadsTo.length > 0 && <div className="text-xs text-text-muted">{info.leadsTo.length > 1 ? `Leads to ${info.leadsTo.length} roads:` : 'Leads to:'}{chips(info.leadsTo)}</div>}
      {info.reachedFrom.length > 0 && <div className="text-xs text-text-muted">{info.reachedFrom.length > 1 ? `Reached from ${info.reachedFrom.length} roads:` : 'Reached from:'}{chips(info.reachedFrom)}</div>}
      {onIt.length > 0 && (
        <p className="text-xs text-text-muted">
          On it now:{' '}
          {onIt.slice(0, 6).map((t, i) => (
            <span key={t.id}>
              {i > 0 && ', '}
              <span style={{ color: t.color }}>{t.name}</span>
              {standing.get(t.id)?.rank ? ` (#${standing.get(t.id)!.rank})` : ''}
            </span>
          ))}
          {onIt.length > 6 && ` +${onIt.length - 6} more`}
        </p>
      )}
    </div>
  );
}

/**
 * Why the viewer's team cannot file proof for this race tile now (lib/raceRoutes raceProofBlock), or
 * null when it can. The server refuses the same way; this keeps the form from being offered.
 * `undefined` while the race's road mode is still loading: nothing is offered until it is known.
 */
export function useRaceProofBlock(ctx: RaceDetailContext | null | undefined, tileId: number, eventId?: number): string | null | undefined {
  const tiles = ctx?.tiles;
  const teamId = ctx?.proofTeamId ?? ctx?.viewerTeamId ?? null;
  const graph = useMemo(() => (tiles ? raceGraph(tiles) : null), [tiles]);
  const { picks, opts, bank, loaded } = useRacePicks(ctx ? (eventId ?? tiles?.[0]?.eventId) : undefined, teamId);
  if (!ctx || !graph || teamId == null) return null;
  if (!loaded) return undefined;
  const done = ctx.completions.filter((c) => c.teamId === teamId).map((c) => c.tileId);
  // A combo part answers for its combo, which is the tile on the route.
  const self = ctx.tiles.find((t) => t.id === tileId);
  return raceProofBlock(graph, teamRoute(graph, done, picks, opts), self?.parentTileId ?? tileId, { bank });
}
