'use client';

import { useEffect, useMemo, useState } from 'react';
import { raceGraph, raceTileInfo, isBranchingRoute, rankRaceTeams, teamRoute } from '@/lib/raceRoutes';
import { raceTileState } from '@/lib/tileState';
import { clanFetch } from '@/lib/clanFetch';
import { TileStateBanner } from './TileState';

export interface RaceDetailContext {
  tiles: { id: number; eventId?: number; position: number; label: string; icon?: string | null; raceStep?: number | null; raceNext?: number[] | null; parentTileId?: number | null; mission?: number | boolean | null }[];
  completions: { teamId: number; tileId: number; completedAt?: string | null }[];
  teams: { id: number; name: string; color: string }[];
  viewerTeamId?: number | null;
  onOpenTile?: (id: number) => void;
}

/** A "Choose and lock in" race's picks for a team, null elsewhere (GET /api/events/:id/race-pick). */
export function useRacePicks(eventId: number | undefined, teamId: number | null | undefined): Map<number, number> | null {
  const [picks, setPicks] = useState<Map<number, number> | null>(null);
  useEffect(() => {
    if (eventId == null || teamId == null) return;
    let gone = false;
    clanFetch(`/api/events/${eventId}/race-pick?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!gone && d?.mode === 'choose') setPicks(new Map(Object.entries(d.picks ?? {}).map(([k, v]) => [Number(k), Number(v)])));
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [eventId, teamId]);
  return picks;
}

/**
 * A race tile's place on the route, at the top of its details (components/TileDetailModal): the
 * state banner (Unlocked / Locked / Done, and why), where it leads and where it's reached from
 * as chips that open those tiles, and who stands on it now.
 */
export default function RaceTileDetail({ ctx, tileId }: { ctx: RaceDetailContext; tileId: number }) {
  const graph = useMemo(() => raceGraph(ctx.tiles), [ctx.tiles]);
  const eventId = ctx.tiles[0]?.eventId;
  const picks = useRacePicks(eventId, ctx.viewerTeamId);
  if (!isBranchingRoute(ctx.tiles) || !graph.byId.has(tileId)) return null;
  const byId = new Map(ctx.tiles.map((t) => [t.id, t]));
  const label = (id: number) => byId.get(id)?.label ?? `Tile ${id}`;
  const doneBy = (teamId: number) => ctx.completions.filter((c) => c.teamId === teamId).map((c) => c.tileId);
  const route = ctx.viewerTeamId != null ? teamRoute(graph, doneBy(ctx.viewerTeamId), picks) : null;
  const info = raceTileInfo(graph, route, tileId, label)!;
  const view = raceTileState(info.state) ?? { kind: 'locked' as const, label: info.stepLine };
  const doneRow = ctx.viewerTeamId != null ? ctx.completions.find((c) => c.teamId === ctx.viewerTeamId && c.tileId === tileId) : undefined;
  const title = info.state === 'open' ? 'Next for your team' : info.state === 'done' ? 'Done' : info.state === 'closed' ? 'Locked' : info.state === 'ahead' ? 'Locked' : info.stepLine;
  const standing = new Map(rankRaceTeams(graph, ctx.teams, ctx.completions).map((s) => [s.teamId, s]));
  const onIt = ctx.teams.filter((t) => {
    const r = teamRoute(graph, doneBy(t.id));
    return r.path[r.path.length - 1] === tileId;
  });

  const chips = (ids: number[]) => (
    <span className="flex flex-wrap gap-1.5 mt-1">
      {ids.map((id) => (
        <button key={id} type="button" onClick={ctx.onOpenTile ? () => ctx.onOpenTile!(id) : undefined} className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-brown-dark/60 pl-1 pr-2 py-0.5 text-xs text-foreground/90 hover:border-gold/60">
          <span className="w-5 h-5 rounded-full bg-[#1c1714] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {byId.get(id)?.icon ? <img src={byId.get(id)!.icon!} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} /> : null}
          </span>
          {label(id)}
        </button>
      ))}
    </span>
  );

  return (
    <div className="space-y-2 mb-4">
      <TileStateBanner view={view} title={title}>
        <p className="text-xs text-text-muted">{info.stepLine} · road {info.road}</p>
        {info.why && <p className="text-xs mt-1">{info.why}</p>}
        {doneRow?.completedAt && <p className="text-xs text-text-muted mt-1">Finished {doneRow.completedAt.slice(0, 16).replace('T', ' ')} UTC</p>}
      </TileStateBanner>
      {info.leadsTo.length > 0 && <div className="text-xs text-text-muted">Leads to:{chips(info.leadsTo)}</div>}
      {info.reachedFrom.length > 0 && <div className="text-xs text-text-muted">Reached from:{chips(info.reachedFrom)}</div>}
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
