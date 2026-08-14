'use client';

import { useEffect, useState } from 'react';
import { decayedPoints, decayProgress, type EventRules } from '@/lib/eventRules';
import { formatNumber } from '@/lib/utils';

/**
 * The board for an event where tasks OPEN and CLOSE while you watch — a ladder's mission drops, a
 * lucky draw, a bounty rotation, a scheduled showdown.
 *
 * These boards were rendering as a bingo: a searchable, filterable grid of everything, sorted by
 * nothing in particular. That's the wrong shape for a pool where two things are open right now, one
 * of them is losing value every second, and the next drop is in eleven minutes. A filter row is
 * furniture when there are three tiles; the clock is the content.
 *
 * So: the countdown to the next drop leads, what's open right now sits under it at full size with
 * its live value ticking, and everything else is out of the way. The value shown is computed with
 * the same function that awards points on completion (lib/eventRules.decayedPoints) — a board that
 * advertised a number the completion wouldn't pay would be worse than showing nothing.
 */

interface OpenTile {
  id: number;
  label: string;
  points?: number | null;
  revealedAt?: string | null;
  closedAt?: string | null;
  icon?: string | null;
}

/** Ticks once a second so decaying values and countdowns move on their own. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** "4h 12m" / "11:04" / "now" — coarse far out, precise when it's close enough to matter. */
function untilLabel(targetIso: string, nowMs: number): string {
  const ms = Date.parse(targetIso) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours >= 1) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function LiveDropBoard({
  tiles,
  rules,
  nextRevealAt,
  hiddenCount,
  pointsMode,
  completedTileIds,
  onTileClick,
  noun = 'task',
}: {
  /** Every tile on the board — this splits them into open / claimed / still to come itself. */
  tiles: OpenTile[];
  rules: EventRules;
  /** When the next batch drops, or null on a bounty (it draws on a claim, not a clock). */
  nextRevealAt?: string | null;
  hiddenCount: number;
  pointsMode: boolean;
  completedTileIds: Set<number>;
  onTileClick?: (tileId: number) => void;
  noun?: string;
}) {
  const open = tiles.filter((t) => t.revealedAt && !t.closedAt);
  const closed = tiles.filter((t) => t.closedAt);
  // Only tick while something on screen actually moves — a board with no decay and no countdown has
  // nothing to animate, and a needless interval is a needless render every second.
  const ticking = !!nextRevealAt || (!!rules.decay && open.length > 0);
  const now = useNow(ticking);

  return (
    <div className="space-y-5">
      {/* The clock is the headline. On a bounty there is no clock — the next task is drawn when
          this one is claimed — so it says that instead of showing a dash. */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card-bg to-card-bg p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80 mb-1">
              Next drop
            </p>
            {nextRevealAt ? (
              <p
                className="font-mono text-4xl sm:text-5xl font-bold leading-none text-foreground tabular-nums"
                suppressHydrationWarning
              >
                {untilLabel(nextRevealAt, now)}
              </p>
            ) : (
              <p className="text-2xl font-bold leading-none text-foreground">
                {rules.revealPolicy === 'bounty' ? 'When this one is claimed' : 'Nothing scheduled'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-1">Open now</p>
              <p className="text-2xl font-bold leading-none text-accent-green-light">{open.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-1">In the pool</p>
              <p className="text-2xl font-bold leading-none text-text-muted">{hiddenCount}</p>
            </div>
            {closed.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-1">Done</p>
                <p className="text-2xl font-bold leading-none text-text-muted">{closed.length}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What you can actually go and do, at full size. */}
      {open.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2.5 flex items-center gap-2">
            <span className="w-1 h-4 bg-accent-green rounded-full" />
            Open now
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {open.map((t) => {
              const live = pointsMode ? decayedPoints(t.points, t.revealedAt, rules.decay, now) : null;
              const face = t.points ?? 0;
              const ramp = decayProgress(t.revealedAt, rules.decay, now);
              const growing = !!rules.decay && rules.decay.targetPct > 100;
              const moved = live !== null && live !== face;
              const done = completedTileIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={onTileClick ? () => onTileClick(t.id) : undefined}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    done
                      ? 'border-accent-green/40 bg-accent-green/10'
                      : 'border-card-border bg-card-bg hover:border-gold/50 hover:bg-card-bg-hover'
                  } ${onTileClick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start gap-3">
                    {t.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.icon} alt="" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold leading-snug ${done ? 'text-accent-green-light' : 'text-foreground'}`}>
                        {t.label}
                        {done && <span className="ml-2 text-xs">✓ done</span>}
                      </p>
                      {pointsMode && (
                        <p className="mt-1 flex items-baseline gap-2">
                          <span
                            className={`font-mono text-2xl font-bold tabular-nums ${
                              moved ? (growing ? 'text-accent-green-light' : 'text-amber-300') : 'text-gold'
                            }`}
                            suppressHydrationWarning
                          >
                            {formatNumber(live ?? face)}
                          </span>
                          <span className="text-xs text-text-muted">pts</span>
                          {moved && (
                            <span className={`text-[11px] ${growing ? 'text-accent-green-light/80' : 'text-amber-300/80'}`}>
                              {growing ? '↑ rising' : '↓ falling'} from {formatNumber(face)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* How far through its ramp — the reason the number above is moving. */}
                  {rules.decay && ramp > 0 && (
                    <div className="mt-3 h-1 rounded-full bg-brown-dark overflow-hidden">
                      <div
                        className={`h-full rounded-full ${growing ? 'bg-accent-green/70' : 'bg-amber-400/70'}`}
                        style={{ width: `${Math.round(ramp * 100)}%` }}
                        suppressHydrationWarning
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open.length === 0 && (
        <div className="rounded-xl border border-dashed border-card-border px-4 py-8 text-center text-sm text-text-muted">
          {hiddenCount > 0
            ? `Nothing open right now — the next ${noun} drops on the clock above.`
            : `Every ${noun} has been played.`}
        </div>
      )}

      {/* Already gone. Kept visible but quiet: it's the record of what happened, not what to do. */}
      {closed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none list-none text-xs text-text-muted hover:text-foreground flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90">▸</span>
            {closed.length} closed
          </summary>
          <ul className="mt-2 space-y-1">
            {closed.map((t) => (
              <li key={t.id} className="text-xs text-text-muted flex items-center gap-2">
                <span className="truncate">{t.label}</span>
                {completedTileIds.has(t.id) && <span className="text-accent-green-light shrink-0">claimed</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
