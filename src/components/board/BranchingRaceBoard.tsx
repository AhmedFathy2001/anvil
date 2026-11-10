'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  raceFieldSize,
  raceGraph,
  rankRaceTeams,
  roadChoiceLine,
  ROADS_OPEN_NOTE,
  frontOpen,
  raceRouteOpts,
  roadOf,
  stepLine,
  stepTitle,
  teamRoute,
  type RaceGraph,
  type RaceRoadMode,
  type RaceStanding,
  type TeamRoute,
} from '@/lib/raceRoutes';
import { raceTileState } from '@/lib/tileState';
import type { TeamScore } from '@/lib/boardScoring';
import { clanFetch } from '@/lib/clanFetch';
import type { TileRaceBoardProps } from '@/components/TileRaceBoard';
import Select from '@/components/Select';
import SoloStandings from '@/components/SoloStandings';
import RaceRouteMap, { RouteMapLegend, tileInitials } from './RaceRouteMap';
import { TileStateChip } from './TileState';

/**
 * A tile race with branching routes (lib/raceRoutes), drawn as a road map. The field strip on top
 * fits the field: a distance track for a few teams, the field stacked per step for a crowd, a bar
 * chart for a solo-sized field. With a team in view: its road lit, the tiles up next as cards (or
 * the fork to pick, on a choose-and-lock race), and the tile list with the same state language.
 */

export type PickInfo = { mode: RaceRoadMode; picks: Map<number, number>; canPick: boolean };

/**
 * A team's road picks on a "Choose and lock in" race, whether the viewer may pick, and `pick` to
 * lock one in (GET/POST /api/events/:id/race-pick). Null info off that mode.
 */
