'use client';

import { formatNumber } from '@/lib/utils';
import { ordinal } from '@/lib/yourTeam';

/**
 * The gold bar that opens a board: the viewer's own team, where it stands, and the tiles worth going
 * for next. The race page has its own (the road pick lives in it); every other format uses this one.
 */

export interface YourTeamTile {
  id: number;
  label: string;
  icon?: string | null;
  /** A count in progress ("74 of 100"), when the tile has one. */
  progress?: { current: number; goal: number } | null;
  points?: number | null;
  /** One short line: what it does for a line, or who already has it. */
  note?: string | null;
}

export default function YourTeamBar({
  label,
  teamName,
  rank,
  of,
  noun,
  score,
  gap,
  heading,
  tiles,
  onTileClick,
}: {
  /** "Your team" or, on a players board, "Your board". */
  label: string;
  teamName: string;
  /** Null when standings are hidden: the place and the gap stay out. */
  rank: number | null;
  of: number;
  noun: string;
  /** "6 of 25 tiles", "22 of 58 points". */
  score: string;
  gap: string | null;
  heading: string | null;
  tiles: YourTeamTile[];
  onTileClick: (tileId: number) => void;
}) {
  return (
    <section
      aria-label={label}
      className={`mb-6 grid items-start gap-5 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 sm:p-5 ${tiles.length > 0 ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : ''}`}
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold uppercase tracking-widest text-gold">{label} · {teamName}</div>
        {rank != null && (
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold leading-none tabular-nums">{ordinal(rank)}</span>
            <span className="text-sm text-text-muted">of {of.toLocaleString()} {noun}</span>
          </div>
        )}
        <div className="mt-2 text-sm text-foreground/90 tabular-nums">{score}</div>
        {rank != null && gap && <div className="mt-0.5 text-xs text-text-muted">{gap}</div>}
      </div>
      {tiles.length > 0 && (
        <div className="min-w-0">
          {heading && <div className="mb-2 text-xs text-text-muted">{heading}</div>}
          <div className="grid gap-2 sm:grid-cols-3">
            {tiles.map((t) => {
              const pct = t.progress ? Math.min(100, Math.round((t.progress.current / t.progress.goal) * 100)) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTileClick(t.id)}
                  className="flex min-h-11 min-w-0 items-start gap-2.5 rounded-xl border border-card-border bg-card-bg p-3 text-left transition-colors hover:border-gold/50"
                >
                  {t.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.icon} alt="" className="h-7 w-7 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{t.label}</span>
                      {t.points != null && <span className="shrink-0 text-xs font-semibold text-gold">{t.points} pts</span>}
                    </span>
                    {t.progress && (
                      <>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brown-dark">
                          <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="mt-1 block text-xs tabular-nums text-text-muted">
                          {formatNumber(t.progress.current)} of {formatNumber(t.progress.goal)}
                        </span>
                      </>
                    )}
                    {t.note && <span className="mt-0.5 block text-xs text-text-muted">{t.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
