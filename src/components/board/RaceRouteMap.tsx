'use client';

import { cn } from '@/lib/utils';
import type { RaceTileState } from '@/lib/raceRoutes';
import { TileStateIcon } from './TileState';

/**
 * A tile race's route drawn as a map of ROADS (lib/raceRoutes): steps left to right, lanes as thick
 * dark roads curving between steps, tiles as round waypoints with their item inside. With a team in
 * view its road so far is lit gold, the roads open next flow toward their waypoints (dashed ring +
 * glow), closed waypoints fade with a padlock and done ones carry a check. The crowd variants add
 * team pennants and lines (a few teams), crowd chips and road traffic (a field), or a heat glow
 * (solo-sized). Used by the route editor too, with a selected waypoint and its candidate links.
 * The map scrolls sideways inside its own box; the page never does.
 */

export interface RouteMapNode {
  id: number;
  step: number;
  label: string;
  icon?: string | null;
  next: number[];
}

export interface RouteMapTeam {
  id: number;
  name: string;
  color: string;
}

export type RouteMapVariant = 'few' | 'medium' | 'huge' | 'plain';

interface Props {
  nodes: RouteMapNode[];
  /** The viewer team's state per tile; omitted = a neutral map. */
  state?: Map<number, RaceTileState>;
  /** The viewer team's committed path (one tile per step). */
  path?: number[];
  variant?: RouteMapVariant;
  /** Every team on the board, with its path (for pennants, lines, crowds and traffic). */
  teams?: (RouteMapTeam & { path: number[] })[];
  viewerTeamId?: number | null;
  onTileClick?: (id: number) => void;
  /** Editor: the tile being linked from, tiles with a problem, tiles that can be linked to it. */
  selectedId?: number | null;
  problemIds?: Set<number>;
  linkable?: Set<number>;
  /** Live progress line under a tile ("3/5"). */
  progress?: Map<number, string>;
  matched?: Set<number> | null;
  stepLabel?: (step: number, last: number) => string;
}

const ROAD = '#251e18';
const GOLD = '#e0aa1e';
const COL = 168;
const ROW = 138;
const HEAD = 30;
const PAD_X = 70;
const R = 33;
const R_FINISH = 42;

export function defaultStepLabel(step: number, last: number): string {
  if (step === 0) return last === 0 ? 'Start · finish' : 'Start';
  if (step === last) return 'Finish';
  return `Tile ${step + 1}`;
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, dy = 0): string {
  const mid = (a.x + b.x) / 2;
  return `M${a.x},${a.y + dy} C${mid},${a.y + dy} ${mid},${b.y + dy} ${b.x},${b.y + dy}`;
}

