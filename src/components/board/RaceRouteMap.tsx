'use client';

import { cn } from '@/lib/utils';
import type { RaceTileState } from '@/lib/raceRoutes';

/**
 * A tile race's route drawn as a map (lib/raceRoutes): steps left to right, tiles as cards, links
 * as curves. Used by the race board (with a team's path lit up) and by the route editor (with a
 * selected tile and its candidate links). The map scrolls sideways inside its own box, so a long
 * race never pushes the page wider than the phone.
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

interface Props {
  nodes: RouteMapNode[];
  /** The viewer team's state per tile; omitted = a neutral map. */
  state?: Map<number, RaceTileState>;
  /** The viewer team's committed path (one tile per step), for lighting links. */
  path?: number[];
  /** The colour the viewer team's path is drawn in. */
  pathColor?: string;
  /** Team tokens parked on a tile (each team's furthest tile). */
  tokens?: Map<number, RouteMapTeam[]>;
  onTileClick?: (id: number) => void;
  /** Editor: the tile being linked from, and tiles with a problem. */
  selectedId?: number | null;
  problemIds?: Set<number>;
  /** Editor: the tiles that can be linked to/from the selected tile (adjacent steps). */
  linkable?: Set<number>;
  /** Live progress line under a tile ("3/5"). */
  progress?: Map<number, string>;
  /** Search dimming. */
  matched?: Set<number> | null;
  stepLabel?: (step: number, last: number) => string;
}

const W = 136;
const H = 66;
const COL_GAP = 52;
const ROW_GAP = 14;
const HEAD = 22;

export function defaultStepLabel(step: number, last: number): string {
  if (step === 0) return last === 0 ? 'Start · Finish' : 'Start';
  if (step === last) return 'Finish';
  return `Step ${step + 1}`;
}

