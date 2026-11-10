'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
 * The map scrolls sideways inside its own box; the page never does. On a phone (under 640px) it
 * becomes a vertical list of steps instead, each road a row with its letter, so five roads and ten
 * steps read top to bottom with no sideways scroll at all.
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
  /** Tiles locked in a way that matters to the viewer (a fork waiting for the team's pick): padlocked. */
  lockedIds?: Set<number>;
  /** The viewer team's own marker: on the tile it stands on, or "Not started" by the start. */
  youTileId?: number | null;
  youNotStarted?: boolean;
  /** Scale the map up to the width of its box (up to 1.75×) — the fullscreen overlay. */
  fit?: boolean;
  /** Under 640px, a list of steps (each road a row) instead of the sideways map. Off in the editor. */
  mobileList?: boolean;
  /** Scale a long map DOWN to the width of its box (to half size at most), so it reads without a
   *  sideways scroll. The editor uses it; past half size the map scrolls as before. */
  shrink?: boolean;
  /** Editor: things drawn over the map in screen pixels (the "+" between steps), placed from the
   *  map's geometry at its current scale. */
  overlay?: (geo: RouteMapGeometry) => ReactNode;
  /** Editor: clicking a road between two tiles (from → to). */
  onLinkClick?: (from: number, to: number) => void;
  /** Editor: tiles with no task written yet, drawn as dashed empty waypoints. */
  blankIds?: Set<number>;
}

/** Where things sit on the drawn map, in screen pixels (already scaled). */
export interface RouteMapGeometry {
  scale: number;
  width: number;
  height: number;
  /** The centre x of a step's column. */
  stepX: (step: number) => number;
  /** The y of the step names along the top. */
  headY: number;
  last: number;
}

const ROAD = '#251e18';
const GOLD = '#e0aa1e';
const COL = 168;
const ROW = 138;
const HEAD = 30;
const PAD_X = 70;
/** Room for the road names down the left edge, when the map has roads. */
const LANE_W = 58;
const R = 33;
const R_FINISH = 42;
/** Rows stand further apart when team pennants stack over the waypoints. */
const ROW_PENNANTS = 176;
/** Road letter badges (ground, ink), A first — the panel's colours. */
export const ROAD_INK: [string, string][] = [
  ['#7a6230', '#ffe2a0'],
  ['#2f6680', '#c4e8ff'],
  ['#6a3a80', '#f0d4ff'],
  ['#2f7046', '#c4f0cc'],
  ['#7a3434', '#ffc4c4'],
];

/** The small square road letter ("A"), in its road's colours. */
export function RoadBadge({ letter, className }: { letter: string; className?: string }) {
  const [bg, fg] = ROAD_INK[Math.max(0, letter.charCodeAt(0) - 65) % ROAD_INK.length];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center w-5 h-5 rounded text-[10px] font-bold', className)} style={{ backgroundColor: bg, color: fg }} aria-label={`Road ${letter}`}>
      {letter}
    </span>
  );
}

export function defaultStepLabel(step: number, last: number): string {
  if (step === 0) return last === 0 ? 'Start · finish' : 'Start';
  if (step === last) return 'Finish';
  return `Step ${step + 1}`;
}

