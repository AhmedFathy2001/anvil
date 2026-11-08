'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  raceFieldSize,
  raceGraph,
  rankRaceTeams,
  roadChoiceLine,
  roadOf,
  stepLine,
  stepTitle,
  teamRoute,
  type RaceGraph,
  type RaceStanding,
  type TeamRoute,
} from '@/lib/raceRoutes';
import { raceTileState } from '@/lib/tileState';
import type { TeamScore } from '@/lib/boardScoring';
import { clanFetch } from '@/lib/clanFetch';
import type { TileRaceBoardProps } from '@/components/TileRaceBoard';
import Select from '@/components/Select';
import SoloStandings from '@/components/SoloStandings';
import RaceRouteMap, { RouteMapLegend } from './RaceRouteMap';
import { TileStateChip } from './TileState';

/**
 * A tile race with branching routes (lib/raceRoutes), drawn as a road map. The field strip on top
 * fits the field: a distance track for a few teams, the field stacked per step for a crowd, a bar
 * chart for a solo-sized field. With a team in view: its road lit, the tiles up next as cards (or
 * the fork to pick, on a choose-and-lock race), and the tile list with the same state language.
 */

type PickInfo = { mode: 'achieve' | 'choose'; picks: Map<number, number>; canPick: boolean };

export default function BranchingRaceBoard({ tiles, completions, teams, activeTeamId, onTileClick, dropProgress, statProgress, expanded, matchedTileIds }: TileRaceBoardProps) {
  const graph = useMemo(() => raceGraph(tiles), [tiles]);
  const steps = graph.lastStep + 1;
  const eventId = (tiles[0] as { eventId?: number } | undefined)?.eventId;
  const viewer = activeTeamId ?? null;

  const [pickInfo, setPickInfo] = useState<PickInfo | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (viewer == null || eventId == null) return;
    let gone = false;
    clanFetch(`/api/events/${eventId}/race-pick?teamId=${viewer}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!gone && d) setPickInfo({ mode: d.mode, picks: new Map(Object.entries(d.picks ?? {}).map(([k, v]) => [Number(k), Number(v)])), canPick: !!d.canPick });
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [viewer, eventId]);

  const doneBy = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const c of completions) m.set(c.teamId, [...(m.get(c.teamId) ?? []), c.tileId]);
    return m;
  }, [completions]);
  const routes = useMemo(() => {
    const m = new Map<number, TeamRoute>();
    for (const t of teams) m.set(t.id, teamRoute(graph, doneBy.get(t.id) ?? [], t.id === viewer && pickInfo?.mode === 'choose' ? pickInfo.picks : null));
    return m;
  }, [teams, graph, doneBy, viewer, pickInfo]);
  const standings = useMemo(() => rankRaceTeams(graph, teams, completions), [graph, teams, completions]);
  const variant = raceFieldSize(teams.length);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const route = viewer != null ? routes.get(viewer) ?? null : null;
  const viewerTeam = viewer != null ? teamById.get(viewer) : undefined;

  const progress = new Map<number, string>();
  for (const [id, p] of dropProgress ?? []) if (p.current > 0) progress.set(id, `${p.current}/${p.required}`);
  for (const [id, p] of statProgress ?? []) if (p.current > 0) progress.set(id, `${Math.round(p.current).toLocaleString()}/${p.goal.toLocaleString()}`);

  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const nodes = graph.nodes.map((n) => ({ id: n.id, step: n.step, next: n.next, label: tileById.get(n.id)?.label ?? `Tile ${n.id}`, icon: tileById.get(n.id)?.icon ?? null }));
  const mapTeams = teams.map((t) => ({ ...t, path: routes.get(t.id)?.path ?? [] }));

  async function pick(tileId: number) {
    if (eventId == null || viewer == null) return;
    setPicking(true);
    setPickError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-pick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: viewer, tileId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setPickError(d.error || 'Could not pick that road.');
      const step = graph.byId.get(tileId)!.step;
      setPickInfo((p) => (p ? { ...p, picks: new Map(p.picks).set(step, tileId) } : p));
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className={cn('w-full mx-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border space-y-4 min-w-0', expanded ? 'max-w-6xl' : 'max-w-4xl')}>
      <FieldStrip variant={variant} standings={standings} steps={steps} teamById={teamById} viewer={viewer} />

      {route && !route.finished && (route.open.length > 0 || route.pickFrom.length > 0) && (
        <NextCards
          graph={graph}
          route={route}
          tileById={tileById}
          onTileClick={onTileClick}
          canPick={!!pickInfo?.canPick}
          picking={picking}
          onPick={pick}
          error={pickError}
        />
      )}
      {route?.finished && (
        <p className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold font-semibold">🏁 Your team reached the finish.</p>
      )}

      <RaceRouteMap
        nodes={nodes}
        state={route?.state}
        path={route?.path}
        variant={variant}
        teams={mapTeams}
        viewerTeamId={viewer}
        onTileClick={onTileClick}
        progress={progress}
        matched={matchedTileIds ?? null}
        stepLabel={(s) => stepTitle(graph, s)}
      />
      <RouteMapLegend withTeam={!!route} />

      {variant === 'medium' && <FrontAndAround standings={standings} teamById={teamById} viewer={viewer} steps={steps} />}
      {variant === 'huge' && eventId != null && (
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><span className="w-1 h-4 bg-gold rounded-full" />Standings</h3>
          <SoloStandings
            teams={teams}
            scores={new Map(standings.map((s) => [s.teamId, { teamId: s.teamId, boardScore: s.stepsDone, bonusScore: 0, score: s.stepsDone, total: steps, unit: 'tiles', pct: steps ? Math.round((s.stepsDone / steps) * 100) : 0 } satisfies TeamScore]))}
            eventId={eventId}
            myTeamIds={viewer != null ? [viewer] : []}
          />
        </div>
      )}

      <RaceTileList graph={graph} route={route} tileById={tileById} onTileClick={onTileClick} teamName={viewerTeam?.name} />
    </div>
  );
}

// ---- The field strip ------------------------------------------------------------------------------

function FieldStrip({ variant, standings, steps, teamById, viewer }: { variant: 'few' | 'medium' | 'huge'; standings: RaceStanding[]; steps: number; teamById: Map<number, { id: number; name: string; color: string }>; viewer: number | null }) {
  if (!standings.length) return null;
  if (variant === 'few') {
    return (
      <section aria-label="Distance to the finish">
        <h3 className="text-xs font-semibold text-text-muted mb-2">Distance to the finish</h3>
        <div className="space-y-2">
          {standings.map((s) => {
            const t = teamById.get(s.teamId)!;
            const pct = steps ? (s.stepsDone / steps) * 100 : 0;
            return (
              <div key={s.teamId} className="flex items-center gap-2 min-w-0">
                <span className="w-4 text-right text-[11px] text-text-muted tabular-nums">{s.rank}</span>
                <div className="relative flex-1 h-2 rounded-full bg-[#251e18]">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: `${t.color}88` }} />
                  <span className={cn('absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#141010]', s.teamId === viewer && 'ring-2 ring-gold')} style={{ left: `${pct}%`, backgroundColor: t.color }} />
                </div>
                <span className={cn('w-36 sm:w-44 truncate text-xs', s.teamId === viewer ? 'text-gold font-semibold' : 'text-foreground/90')}>
                  {t.name} <span className="text-text-muted font-normal">· {s.finished ? '🏁 finished' : `${s.stepsDone} of ${steps}`}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  // Teams per steps-done (0 = still at the start).
  const columns = Array.from({ length: steps + 1 }, (_, i) => standings.filter((s) => s.stepsDone === i));
  if (variant === 'medium') {
    return (
      <section aria-label="Where the field is">
        <h3 className="text-xs font-semibold text-text-muted mb-2">Where the field is</h3>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1.5 min-w-max">
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col items-center gap-1 w-9">
                <div className="flex flex-col-reverse items-center gap-0.5 min-h-[20px]">
                  {col.map((s) => {
                    const t = teamById.get(s.teamId)!;
                    return <span key={s.teamId} title={t.name} className={cn('w-3 h-3 rounded-full border border-[#141010]', s.teamId === viewer && 'ring-2 ring-gold')} style={{ backgroundColor: t.color }} />;
                  })}
                </div>
                <span className="text-[10px] text-text-muted tabular-nums">{i === 0 ? 'Start' : i}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  const max = Math.max(1, ...columns.map((c) => c.length));
  const mineAt = standings.find((s) => s.teamId === viewer)?.stepsDone;
  return (
    <section aria-label="Players per step">
      <h3 className="text-xs font-semibold text-text-muted mb-2">Players per step</h3>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 min-w-max h-28">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col items-center justify-end gap-1 w-10 h-full">
              <span className={cn('text-[10px] tabular-nums', i === mineAt ? 'text-gold font-semibold' : 'text-text-muted')}>{col.length}{i === mineAt ? ' · you' : ''}</span>
              <div className={cn('w-6 rounded-t', i === mineAt ? 'bg-gold' : 'bg-[#4a3d30]')} style={{ height: `${Math.max(2, (col.length / max) * 72)}px` }} />
              <span className="text-[10px] text-text-muted">{i === 0 ? 'Start' : i}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Up next / pick your road ---------------------------------------------------------------------

function NextCards({ graph, route, tileById, onTileClick, canPick, picking, onPick, error }: {
  graph: RaceGraph; route: TeamRoute; tileById: Map<number, { id: number; label: string; icon?: string | null }>;
  onTileClick?: (id: number) => void; canPick: boolean; picking: boolean; onPick: (id: number) => void; error: string | null;
}) {
  const choosing = route.pickFrom.length > 0;
  const ids = choosing ? route.pickFrom : route.open;
  return (
    <section aria-label={choosing ? 'Pick your road' : 'Up next'}>
      <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />{choosing ? 'Pick your road' : 'Up next'}</h3>
      <p className="text-xs text-text-muted mt-1 mb-2">
        {choosing
          ? canPick
            ? 'A fork: pick the tile your team goes for. Only the picked tile counts, and the pick can’t be changed.'
            : 'A fork: your team’s captain picks the road before any tile here counts.'
          : ids.length > 1
            ? 'Up next — whichever you get first sets your road. The others close for your team.'
            : 'Your next tile.'}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ids.map((id) => {
          const t = tileById.get(id);
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gold/70 bg-gold/10 px-3 py-2 min-w-0">
              <button type="button" onClick={onTileClick ? () => onTileClick(id) : undefined} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className="w-10 h-10 rounded-full bg-[#1c1714] border-2 border-gold flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t?.icon ? <img src={t.icon} alt="" className="w-6 h-6 object-contain" style={{ imageRendering: 'pixelated' }} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground truncate">{t?.label ?? `Tile ${id}`}</span>
                  <span className="block text-[11px] text-gold">{roadChoiceLine(graph, route, id)}</span>
                </span>
              </button>
              {choosing && canPick && (
                <button type="button" disabled={picking} onClick={() => onPick(id)} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/50 text-gold hover:bg-gold/30 disabled:opacity-50">
                  Pick
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </section>
  );
}

// ---- Out in front / around you --------------------------------------------------------------------

function FrontAndAround({ standings, teamById, viewer, steps }: { standings: RaceStanding[]; teamById: Map<number, { id: number; name: string; color: string }>; viewer: number | null; steps: number }) {
  const top = standings.slice(0, 5);
  const at = standings.findIndex((s) => s.teamId === viewer);
  const around = at < 0 ? [] : standings.slice(Math.max(0, at - 2), at + 3);
  const line = (s: RaceStanding) => {
    const t = teamById.get(s.teamId)!;
    return (
      <li key={s.teamId} className={cn('flex items-center gap-2 text-xs px-2 py-1 rounded', s.teamId === viewer && 'bg-gold/10 text-gold')}>
        <span className="w-5 text-right tabular-nums text-text-muted">{s.rank}</span>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
        <span className="truncate flex-1">{t.name}</span>
        <span className="tabular-nums text-text-muted">{s.finished ? '🏁' : `${s.stepsDone}/${steps}`}</span>
      </li>
    );
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="border border-card-border rounded-xl bg-card-bg p-3">
        <h3 className="text-xs font-semibold text-text-muted mb-1.5">Out in front</h3>
        <ul className="space-y-0.5">{top.map(line)}</ul>
      </section>
      {around.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-3">
          <h3 className="text-xs font-semibold text-text-muted mb-1.5">Around you</h3>
          <ul className="space-y-0.5">{around.map(line)}</ul>
        </section>
      )}
    </div>
  );
}

// ---- The tile list --------------------------------------------------------------------------------

type ListFilter = 'all' | 'next' | 'done' | 'locked';

/** Every tile on the route in step order, with its state, step and road; open-next tiles first. */
export function RaceTileList({ graph, route, tileById, onTileClick, teamName }: {
  graph: RaceGraph; route: TeamRoute | null; tileById: Map<number, { id: number; label: string; icon?: string | null }>;
  onTileClick?: (id: number) => void; teamName?: string;
}) {
  const [filter, setFilter] = useState<ListFilter>('all');
  const rows = graph.nodes
    .filter((n) => {
      const st = route?.state.get(n.id);
      if (filter === 'next') return st === 'open';
      if (filter === 'done') return st === 'done';
      if (filter === 'locked') return st === 'ahead' || st === 'closed';
      return true;
    })
    .sort((a, b) => Number(route?.state.get(b.id) === 'open') - Number(route?.state.get(a.id) === 'open') || a.step - b.step || a.position - b.position);
  return (
    <section aria-label="Race tiles">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />Tiles</h3>
        {route && (
          <div className="w-40">
            <Select
              value={filter}
              onChange={(v) => setFilter(v as ListFilter)}
              ariaLabel="Show tiles"
              options={[
                { value: 'all', label: 'All' },
                { value: 'next', label: teamName ? `Next for ${teamName}` : 'Next for us' },
                { value: 'done', label: 'Done' },
                { value: 'locked', label: 'Locked' },
              ]}
            />
          </div>
        )}
      </div>
      <ul className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border overflow-hidden">
        {rows.length === 0 && <li className="px-3 py-3 text-xs text-text-muted">No tiles here.</li>}
        {rows.map((n) => {
          const t = tileById.get(n.id);
          const st = route?.state.get(n.id) ?? null;
          const view = raceTileState(st);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={onTileClick ? () => onTileClick(n.id) : undefined}
                className={cn('w-full flex items-center gap-3 px-3 py-2 text-left min-w-0', st === 'open' && 'bg-gold/10', (st === 'closed' || st === 'ahead') && 'opacity-60', st === 'closed' && 'grayscale', onTileClick && 'hover:bg-card-bg-hover')}
              >
                <span className={cn('w-8 h-8 rounded-full bg-[#1c1714] border-2 flex items-center justify-center shrink-0', st === 'open' ? 'border-dashed border-gold' : st === 'done' ? 'border-gold' : 'border-[#332a22]')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t?.icon ? <img src={t.icon} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} /> : <span className="text-[10px] text-text-muted">{n.step + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm truncate', st === 'open' || st === 'done' ? 'text-foreground' : 'text-text-muted')}>{t?.label ?? `Tile ${n.id}`}</span>
                  <span className="block text-[11px] text-text-muted">{stepLine(graph, n.id)} · road {roadOf(graph, n.id)}</span>
                </span>
                {view && <TileStateChip view={view} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