export function useRacePick(eventId: number | undefined, teamId: number | null, graph: RaceGraph) {
  const [pickInfo, setPickInfo] = useState<PickInfo | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (teamId == null || eventId == null) return;
    let gone = false;
    clanFetch(`/api/events/${eventId}/race-pick?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!gone && d) setPickInfo({ mode: d.mode, picks: new Map(Object.entries(d.picks ?? {}).map(([k, v]) => [Number(k), Number(v)])), canPick: !!d.canPick });
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [teamId, eventId]);
  async function pick(tileId: number) {
    if (eventId == null || teamId == null) return;
    setPicking(true);
    setPickError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-pick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, tileId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setPickError(d.error || 'Could not pick that road.');
      const step = graph.byId.get(tileId)!.step;
      setPickInfo((p) => (p ? { ...p, picks: new Map(p.picks).set(step, tileId) } : p));
    } finally {
      setPicking(false);
    }
  }
  return { pickInfo, pickError, picking, pick };
}

export default function BranchingRaceBoard({ tiles, completions, teams, activeTeamId, onTileClick, dropProgress, statProgress, expanded, matchedTileIds, raceLayout = 'full', raceFit = false, raceLens }: TileRaceBoardProps) {
  // 'track': the event page's Race track card — strip, map, legend, tiles. Up next and the standings
  // are page sections there (components/board/RaceEventSections). 'full': everything in one card.
  const full = raceLayout !== 'track';
  const graph = useMemo(() => raceGraph(tiles), [tiles]);
  const steps = graph.lastStep + 1;
  const eventId = (tiles[0] as { eventId?: number } | undefined)?.eventId;
  const viewer = activeTeamId ?? null;

  const { pickInfo, pickError, picking, pick } = useRacePick(eventId, viewer, graph);

  const doneBy = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const c of completions) m.set(c.teamId, [...(m.get(c.teamId) ?? []), c.tileId]);
    return m;
  }, [completions]);
  const routes = useMemo(() => {
    const m = new Map<number, TeamRoute>();
    for (const t of teams) m.set(t.id, teamRoute(graph, doneBy.get(t.id) ?? [], t.id === viewer && pickInfo?.mode === 'choose' ? pickInfo.picks : null, raceRouteOpts(pickInfo?.mode)));
    return m;
  }, [teams, graph, doneBy, viewer, pickInfo]);
  const standings = useMemo(() => rankRaceTeams(graph, teams, completions), [graph, teams, completions]);
  const variant = raceFieldSize(teams.length);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const route = viewer != null ? routes.get(viewer) ?? null : null;
  const viewerTeam = viewer != null ? teamById.get(viewer) : undefined;
  // The map draws the lens's road: yours by default, nobody's for Everyone, or the team picked.
  const focus = raceLens === undefined ? viewer : raceLens;
  const shown = focus != null ? routes.get(focus) ?? null : null;

  const progress = new Map<number, string>();
  for (const [id, p] of dropProgress ?? []) if (p.current > 0) progress.set(id, `${p.current}/${p.required}`);
  for (const [id, p] of statProgress ?? []) if (p.current > 0) progress.set(id, `${Math.round(p.current).toLocaleString()}/${p.goal.toLocaleString()}`);

  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const nodes = graph.nodes.map((n) => ({ id: n.id, step: n.step, next: n.next, label: tileById.get(n.id)?.label ?? `Tile ${n.id}`, icon: tileById.get(n.id)?.icon ?? null }));
  const mapTeams = teams.map((t) => ({ ...t, path: routes.get(t.id)?.path ?? [] }));

  return (
    <div className={cn('w-full mx-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border space-y-4 min-w-0', raceLayout === 'track' ? 'max-w-none' : expanded ? 'max-w-6xl' : 'max-w-4xl')}>
      <FieldStrip variant={variant} standings={standings} steps={steps} teamById={teamById} viewer={viewer} />

      {full && route && !route.finished && (route.open.length > 0 || route.pickFrom.length > 0) && (
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
      {full && route?.finished && (
        <p className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold font-semibold">🏁 Your team reached the finish.</p>
      )}

      <RaceRouteMap
        // Fit the box (a narrow column turns the map to run top to bottom), except on the event
        // page's track card, whose fullscreen view scales up instead.
        shrink={raceLayout !== 'track' && !raceFit}
        nodes={nodes}
        state={shown?.state}
        path={shown?.path}
        variant={variant}
        teams={mapTeams}
        viewerTeamId={viewer}
        onTileClick={onTileClick}
        progress={progress}
        matched={matchedTileIds ?? null}
        stepLabel={(s) => stepTitle(graph, s)}
        lockedIds={shown ? new Set(shown.pickFrom) : undefined}
        youTileId={route && route.path.length ? route.path[route.path.length - 1] : null}
        youNotStarted={!!route && route.path.length === 0}
        fit={raceFit}
      />
      <RouteMapLegend withTeam={!!shown} />

      {full && variant === 'medium' && <FrontAndAround standings={standings} teamById={teamById} viewer={viewer} steps={steps} />}
      {full && variant === 'huge' && eventId != null && (
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

      {full ? (
        <RaceTileList graph={graph} route={route} tileById={tileById} onTileClick={onTileClick} teamName={viewerTeam?.name} />
      ) : (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-text-muted hover:text-foreground flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90">▸</span> Every tile, step by step
          </summary>
          <div className="mt-3">
            <RaceTileList graph={graph} route={route} tileById={tileById} onTileClick={onTileClick} teamName={viewerTeam?.name} />
          </div>
        </details>
      )}
    </div>
  );
}

// ---- The field strip ------------------------------------------------------------------------------

/**
 * The field's buckets in the map's own words: a team that has done i steps has finished "Step i"
 * (0 = not started yet; all of them = finished).
 */
export function bucketLabel(i: number, steps: number): string {
  if (i === 0) return 'Not started';
  if (i >= steps) return 'Finished';
  return `Step ${i}`;
}

function FieldStrip({ variant, standings, steps, teamById, viewer }: { variant: 'few' | 'medium' | 'huge'; standings: RaceStanding[]; steps: number; teamById: Map<number, { id: number; name: string; color: string }>; viewer: number | null }) {
  if (!standings.length) return null;
  if (variant === 'few') {
    // One track, Start to Finish, each team a marker at its step (stacked where they share one).
    const at = new Map<number, RaceStanding[]>();
    for (const st of standings) at.set(st.stepsDone, [...(at.get(st.stepsDone) ?? []), st]);
    return (
      <section aria-label="Distance to the finish">
        <h3 className="text-xs font-semibold text-text-muted mb-2">Distance to the finish</h3>
        <div className="relative mx-3 sm:mx-6" style={{ height: 22 + Math.max(1, ...[...at.values()].map((v) => v.length)) * 22 }}>
          <div className="absolute left-0 right-0 bottom-3 h-2 rounded-full bg-[#251e18]" />
          {Array.from({ length: steps + 1 }, (_, i) => (
            <span key={i} className="absolute bottom-2.5 w-px h-3 bg-[#4a3d30]" style={{ left: `${(i / steps) * 100}%` }} aria-hidden />
          ))}
          {[...at].map(([step, group]) => (
            <div key={step} className="absolute flex flex-col-reverse items-center gap-1 -translate-x-1/2" style={{ left: `${(step / steps) * 100}%`, bottom: 18 }}>
              {group.map((st) => {
                const t = teamById.get(st.teamId)!;
                return (
                  <span key={st.teamId} title={`${t.name} · ${st.stepsDone} of ${steps}`} className={cn('flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow', st.teamId === viewer && 'ring-2 ring-gold')} style={{ backgroundColor: t.color }}>
                    <span className="max-w-[84px] truncate">{t.name}</span>
                    <span className="tabular-nums opacity-90">{st.finished ? '🏁' : st.stepsDone}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-0.5"><span>Not started</span><span>Finished · {steps} steps</span></div>
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
              <div key={i} className="flex flex-col items-center gap-1 w-16">
                <div className="flex flex-col-reverse items-center gap-0.5 min-h-[20px]">
                  {col.map((s) => {
                    const t = teamById.get(s.teamId)!;
                    return <span key={s.teamId} title={t.name} className={cn('w-3 h-3 rounded-full border border-[#141010]', s.teamId === viewer && 'ring-2 ring-gold')} style={{ backgroundColor: t.color }} />;
                  })}
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap">{bucketLabel(i, steps)}</span>
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
            <div key={i} className="flex flex-col items-center justify-end gap-1 w-16 h-full">
              <span className={cn('text-[10px] tabular-nums', i === mineAt ? 'text-gold font-semibold' : 'text-text-muted')}>{col.length}{i === mineAt ? ' · you' : ''}</span>
              <div className={cn('w-6 rounded-t', i === mineAt ? 'bg-gold' : 'bg-[#4a3d30]')} style={{ height: `${Math.max(2, (col.length / max) * 72)}px` }} />
              <span className="text-[10px] text-text-muted whitespace-nowrap">{bucketLabel(i, steps)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Up next / pick your road ---------------------------------------------------------------------

export function NextCards({ graph, route, tileById, onTileClick, canPick, picking, onPick, error }: {
  graph: RaceGraph; route: TeamRoute; tileById: Map<number, { id: number; label: string; icon?: string | null }>;
  onTileClick?: (id: number) => void; canPick: boolean; picking: boolean; onPick: (id: number) => void; error: string | null;
}) {
  const choosing = route.pickFrom.length > 0;
  // "Roads stay open": the next step's tiles first, then the ones at earlier forks.
  const front = frontOpen(graph, route);
  const ids = choosing ? route.pickFrom : [...front, ...route.open.filter((id) => !front.includes(id))];
  return (
    <section aria-label={choosing ? 'Pick your road' : 'Up next'}>
      <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />{choosing ? 'Pick your road' : 'Up next'}</h3>
      <p className="text-xs text-text-muted mt-1 mb-2">
        {choosing
          ? canPick
            ? 'A fork: pick the tile your team goes for. Only the picked tile counts, and the pick can’t be changed.'
            : 'A fork: your team’s captain picks the road before any tile here counts.'
          : route.roadsOpen
            ? `${ROADS_OPEN_NOTE} Every road your team opens stays open; the furthest one sets your place.`
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
                  {t?.icon ? <img src={t.icon} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} /> : <span className="text-[10px] text-text-muted">{tileInitials(t?.label ?? '')}</span>}
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
