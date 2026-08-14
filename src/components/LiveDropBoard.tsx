'use client';

import { useEffect, useState } from 'react';
import { decayedPoints, decayProgress, type EventRules } from '@/lib/eventRules';
import { formatNumber } from '@/lib/utils';

/**
 * The board for an event where tasks OPEN and CLOSE while you watch — a ladder's rotating window, a
 * lucky draw, a bounty rotation, a scheduled showdown.
 *
 * These boards were rendering as a bingo: a searchable, filterable grid of everything, sorted by
 * nothing in particular. That's the wrong shape for a pool where a few things are open right now,
 * one of them is losing value every second, one is about to rotate out, and the next drop is in
 * eleven minutes. A filter row is furniture at that size; the clock is the content.
 *
 * So: the countdown to the next drop leads, what's open right now sits under it at full size with
 * its live value ticking, and the task closest to expiry is promoted to a full-width card with the
 * time it has left drawn as a ring. Every value shown is computed with the same function that
 * awards the points (lib/eventRules.decayedPoints) — a board that advertised a number the
 * completion wouldn't pay would be worse than showing nothing.
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
  expiryByTile,
  claimsByTile,
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
  /** When each open tile rotates out (lib/eventRules.rotationExpiries). Rotating boards only. */
  expiryByTile?: Record<number, string>;
  /** How many teams/players have already claimed each tile. */
  claimsByTile?: Record<number, number>;
}) {
  const open = tiles.filter((t) => t.revealedAt && !t.closedAt);
  const closed = tiles.filter((t) => t.closedAt);
  const rotating = rules.revealPolicy === 'rotating';

  // Only tick while something on screen actually moves.
  const ticking = !!nextRevealAt || (!!rules.decay && open.length > 0) || !!expiryByTile;
  const now = useNow(ticking);

  // The task closest to rotating out leads the board — it's the one with a deadline on it. Without
  // an expiry (lucky draw, showdown) the most valuable open task leads instead.
  const sorted = [...open].sort((a, b) => {
    const ea = expiryByTile?.[a.id];
    const eb = expiryByTile?.[b.id];
    if (ea && eb) return ea.localeCompare(eb);
    if (ea) return -1;
    if (eb) return 1;
    return (b.points ?? 0) - (a.points ?? 0);
  });
  const featured = sorted[0] ?? null;
  const rotatingOut = expiryByTile
    ? open.filter((t) => expiryByTile[t.id] && expiryByTile[t.id] === nextRevealAt).length
    : 0;

  function tileValue(t: OpenTile) {
    const live = pointsMode ? decayedPoints(t.points, t.revealedAt, rules.decay, now) : null;
    const face = t.points ?? 0;
    return {
      live,
      face,
      ramp: decayProgress(t.revealedAt, rules.decay, now),
      growing: !!rules.decay && rules.decay.targetPct > 100,
      moved: live !== null && live !== face,
      done: completedTileIds.has(t.id),
      claims: claimsByTile?.[t.id] ?? 0,
      expiry: expiryByTile?.[t.id] ?? null,
    };
  }

  const Value = ({ t, big }: { t: OpenTile; big?: boolean }) => {
    const v = tileValue(t);
    if (!pointsMode) return null;
    return (
      <p className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span
          className={`font-mono font-bold tabular-nums ${big ? 'text-4xl' : 'text-2xl'} ${
            v.moved ? (v.growing ? 'text-accent-green-light' : 'text-amber-300') : 'text-gold'
          }`}
          suppressHydrationWarning
        >
          {formatNumber(v.live ?? v.face)}
        </span>
        <span className="text-xs text-text-muted">pts</span>
        {v.moved && (
          <span className={`text-[11px] ${v.growing ? 'text-accent-green-light/80' : 'text-amber-300/80'}`}>
            {v.growing ? '↑ rising' : '↓ falling'} from {formatNumber(v.face)}
          </span>
        )}
      </p>
    );
  };

  const Foot = ({ t }: { t: OpenTile }) => {
    const v = tileValue(t);
    const soon = v.expiry ? Date.parse(v.expiry) - now < 60 * 60_000 : false;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11.5px] text-text-muted">
        {v.expiry ? (
          <span className={`font-mono ${soon ? 'font-bold text-amber-300' : ''}`} suppressHydrationWarning>
            rotates out in {untilLabel(v.expiry, now)}
          </span>
        ) : rotating ? (
          <span>stays until the pool rotates</span>
        ) : null}
        {v.claims > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              {v.claims} claim{v.claims === 1 ? '' : 's'}
            </span>
          </>
        )}
        {rules.firstBonus > 0 && v.claims === 0 && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] font-bold text-gold-light">
            +{rules.firstBonus} first claim
          </span>
        )}
      </div>
    );
  };

  const Ramp = ({ t }: { t: OpenTile }) => {
    const v = tileValue(t);
    if (!rules.decay || v.ramp <= 0) return null;
    return (
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-brown-dark">
        <div
          className={`h-full rounded-full ${v.growing ? 'bg-accent-green/70' : 'bg-amber-400/70'}`}
          style={{ width: `${Math.round(v.ramp * 100)}%` }}
          suppressHydrationWarning
        />
      </div>
    );
  };

  return (
    <div className="space-y-5" id="open-now">
      {/* The clock is the headline. On a bounty there is no clock — the next task is drawn when
          this one is claimed — so it says that instead of showing a dash. */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card-bg to-card-bg p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
              {rotating ? 'Next rotation' : 'Next drop'}
            </p>
            {nextRevealAt ? (
              <p
                className="font-mono text-4xl font-bold leading-none tabular-nums text-foreground sm:text-5xl"
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
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Open now</p>
              <p className="text-2xl font-bold leading-none text-accent-green-light">{open.length}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">In the pool</p>
              <p className="text-2xl font-bold leading-none text-text-muted">{hiddenCount}</p>
            </div>
            {rotatingOut > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Rotating out</p>
                <p className="text-2xl font-bold leading-none text-amber-300">{rotatingOut}</p>
              </div>
            )}
            {closed.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Done</p>
                <p className="text-2xl font-bold leading-none text-text-muted">{closed.length}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What you can actually go and do, at full size. */}
      {open.length > 0 && (
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
            <span className="h-4 w-1 rounded-full bg-accent-green" />
            Open now
          </h3>

          {featured && (() => {
            const v = tileValue(featured);
            const left = v.expiry ? Date.parse(v.expiry) - now : null;
            const total = v.expiry && featured.revealedAt ? Date.parse(v.expiry) - Date.parse(featured.revealedAt) : null;
            const pct = left !== null && total ? Math.max(0, Math.min(100, (left / total) * 100)) : null;
            return (
              <button
                type="button"
                onClick={onTileClick ? () => onTileClick(featured.id) : undefined}
                className={`mb-3 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                  v.done
                    ? 'border-accent-green/40 bg-accent-green/10'
                    : 'border-amber-400/40 bg-[radial-gradient(90%_130%_at_100%_0%,rgba(240,169,59,0.14),transparent_60%)] bg-card-bg hover:border-gold/50'
                } ${onTileClick ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    {featured.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.icon} alt="" className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-lg font-bold leading-snug ${v.done ? 'text-accent-green-light' : 'text-foreground'}`}>
                        {featured.label}
                        {v.done && <span className="ml-2 text-xs">✓ done</span>}
                      </p>
                      <Value t={featured} big />
                    </div>
                  </div>
                  <Foot t={featured} />
                  <Ramp t={featured} />
                </div>
                {pct !== null && (
                  <div
                    className="relative grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full"
                    style={{ background: `conic-gradient(#f0a93b ${pct}%, rgba(61,50,38,0.7) 0)` }}
                    suppressHydrationWarning
                  >
                    <span className="absolute inset-[7px] rounded-full bg-card-bg" />
                    <span className="relative text-center leading-tight">
                      <b className="block font-mono text-sm font-bold" suppressHydrationWarning>
                        {untilLabel(v.expiry!, now)}
                      </b>
                      <i className="text-[9px] not-italic uppercase tracking-[0.13em] text-text-muted">left</i>
                    </span>
                  </div>
                )}
              </button>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-2">
            {sorted.slice(featured ? 1 : 0).map((t) => {
              const v = tileValue(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={onTileClick ? () => onTileClick(t.id) : undefined}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    v.done
                      ? 'border-accent-green/40 bg-accent-green/10'
                      : 'border-card-border bg-card-bg hover:border-gold/50 hover:bg-card-bg-hover'
                  } ${onTileClick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start gap-3">
                    {t.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold leading-snug ${v.done ? 'text-accent-green-light' : 'text-foreground'}`}>
                        {t.label}
                        {v.done && <span className="ml-2 text-xs">✓ done</span>}
                      </p>
                      <Value t={t} />
                    </div>
                  </div>
                  <Foot t={t} />
                  <Ramp t={t} />
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
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-text-muted hover:text-foreground">
            <span className="transition-transform group-open:rotate-90">▸</span>
            {closed.length} closed
          </summary>
          <ul className="mt-2 space-y-1">
            {closed.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs text-text-muted">
                <span className="truncate">{t.label}</span>
                {completedTileIds.has(t.id) && <span className="shrink-0 text-accent-green-light">claimed</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