export default function RaceRouteMap({
  nodes,
  state,
  path = [],
  pathColor = '#d4af37',
  tokens,
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
  const height = HEAD + tallest * H + (tallest - 1) * ROW_GAP;
  const width = (last + 1) * W + last * COL_GAP;

  const pos = new Map<number, { x: number; y: number }>();
  columns.forEach((col, s) => {
    const colH = col.length * H + Math.max(0, col.length - 1) * ROW_GAP;
    const top = HEAD + (height - HEAD - colH) / 2;
    col.forEach((n, i) => pos.set(n.id, { x: s * (W + COL_GAP), y: top + i * (H + ROW_GAP) }));
  });
  const incoming = new Map<number, number>();
  for (const n of nodes) for (const to of n.next) incoming.set(to, (incoming.get(to) ?? 0) + 1);

  const onPath = new Set<string>();
  for (let i = 0; i + 1 < path.length; i++) onPath.add(`${path[i]}-${path[i + 1]}`);
  const current = path[path.length - 1];

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain pb-2" role="group" aria-label="Race route map">
      <div className="relative mx-auto" style={{ width, height, minWidth: width }}>
        {columns.map((_, s) => (
          <div
            key={`h${s}`}
            className="absolute top-0 text-[10px] uppercase tracking-wide text-text-muted/70 text-center font-semibold"
            style={{ left: s * (W + COL_GAP), width: W }}
          >
            {stepLabel(s, last)}
          </div>
        ))}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden>
          {nodes.flatMap((n) =>
            n.next.map((to) => {
              const a = pos.get(n.id);
              const b = pos.get(to);
              if (!a || !b) return null;
              const x1 = a.x + W;
              const y1 = a.y + H / 2;
              const x2 = b.x;
              const y2 = b.y + H / 2;
              const mid = (x1 + x2) / 2;
              const lit = onPath.has(`${n.id}-${to}`);
              const choice = state && n.id === current && state.get(to) === 'open';
              const closed = state && (state.get(n.id) === 'closed' || state.get(to) === 'closed');
              const editing = selectedId != null && (n.id === selectedId || to === selectedId);
              return (
                <path
                  key={`${n.id}-${to}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={lit ? pathColor : choice || editing ? '#d4af37' : 'currentColor'}
                  strokeWidth={lit ? 3 : choice || editing ? 2.25 : 1.5}
                  strokeDasharray={choice ? '6 4' : undefined}
                  className={cn(!lit && !choice && !editing && 'text-text-muted', closed && 'opacity-20', !lit && !choice && !editing && !closed && 'opacity-50')}
                />
              );
            }),
          )}
        </svg>
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const st = state?.get(n.id);
          const ins = incoming.get(n.id) ?? 0;
          const outs = n.next.length;
          const shape = ins > 1 && outs > 1 ? 'Junction' : outs > 1 ? 'Split' : ins > 1 ? 'Merge' : null;
          const parked = tokens?.get(n.id) ?? [];
          const isSelected = selectedId === n.id;
          const isLinkable = linkable?.has(n.id) ?? false;
          const linked = selectedId != null && (n.next.includes(selectedId) || (nodes.find((x) => x.id === selectedId)?.next.includes(n.id) ?? false));
          const line = progress?.get(n.id);
          return (
            <button
              key={n.id}
              type="button"
              onClick={onTileClick ? () => onTileClick(n.id) : undefined}
              disabled={!onTileClick}
              title={n.label}
              className={cn(
                'absolute rounded-lg border-2 text-left px-2 py-1.5 flex flex-col justify-between overflow-hidden transition-colors',
                'bg-tile-bg border-tile-border',
                st === 'done' && 'border-transparent',
                st === 'open' && 'bg-gold/15 border-gold shadow-[0_0_14px_rgba(212,175,55,0.45)]',
                st === 'ahead' && 'opacity-70',
                st === 'closed' && 'opacity-30 grayscale',
                isSelected && 'border-gold ring-2 ring-gold/60',
                !isSelected && isLinkable && (linked ? 'border-gold/80' : 'border-dashed border-gold/40'),
                problemIds?.has(n.id) && !isSelected && 'border-red-500/70',
                matched && !matched.has(n.id) && 'opacity-30',
                onTileClick ? 'cursor-pointer hover:border-gold/60' : 'cursor-default',
              )}
              style={{
                left: p.x,
                top: p.y,
                width: W,
                height: H,
                ...(st === 'done' ? { backgroundColor: `${pathColor}22`, borderColor: pathColor } : {}),
              }}
            >
              <span className="flex items-start gap-1.5 min-w-0">
                {n.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.icon} alt="" className="w-5 h-5 object-contain shrink-0" loading="lazy" />
                )}
                <span className={cn('text-[11px] leading-tight font-medium line-clamp-2', st === 'done' || st === 'open' ? 'text-foreground' : 'text-text-muted')}>
                  {n.label}
                </span>
              </span>
              <span className="flex items-center gap-1 min-w-0">
                {st === 'open' && <span className="text-[9px] font-bold uppercase tracking-wide px-1 rounded bg-gold text-brown-dark">Next</span>}
                {st === 'done' && <span className="text-[10px] font-bold" style={{ color: pathColor }}>✓</span>}
                {st === 'ahead' && <span className="text-[9px] text-text-muted/70">🔒</span>}
                {st === 'closed' && <span className="text-[9px] text-text-muted/70">Closed</span>}
                {isLinkable && selectedId != null && <span className="text-[9px] text-gold">{linked ? 'Linked · click to unlink' : '+ Link'}</span>}
                {line && st !== 'done' && <span className="text-[9px] text-yellow-400 tabular-nums">{line}</span>}
                {shape && !isLinkable && (
                  <span className="ml-auto text-[9px] text-gold/80" title={`${ins} way${ins === 1 ? '' : 's'} in, ${outs} way${outs === 1 ? '' : 's'} out`}>
                    ⇄ {shape}
                  </span>
                )}
                {parked.length > 0 && (
                  <span className="ml-auto flex -space-x-1">
                    {parked.map((t) => (
                      <span key={t.id} className="w-3 h-3 rounded-full border border-brown-dark" style={{ backgroundColor: t.color }} title={t.name} />
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
