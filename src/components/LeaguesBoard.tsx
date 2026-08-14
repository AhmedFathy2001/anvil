'use client';

import { useState, useEffect, useRef } from 'react';
import ManualOnlyBadge from './ManualOnlyBadge';
import { isManualOnlyDropTile } from '@/lib/clogManual';
import { tileTierKey, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import type { TileStatus } from './BoardStatusTabs';

interface Tile {
  id: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statGoal?: number | null;
  statType?: string | null;
  optional?: number | null;
  points?: number | null;
}

interface Completion {
  teamId: number;
  tileId: number;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface LeaguesBoardProps {
  tiles: Tile[];
  completions: Completion[];
  teams: Team[];
  activeTeamId?: number;
  interactive?: boolean;
  onTileClick?: (tileId: number) => void;
  dropProgress?: Map<number, { current: number; required: number }>;
  statProgress?: Map<number, { current: number; goal: number; statType?: string }>;
  expanded?: boolean;
  matchedTileIds?: Set<number> | null;
  /** Per-tile status — when present the list sorts incomplete-first (like the plugin). */
  statusById?: Map<number, TileStatus>;
  /** Tiles only THIS viewer (staff) can see — members get a board without them. */
  staffOnlyTileIds?: Set<number> | null;
  /** Difficulty bands (admin-configured). A long board groups under them instead of running flat. */
  tierBands?: TierBand[];
}

// Plugin parity: in-progress first, then not-started, then completed. Within a status group the
// board's own position order (difficulty / shuffle) is preserved.
const STATUS_ORDER: Record<TileStatus, number> = { in_progress: 0, not_started: 1, completed: 2 };

/**
 * Leagues-style board: a vertical task list (icon · title · points · progress · completion),
 * mirroring the in-game collection-log accordion. No grid — works for any tile count.
 */
export default function LeaguesBoard({
  tiles,
  completions,
  teams,
  activeTeamId,
  interactive,
  onTileClick,
  dropProgress,
  statProgress,
  expanded: wide,
  matchedTileIds,
  statusById,
  staffOnlyTileIds,
  tierBands = DEFAULT_TIER_BANDS,
}: LeaguesBoardProps) {
  const visibleTiles = [...tiles].filter((t) => (matchedTileIds ? matchedTileIds.has(t.id) : true));

  // A 200-task board is a document, not a list: without a spine you scroll it looking for where the
  // 250-pointers start. Long boards group under their difficulty band (hardest first — that's where
  // the event is decided); short ones keep the plugin's incomplete-first order exactly as it was.
  const bandOrder = [...tierBands].sort((a, b) => b.min - a.min);
  const bandIndex = new Map(bandOrder.map((b, i) => [b.key, i]));
  const grouped = visibleTiles.length > 40 && bandOrder.length > 1;

  const sorted = visibleTiles.sort((a, b) => {
    if (grouped) {
      const ta = bandIndex.get(tileTierKey(a.points, tierBands) ?? '') ?? 99;
      const tb = bandIndex.get(tileTierKey(b.points, tierBands) ?? '') ?? 99;
      if (ta !== tb) return ta - tb;
    }
    const sa = statusById ? STATUS_ORDER[statusById.get(a.id) ?? 'not_started'] : 0;
    const sb = statusById ? STATUS_ORDER[statusById.get(b.id) ?? 'not_started'] : 0;
    return sa - sb || a.position - b.position;
  });

  // Per-band totals for the headers — counted over the WHOLE board, not just the page in view, so
  // "12 of 30 done" doesn't change as you scroll.
  const bandStats = new Map<string, { done: number; total: number; points: number }>();
  for (const t of tiles) {
    const key = tileTierKey(t.points, tierBands) ?? '';
    const row = bandStats.get(key) ?? { done: 0, total: 0, points: 0 };
    row.total++;
    if (statusById?.get(t.id) === 'completed') row.done++;
    else row.points += t.points ?? 0;
    bandStats.set(key, row);
  }
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // A points/task board can carry 150+ tiles — render them in pages so the list isn't a wall.
  // Only long lists page (short ones render whole); reset to the first page whenever the filtered
  // set changes size so a newly-applied filter starts from the top.
  const PAGE_SIZE = 30;
  const paginated = sorted.length > 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sorted.length]);
  const visible = paginated ? sorted.slice(0, visibleCount) : sorted;
  const remaining = sorted.length - visible.length;

  // Infinite scroll: reveal the next page whenever the sentinel scrolls near the viewport, instead
  // of a "show more" click. rootMargin pre-loads ahead of the fold so scrolling stays smooth; the
  // observer re-arms each time `remaining` changes and disconnects once the list is fully shown.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!paginated || remaining <= 0) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, sorted.length));
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [paginated, remaining, sorted.length]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={`w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
      <div className="bg-brown-dark/50 rounded-xl border border-card-border divide-y divide-card-border overflow-hidden">
      {visible.map((tile, visibleIndex) => {
        const bandKey = tileTierKey(tile.points, tierBands) ?? '';
        const prevBandKey =
          visibleIndex > 0 ? tileTierKey(visible[visibleIndex - 1].points, tierBands) ?? '' : null;
        const bandHeader =
          grouped && bandKey !== prevBandKey ? bandOrder.find((b) => b.key === bandKey) ?? null : null;
        const stats = bandStats.get(bandKey);
        const tileCompletions = completions
          .filter((c) => c.tileId === tile.id)
          .filter((c) => (activeTeamId ? c.teamId === activeTeamId : true))
          .map((c) => teamMap.get(c.teamId))
          .filter((t): t is Team => !!t);
        const done = tileCompletions.length > 0;

        const prog = dropProgress?.get(tile.id);
        const stat = statProgress?.get(tile.id);
        const pct = prog
          ? Math.min(100, Math.round((prog.current / Math.max(1, prog.required)) * 100))
          : stat
            ? Math.min(100, Math.round((stat.current / Math.max(1, stat.goal)) * 100))
            : null;
        const isOpen = expanded.has(tile.id);
        // Staff see the whole board on a reveal-policy event, which made an armed board look
        // identical to a fully-revealed one. Mark what members can't see yet.
        const staffOnly = staffOnlyTileIds?.has(tile.id) ?? false;

        return (
          <div key={tile.id} className={`${done ? 'bg-accent-green/5' : ''} ${staffOnly ? 'bg-brown-dark/40' : ''}`}>
            {bandHeader && (
              <div className="sticky top-0 z-[1] flex items-center gap-2.5 border-b border-card-border bg-brown-dark/95 px-3 py-1.5 backdrop-blur">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tierColor(bandOrder.length - 1 - (bandIndex.get(bandHeader.key) ?? 0), bandOrder.length) }}
                  aria-hidden
                />
                <span className="text-xs font-bold">{bandHeader.label}</span>
                {stats && (
                  <span className="ml-auto text-[11px] text-text-muted">
                    {stats.done}/{stats.total} done
                    {stats.points > 0 && <> · {stats.points.toLocaleString()} pts left</>}
                  </span>
                )}
              </div>
            )}
            <div className={`flex items-center gap-3 px-3 py-2.5 ${staffOnly ? 'opacity-60' : ''}`}>
              {/* Icon */}
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded bg-brown-dark/60 border border-card-border">
                {tile.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tile.icon} alt="" className="max-w-7 max-h-7" />
                ) : (
                  <span className="text-text-muted text-xs">#{tile.position + 1}</span>
                )}
              </div>

              {/* Title + click target */}
              <button
                type="button"
                onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
                className={`flex-1 min-w-0 text-left transition-colors ${
                  onTileClick ? 'cursor-pointer' : 'cursor-default'
                } ${interactive ? 'hover:text-gold' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium truncate ${done ? 'text-accent-green-light' : 'text-foreground'}`}>
                    {tile.label}
                  </span>
                  {done && <span className="text-accent-green-light text-xs shrink-0">✓</span>}
                  {staffOnly && (
                    <span
                      className="shrink-0 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-gold/30 bg-gold/10 text-gold"
                      title="Not revealed yet — you can see this because you're staff. Members don't."
                    >
                      Staff only
                    </span>
                  )}
                  {isManualOnlyDropTile(tile) && <ManualOnlyBadge compact className="shrink-0" />}
                </div>
                {pct !== null && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 max-w-[180px] bg-brown-dark rounded-full overflow-hidden">
                      <div className="h-full bg-gold/80 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-text-muted">
                      {prog ? `${prog.current}/${prog.required}` : `${stat!.current.toLocaleString()}/${stat!.goal.toLocaleString()}`}
                    </span>
                  </div>
                )}
              </button>

              {/* Completion team dots */}
              {!activeTeamId && tileCompletions.length > 0 && (
                <div className="flex -space-x-1 shrink-0">
                  {tileCompletions.slice(0, 5).map((t) => (
                    <span
                      key={t.id}
                      className="w-3 h-3 rounded-full border border-brown-dark"
                      style={{ backgroundColor: t.color }}
                      title={t.name}
                    />
                  ))}
                </div>
              )}

              {/* Points */}
              {!tile.optional && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 shrink-0">
                  {tile.points ?? 1} pt{(tile.points ?? 1) !== 1 ? 's' : ''}
                </span>
              )}
              {tile.optional ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 shrink-0">Optional</span>
              ) : null}

              {/* Expand description */}
              {tile.description && (
                <button
                  type="button"
                  onClick={() => toggle(tile.id)}
                  className="text-text-muted hover:text-foreground text-sm shrink-0 w-9 h-9 -my-2 flex items-center justify-center"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? '▾' : '▸'}
                </button>
              )}
            </div>
            {isOpen && tile.description && (
              <p className="px-3 pb-2.5 -mt-1 text-xs text-text-muted leading-relaxed pl-[60px]">{tile.description}</p>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-text-muted">
          {matchedTileIds ? 'No tiles match this filter.' : 'No tiles yet.'}
        </div>
      )}
      </div>
      {paginated && remaining > 0 && (
        <div ref={sentinelRef} className="mt-3 py-3 text-center text-xs text-text-muted" aria-hidden>
          Loading more… <span className="text-text-muted/70">{remaining} left</span>
        </div>
      )}
    </div>
  );
}