export default function RaceRouteMap({
  nodes,
  state,
  path = [],
  variant = 'plain',
  teams = [],
  viewerTeamId = null,
  onTileClick,
  selectedId = null,
  problemIds,
  linkable,
  progress,
  matched,
  stepLabel = defaultStepLabel,
}: Props) {
  const last = nodes.reduce((m, n) => Math.max(m, n.step), 0);
  const columns: RouteMapNode[][] = Array.from({ length: last + 1 }, () => []);
  for (const n of nodes) columns[n.step]?.push(n);
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const height = HEAD + tallest * ROW + 10;
  const width = PAD_X * 2 + last * COL;

  const pos = new Map<number, { x: number; y: number }>();
  columns.forEach((col, s) => {
    const top = HEAD + ((tallest - col.length) * ROW) / 2;
    col.forEach((n, i) => pos.set(n.id, { x: PAD_X + s * COL, y: top + i * ROW + 48 }));
  });

  // Crowd: each team's current tile, and how many teams travelled each link.
  const at = new Map<number, (RouteMapTeam & { path: number[] })[]>();
  const traffic = new Map<string, number>();
  for (const t of teams) {
    const cur = t.path[t.path.length - 1];
    if (cur != null) at.set(cur, [...(at.get(cur) ?? []), t]);
    for (let i = 0; i + 1 < t.path.length; i++) {
      const k = `${t.path[i]}-${t.path[i + 1]}`;
      traffic.set(k, (traffic.get(k) ?? 0) + 1);
    }
  }
  const maxTraffic = Math.max(1, ...traffic.values());
  const maxAt = Math.max(1, ...[...at.values()].map((v) => v.length));

  const onPath = new Set<string>();
  for (let i = 0; i + 1 < path.length; i++) onPath.add(`${path[i]}-${path[i + 1]}`);
  const current = path[path.length - 1];
  const openIds = state ? nodes.filter((n) => state.get(n.id) === 'open').map((n) => n.id) : [];
  const links = nodes.flatMap((n) => n.next.filter((to) => pos.has(to)).map((to) => ({ from: n.id, to })));

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain rounded-xl border border-card-border bg-[#141010] pb-2" role="group" aria-label="Race route map">
      <div className="relative mx-auto" style={{ width, height, minWidth: width }}>
        {columns.map((_, s) => (
          <div
            key={`h${s}`}
            className="absolute top-2 text-[10px] uppercase tracking-wide text-text-muted text-center font-semibold"
            style={{ left: PAD_X + s * COL - COL / 2, width: COL }}
          >
            {stepLabel(s, last)}
          </div>
        ))}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden>
          {links.map(({ from, to }) => (
            <path key={`r${from}-${to}`} d={curve(pos.get(from)!, pos.get(to)!)} fill="none" stroke={ROAD} strokeWidth={22} strokeLinecap="round"
              opacity={state && (state.get(from) === 'closed' || state.get(to) === 'closed') ? 0.55 : 1} />
          ))}
          {(variant === 'medium' || variant === 'huge') &&
            links.map(({ from, to }) => {
              const n = traffic.get(`${from}-${to}`) ?? 0;
              return n ? (
                <path key={`t${from}-${to}`} d={curve(pos.get(from)!, pos.get(to)!)} fill="none" stroke={GOLD} strokeOpacity={0.28} strokeLinecap="round" strokeWidth={4 + 14 * (n / maxTraffic)} />
              ) : null;
            })}
          {variant === 'few' &&
            teams.map((t, i) =>
              t.path.slice(1).map((to, j) => (
                <path key={`l${t.id}-${j}`} d={curve(pos.get(t.path[j])!, pos.get(to)!, (i - (teams.length - 1) / 2) * 4)} fill="none" stroke={t.color} strokeWidth={2.5} strokeLinecap="round" opacity={t.id === viewerTeamId ? 0 : 0.9} />
              )),
            )}
          {links.filter(({ from, to }) => onPath.has(`${from}-${to}`)).map(({ from, to }) => (
            <path key={`p${from}-${to}`} d={curve(pos.get(from)!, pos.get(to)!)} fill="none" stroke={GOLD} strokeWidth={10} strokeLinecap="round" />
          ))}
          {current != null &&
            openIds.map((to) =>
              pos.has(current) ? (
                <path key={`o${to}`} d={curve(pos.get(current)!, pos.get(to)!)} fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" className="race-road-flow" />
              ) : null,
            )}
          {selectedId != null &&
            links.filter(({ from, to }) => from === selectedId || to === selectedId).map(({ from, to }) => (
              <path key={`e${from}-${to}`} d={curve(pos.get(from)!, pos.get(to)!)} fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
            ))}
        </svg>

        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const finish = n.step === last && last > 0;
          const r = finish ? R_FINISH : R;
          const st = state?.get(n.id);
          const here = at.get(n.id) ?? [];
          const isSelected = selectedId === n.id;
          const isLinkable = linkable?.has(n.id) ?? false;
          const sel = selectedId != null ? nodes.find((x) => x.id === selectedId) : undefined;
          const linked = sel != null && (n.next.includes(sel.id) || sel.next.includes(n.id));
          const line = progress?.get(n.id);
          const mineHere = viewerTeamId != null && here.some((t) => t.id === viewerTeamId);
          const heat = variant === 'huge' && here.length ? 0.25 + 0.6 * (here.length / maxAt) : 0;
          return (
            <div
              key={n.id}
              className={cn('absolute flex flex-col items-center', matched && !matched.has(n.id) && 'opacity-30')}
              style={{ left: p.x - 64, top: p.y - r, width: 128 }}
            >
              {variant === 'few' && here.length > 0 && (
                <div className="absolute flex flex-col items-center gap-0.5" style={{ bottom: 2 * r + 4 }}>
                  {here.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-sm max-w-[120px] truncate text-white shadow', t.id === viewerTeamId && 'ring-1 ring-gold')} style={{ backgroundColor: t.color }}>
                      ⚑ {t.name}
                    </span>
                  ))}
                  {here.length > 3 && <span className="text-[9px] text-text-muted">+{here.length - 3} more</span>}
                </div>
              )}
              <button
                type="button"
                onClick={onTileClick ? () => onTileClick(n.id) : undefined}
                disabled={!onTileClick}
                title={n.label}
                aria-label={`${n.label}${st ? ` — ${st === 'open' ? 'next' : st === 'ahead' ? 'locked' : st}` : ''}`}
                className={cn(
                  'relative rounded-full flex items-center justify-center bg-[#1c1714] border-[3px] border-[#332a22] transition-transform',
                  onTileClick && 'hover:scale-105 cursor-pointer',
                  !onTileClick && 'cursor-default',
                  st === 'done' && 'border-gold',
                  st === 'open' && 'border-dashed border-gold shadow-[0_0_18px_rgba(224,170,30,0.55)]',
                  st === 'ahead' && 'opacity-80',
                  st === 'closed' && 'opacity-35 grayscale',
                  isSelected && 'border-gold ring-4 ring-gold/40',
                  !isSelected && isLinkable && (linked ? 'border-gold' : 'border-dashed border-gold/50'),
                  !isSelected && problemIds?.has(n.id) && 'border-red-500',
                )}
                style={{ width: 2 * r, height: 2 * r, ...(heat ? { boxShadow: `0 0 ${10 + 24 * heat}px rgba(224,170,30,${heat})` } : {}) }}
              >
                {n.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.icon} alt="" className="object-contain" style={{ width: r * 1.1, height: r * 1.1, imageRendering: 'pixelated' }} loading="lazy" />
                ) : (
                  <span className="text-xs text-text-muted font-bold">{n.step + 1}</span>
                )}
                {st === 'done' && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold text-brown-dark flex items-center justify-center shadow">
                    <TileStateIcon kind="done" />
                  </span>
                )}
                {(st === 'closed' || st === 'ahead') && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brown-dark text-text-muted flex items-center justify-center border border-card-border">
                    <TileStateIcon kind="locked" />
                  </span>
                )}
              </button>
              <span className={cn('mt-1 text-[11px] leading-tight text-center line-clamp-2 px-1', st === 'closed' ? 'text-text-muted/60' : st === 'open' || st === 'done' ? 'text-foreground' : 'text-text-muted')}>
                {n.label}
              </span>
              <span className="flex items-center gap-1 mt-0.5 min-h-[14px]">
                {st === 'open' && <span className="text-[9px] font-bold px-1.5 rounded bg-gold text-brown-dark">Next</span>}
                {isLinkable && sel && <span className="text-[9px] text-gold">{linked ? 'Linked · click to unlink' : '+ Link'}</span>}
                {line && st !== 'done' && <span className="text-[9px] text-gold-light tabular-nums">{line}</span>}
                {variant === 'medium' && here.length > 0 && (
                  <span className={cn('flex items-center gap-1 text-[9px] px-1 rounded bg-brown-dark/80 text-text-muted', mineHere && 'ring-1 ring-gold text-gold')}>
                    <span className="flex -space-x-1">
                      {here.slice(0, 3).map((t) => <span key={t.id} className="w-2.5 h-2.5 rounded-full border border-brown-dark" style={{ backgroundColor: t.color }} />)}
                    </span>
                    {here.length} team{here.length === 1 ? '' : 's'}
                  </span>
                )}
                {variant === 'huge' && here.length > 0 && (
                  <span className={cn('text-[9px] px-1 rounded bg-brown-dark/80', mineHere ? 'text-gold ring-1 ring-gold' : 'text-text-muted')}>
                    {mineHere ? (here.length > 1 ? `You + ${here.length - 1} other${here.length === 2 ? '' : 's'}` : 'You') : `${here.length} here`}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The map's key, under the map. */
export function RouteMapLegend({ withTeam }: { withTeam: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted items-center">
      {withTeam && (
        <>
          <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />Your road so far</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-full border-2 border-dashed border-gold shadow-[0_0_8px_rgba(224,170,30,0.6)]" />Open next</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-full border-2 border-gold" />Done</span>
          <span className="flex items-center gap-1.5 opacity-60"><TileStateIcon kind="locked" />Locked — not open, or not on your road</span>
        </>
      )}
      <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-2.5 rounded-full" style={{ backgroundColor: ROAD, outline: '1px solid #332a22' }} />Road — where roads meet you can switch lanes</span>
    </div>
  );
}
