'use client';

import { useState, useEffect } from 'react';
import ManualOnlyBadge from './ManualOnlyBadge';
import { isManualOnlyDropTile } from '@/lib/clogManual';

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
}

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
}: LeaguesBoardProps) {
  const sorted = [...tiles]
    .filter((t) => (matchedTileIds ? matchedTileIds.has(t.id) : true))
    .sort((a, b) => a.position - b.position);
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
      {visible.map((tile) => {
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

        return (
          <div key={tile.id} className={done ? 'bg-accent-green/5' : ''}>
            <div className="flex items-center gap-3 px-3 py-2.5">
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
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-3 w-full py-2.5 text-sm font-medium text-gold border border-gold/30 rounded-lg bg-gold/5 hover:bg-gold/10 transition-colors"
        >
          Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
        </button>
      )}
    </div>
  );
}
