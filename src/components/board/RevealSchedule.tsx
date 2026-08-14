'use client';

import { useEffect, useState } from 'react';

/**
 * A showdown is a schedule, so it should look like one.
 *
 * On a scheduled board every tile has a time, and the interesting part is what hasn't dropped yet:
 * the points still to come are often bigger than the current lead, which is exactly the thing that
 * keeps people watching. Hidden tiles show their VALUE and their time but never their content —
 * that's the format's whole trick.
 */

export interface ScheduleTile {
  id: number;
  label: string;
  points?: number | null;
  icon?: string | null;
  /** Planned reveal time (tiles.revealAt). */
  revealAt?: string | null;
  /** Set once the engine actually revealed it. */
  revealedAt?: string | null;
  closedAt?: string | null;
  /** Whether any team has claimed it. */
  claimed: boolean;
  claims: number;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function untilLabel(target: number, now: number): string {
  const ms = target - now;
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${String(mins % 60).padStart(2, '0')}m`;
  return `${Math.round(hours / 24)} days`;
}

export default function RevealSchedule({
  tiles,
  pointsMode,
  onTileClick,
}: {
  tiles: ScheduleTile[];
  pointsMode: boolean;
  onTileClick?: (tileId: number) => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  // Ordered by when each tile lands: revealed ones by when they opened, the rest by their plan.
  const ordered = [...tiles].sort((a, b) => {
    const at = a.revealedAt ?? a.revealAt ?? '';
    const bt = b.revealedAt ?? b.revealAt ?? '';
    return at.localeCompare(bt);
  });
  const hidden = ordered.filter((t) => !t.revealedAt);
  const hiddenPoints = hidden.reduce((s, t) => s + (t.points ?? 0), 0);
  const nextHidden = hidden.find((t) => t.revealAt);

  return (
    <div className="space-y-2">
      {ordered.map((t) => {
        // A placeholder carries a time and a value and nothing else — there is no tile to open.
        const isHidden = !t.revealedAt;
        const isPlaceholder = t.id < 0;
        const isNext = nextHidden?.id === t.id;
        const open = !!t.revealedAt && !t.closedAt;
        const when = t.revealedAt ?? t.revealAt;
        return (
          <button
            key={t.id}
            type="button"
            onClick={onTileClick && !isHidden && !isPlaceholder ? () => onTileClick(t.id) : undefined}
            className={`grid w-full grid-cols-[74px_34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              open
                ? 'border-accent-green/40 bg-gradient-to-r from-accent-green/10 to-card-bg'
                : isNext
                  ? 'border-gold/45 bg-gradient-to-r from-gold/10 to-card-bg'
                  : 'border-card-border bg-card-bg'
            } ${t.closedAt ? 'opacity-55' : ''} ${
              onTileClick && !isHidden && !isPlaceholder ? 'cursor-pointer hover:border-gold/50' : 'cursor-default'
            }`}
          >
            <span className="font-mono text-sm font-bold">{when ? timeLabel(when) : 'unscheduled'}</span>

            {isHidden || !t.icon ? (
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-dashed border-card-border text-sm text-text-muted">
                ?
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.icon} alt="" className="h-8 w-8 object-contain" />
            )}

            <span className="min-w-0">
              <span className={`block truncate font-semibold ${isHidden ? 'italic text-text-muted' : ''}`}>
                {isHidden ? `Hidden until ${when ? timeLabel(when) : 'the host drops it'}` : t.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-text-muted">
                {isHidden
                  ? isNext && when && now !== null
                    ? `drops in ${untilLabel(Date.parse(when), now)}`
                    : 'value known, content hidden'
                  : t.closedAt
                    ? `closed · ${t.claims} claim${t.claims === 1 ? '' : 's'}`
                    : t.claims > 0
                      ? `open · ${t.claims} claim${t.claims === 1 ? '' : 's'}`
                      : 'open — nobody has it yet'}
              </span>
            </span>

            <span className="flex items-center gap-2.5">
              {open && (
                <span className="rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-green-light">
                  open
                </span>
              )}
              {isNext && (
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-light">
                  next
                </span>
              )}
              {pointsMode && <span className="font-mono text-lg font-bold text-gold-light">{t.points ?? 0}</span>}
            </span>
          </button>
        );
      })}

      {pointsMode && hiddenPoints > 0 && (
        <div className="rounded-xl border border-purple-400/25 bg-gradient-to-r from-purple-500/10 to-card-bg px-4 py-3 text-[13px] text-text-muted">
          <span className="font-mono text-xl font-bold text-purple-300">{hiddenPoints.toLocaleString()} pts</span> still
          hidden across {hidden.length} tile{hidden.length === 1 ? '' : 's'} — nothing is settled until the last one
          drops.
        </div>
      )}
    </div>
  );
}