/** What a node shows when its tile has no sprite: the tile's initials, never a number. */
export function tileInitials(label: string): string {
  const words = label.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** A short form of a tile name for under its node (the full name is the tooltip). */
export function shortLabel(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
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
  lockedIds,
  youTileId = null,
  youNotStarted = false,
  fit = false,
  mobileList = true,
  shrink = false,
  overlay,
  onLinkClick,
  blankIds,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const measure = fit || shrink;
  useEffect(() => {
    if (!measure || !boxRef.current) return;
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [measure]);
  const last = nodes.reduce((m, n) => Math.max(m, n.step), 0);
  const columns: RouteMapNode[][] = Array.from({ length: last + 1 }, () => []);
  for (const n of nodes) columns[n.step]?.push(n);
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  // Roads keep their row: a step with several tiles puts road A in the top row, B under it, and so
  // on, so "Road C at step 2" is the third row of column 2 — named down the left edge. A single-tile
  // step (a start, a merge, the finish) belongs to no road and sits in the middle.
  const roads = tallest > 1;
  const rowH = variant === 'few' && roads ? ROW_PENNANTS : ROW;
  const left = PAD_X + (roads ? LANE_W : 0);
  const multiStart = (columns[0]?.length ?? 0) > 1;
  const head = HEAD + (multiStart || youNotStarted ? 16 : 0);
  const height = head + tallest * rowH + 10;
  const width = left + PAD_X + last * COL;
  const rowY = (i: number) => head + i * rowH + 48;

  const pos = new Map<number, { x: number; y: number }>();
  columns.forEach((col, s) => {
    col.forEach((n, i) => pos.set(n.id, { x: left + s * COL, y: col.length === 1 ? head + ((tallest - 1) * rowH) / 2 + 48 : rowY(i) }));
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
  const room = (boxWidth - 8) / width;
  const scale = boxWidth > 0 ? (fit ? Math.min(1.75, Math.max(1, room)) : shrink ? Math.min(1, Math.max(0.5, room)) : 1) : 1;
  const scaled = scale !== 1 || !!overlay;
  const geo: RouteMapGeometry = { scale, width: width * scale, height: height * scale, stepX: (s) => (left + s * COL) * scale, headY: 14 * scale, last };

  return (
    <>
    {mobileList && (
      <RouteStepList
        className="sm:hidden"
        columns={columns}
        last={last}
        state={state}
        path={path}
        at={at}
        viewerTeamId={viewerTeamId}
        onTileClick={onTileClick}
        progress={progress}
        matched={matched}
        stepLabel={stepLabel}
        lockedIds={lockedIds}
        youTileId={youTileId}
        youNotStarted={youNotStarted}
      />
    )}
    <div ref={boxRef} className={cn('w-full overflow-x-auto overscroll-x-contain rounded-xl border border-card-border bg-[#141010] pb-2', mobileList && 'hidden sm:block')} role="group" aria-label="Race route map">
      {/* The road names stay pinned to the left edge while a long map scrolls sideways under them. */}
      {roads && (
        <div className="sticky left-0 z-20 h-0 w-0" aria-hidden>
          {Array.from({ length: tallest }, (_, i) => (
            <div key={`road${i}`} className="absolute flex items-center gap-1 rounded-r bg-[#141010]/90 py-0.5 pl-2 pr-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted/80 whitespace-nowrap" style={{ left: 0, top: (rowY(i) - 9) * scale }}>
              Road
              <RoadBadge letter={String.fromCharCode(65 + i)} className="w-4 h-4 text-[9px]" />
            </div>
          ))}
        </div>
      )}
      <div className={scaled ? 'relative' : undefined} style={scaled ? { width: width * scale, height: height * scale, margin: '0 auto' } : undefined}>
      {/* Shrunk, the map is clipped to its scaled box so the unscaled layout never adds a scrollbar. */}
      <div className={scale < 1 ? 'absolute inset-0 overflow-hidden' : undefined}>
      <div className="relative mx-auto" style={{ width, height, minWidth: width, ...(scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {}) }}>
        {columns.map((col, s) => (
          <div
            key={`h${s}`}
            className="absolute top-2 text-center"
            style={{ left: left + s * COL - COL / 2, width: COL }}
          >
            <span className="block text-[10px] uppercase tracking-wide text-text-muted font-semibold">{stepLabel(s, last)}</span>
            {s === 0 && col.length > 1 && <span className="block text-[10px] text-gold/90">pick any of these {col.length} to begin</span>}
            {s === 0 && youNotStarted && <span className="inline-block mt-0.5 rounded-full bg-gold px-1.5 text-[9px] font-bold text-brown-dark">You · not started</span>}
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
          {/* Editor: each road is clickable (the svg itself lets clicks through to the tiles). */}
          {onLinkClick &&
            links.map(({ from, to }) => (
              <path
                key={`c${from}-${to}`}
                d={curve(pos.get(from)!, pos.get(to)!)}
                fill="none"
                stroke={GOLD}
                strokeOpacity={0}
                strokeWidth={22}
                className="cursor-pointer hover:[stroke-opacity:0.35]"
                style={{ pointerEvents: 'stroke' }}
                onClick={() => onLinkClick(from, to)}
              >
                <title>Remove this road</title>
              </path>
            ))}
        </svg>

        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const finish = n.step === last && last > 0;
          const r = finish ? R_FINISH : R;
          const st = state?.get(n.id);
          const here = at.get(n.id) ?? [];
          const isSelected = selectedId === n.id;
          const blank = blankIds?.has(n.id) ?? false;
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
              {variant === 'few' && here.some((t) => t.id !== viewerTeamId) && (
                <div className="absolute bottom-full mb-1 z-10 flex flex-col-reverse items-center gap-0.5">
                  {/* The viewer's own team is the gold "You" marker on the tile, not a pennant. */}
                  {here.filter((t) => t.id !== viewerTeamId).slice(0, 3).map((t) => (
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
                  st === 'ahead' && !lockedIds?.has(n.id) && 'opacity-60',
                  st === 'closed' && 'opacity-35 grayscale',
                  isSelected && 'border-gold ring-4 ring-gold/40',
                  !isSelected && isLinkable && (linked ? 'border-gold' : 'border-dashed border-gold/50'),
                  !isSelected && problemIds?.has(n.id) && 'border-red-500',
                  blank && !isSelected && !isLinkable && !problemIds?.has(n.id) && 'border-dashed border-text-muted/40 bg-[#141010]',
                )}
                style={{ width: 2 * r, height: 2 * r, ...(heat ? { boxShadow: `0 0 ${10 + 24 * heat}px rgba(224,170,30,${heat})` } : {}) }}
              >
                {n.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.icon} alt="" className="object-contain" style={{ width: r * 1.1, height: r * 1.1, imageRendering: 'pixelated' }} loading="lazy" />
                ) : blank ? (
                  <span className="text-lg text-text-muted/60 font-bold" aria-hidden>+</span>
                ) : (
                  <span className="text-xs text-text-muted font-bold">{tileInitials(n.label)}</span>
                )}
                {st === 'done' && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold text-brown-dark flex items-center justify-center shadow">
                    <TileStateIcon kind="done" />
                  </span>
                )}
                {/* A padlock only where it means something to the viewer: a fork waiting for the
                    team's pick. Everything else not open yet is simply dimmed. */}
                {lockedIds?.has(n.id) && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brown-dark text-gold flex items-center justify-center border border-gold/50" title="Locked until your team picks its road">
                    <TileStateIcon kind="locked" />
                  </span>
                )}
                {youTileId === n.id && (
                  <span className="absolute -top-2 -left-3 rounded-full bg-gold px-1.5 text-[9px] font-bold text-brown-dark shadow ring-2 ring-[#141010]">You</span>
                )}
              </button>
              <span title={n.label} className={cn('mt-1 text-[11px] leading-tight text-center line-clamp-2 px-1', st === 'closed' ? 'text-text-muted/60' : st === 'open' || st === 'done' ? 'text-foreground' : 'text-text-muted')}>
                {shortLabel(n.label)}
              </span>
              <span className="flex items-center gap-1 mt-0.5 min-h-[14px]">
                {blank && !(isLinkable && sel) && <span className="text-[9px] italic text-text-muted/70">not written yet</span>}
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
      {overlay?.(geo)}
      </div>
    </div>
    </>
  );
}

/**
 * The route on a phone: one block per step down the page, each road's tile a row with its letter,
 * sprite, name and state (Next, done, locked, You, how many teams stand there). Steps the viewer
 * has passed carry a gold rail. Tapping a row opens the tile, like a waypoint on the map.
 */
function RouteStepList({
  className,
  columns,
  last,
  state,
  path,
  at,
  viewerTeamId,
  onTileClick,
  progress,
  matched,
  stepLabel,
  lockedIds,
  youTileId,
  youNotStarted,
}: {
  className?: string;
  columns: RouteMapNode[][];
  last: number;
  state?: Map<number, RaceTileState>;
  path: number[];
  at: Map<number, RouteMapTeam[]>;
  viewerTeamId: number | null;
  onTileClick?: (id: number) => void;
  progress?: Map<number, string>;
  matched?: Set<number> | null;
  stepLabel: (step: number, last: number) => string;
  lockedIds?: Set<number>;
  youTileId: number | null;
  youNotStarted: boolean;
}) {
  return (
    <ol className={cn('rounded-xl border border-card-border bg-[#141010] p-3 space-y-3', className)} aria-label="Race route, step by step">
      {columns.map((col, s) => {
        const passed = path.length > s;
        return (
          <li key={s} className={cn('border-l-2 pl-3', passed ? 'border-gold' : 'border-[#332a22]')}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">{stepLabel(s, last)}</span>
              {col.length > 1 && <span className="text-[10px] text-text-muted/80">{s === 0 ? `pick any of ${col.length}` : `${col.length} roads`}</span>}
              {s === 0 && youNotStarted && <span className="rounded-full bg-gold px-1.5 text-[9px] font-bold text-brown-dark">You · not started</span>}
            </div>
            <div className="space-y-1.5">
              {col.map((n, i) => {
                const st = state?.get(n.id);
                const here = at.get(n.id) ?? [];
                const mine = youTileId === n.id || (viewerTeamId != null && here.some((t) => t.id === viewerTeamId));
                const line = progress?.get(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={onTileClick ? () => onTileClick(n.id) : undefined}
                    disabled={!onTileClick}
                    title={n.label}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg border bg-[#1c1714] px-2.5 py-2 text-left',
                      st === 'open' ? 'border-dashed border-gold' : st === 'done' ? 'border-gold/60' : 'border-[#332a22]',
                      st === 'ahead' && !lockedIds?.has(n.id) && 'opacity-70',
                      st === 'closed' && 'opacity-40 grayscale',
                      matched && !matched.has(n.id) && 'opacity-30',
                    )}
                  >
                    {col.length > 1 ? <RoadBadge letter={String.fromCharCode(65 + i)} /> : <span className="w-5 shrink-0" />}
                    <span className="relative w-8 h-8 shrink-0 rounded-full bg-[#141010] border border-[#332a22] flex items-center justify-center">
                      {n.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.icon} alt="" className="w-6 h-6 object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                      ) : (
                        <span className="text-[10px] text-text-muted font-bold">{tileInitials(n.label)}</span>
                      )}
                    </span>
                    <span className={cn('flex-1 min-w-0 truncate text-sm', st === 'open' || st === 'done' ? 'text-foreground' : 'text-text-muted')}>{n.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {line && st !== 'done' && <span className="text-[10px] text-gold-light tabular-nums">{line}</span>}
                      {here.length > 0 && !mine && <span className="text-[10px] text-text-muted whitespace-nowrap">{here.length} here</span>}
                      {mine && <span className="rounded-full bg-gold px-1.5 text-[9px] font-bold text-brown-dark">You</span>}
                      {st === 'open' && <span className="text-[9px] font-bold px-1.5 rounded bg-gold text-brown-dark">Next</span>}
                      {st === 'done' && <span className="w-4 h-4 rounded-full bg-gold text-brown-dark flex items-center justify-center"><TileStateIcon kind="done" /></span>}
                      {(lockedIds?.has(n.id) || st === 'ahead' || st === 'closed') && <span className="text-text-muted/80"><TileStateIcon kind="locked" /></span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
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
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-full border-2 border-[#332a22] opacity-50" />Dimmed — not open yet, or not on your road</span>
          <span className="flex items-center gap-1.5"><span className="rounded-full bg-gold px-1.5 text-[9px] font-bold text-brown-dark">You</span>Where your team is</span>
        </>
      )}
      <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-2.5 rounded-full" style={{ backgroundColor: ROAD, outline: '1px solid #332a22' }} />Road — where roads meet you can switch lanes</span>
    </div>
  );
}
