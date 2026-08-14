'use client';

import type { LadderMe } from '@/lib/ladderView';

/**
 * The viewer's own stake in the board, pinned to the top of the page.
 *
 * On a leaderboard the single strongest reason to keep looking is your own position and the exact
 * distance to the person above you — a number you can act on ("6 pts off 6th") rather than a place
 * you have to find yourself in a table. It's sticky because it has to still be true after you've
 * scrolled past your row.
 */
export default function YouStrip({ me, openNow }: { me: LadderMe; openNow: number }) {
  // Your points as a share of theirs — a bar that fills as you close on them, and reads honestly
  // (75% full means you have three quarters of what the person above you has).
  const gapPct = me.gap
    ? Math.max(4, Math.min(99, (me.points / Math.max(1, me.points + me.gap.points)) * 100))
    : 100;

  return (
    <div className="sticky top-[var(--nav-height)] z-10 mb-7 grid grid-cols-2 items-center gap-5 rounded-xl border border-accent-green/25 bg-gradient-to-r from-accent-green/15 via-card-bg/95 to-card-bg/95 p-3.5 backdrop-blur sm:grid-cols-[auto_auto_minmax(180px,1fr)_auto] sm:gap-6">
      <div className="font-mono text-3xl font-bold leading-none tabular-nums">
        <span className="text-base text-text-muted">#</span>
        {me.rank}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          <span className="truncate">{me.name}</span>
          <Delta value={me.movement} />
          {me.streak > 1 && (
            <span className="text-xs text-amber-300" title={`${me.streak}-day claim streak`}>
              🔥{me.streak}
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted">
          {Math.round(me.points).toLocaleString()} pts · {me.tasks} task{me.tasks === 1 ? '' : 's'}
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1">
        {me.gap ? (
          <>
            <div className="mb-1.5 text-xs text-text-muted">
              <span className="font-semibold text-foreground">{me.gap.points.toLocaleString()} pts</span> off{' '}
              {me.gap.name}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full border border-card-border bg-brown-dark">
              <div className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light" style={{ width: `${gapPct}%` }} />
            </div>
          </>
        ) : (
          <div className="text-xs text-text-muted">
            <span className="font-semibold text-gold">Top of the ladder.</span> Everyone else is chasing you.
          </div>
        )}
      </div>

      <a
        href="#open-now"
        className="col-span-2 justify-self-start whitespace-nowrap rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-bold text-gold transition-colors hover:bg-gold/20 sm:col-span-1 sm:justify-self-end"
      >
        {openNow} task{openNow === 1 ? '' : 's'} open now →
      </a>
    </div>
  );
}

export function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-[11px] font-bold text-text-muted" title="New on this board">new</span>;
  }
  if (value > 0) return <span className="font-mono text-[11px] font-bold text-accent-green-light">▲{value}</span>;
  if (value < 0) return <span className="font-mono text-[11px] font-bold text-red-400">▼{-value}</span>;
  return <span className="font-mono text-[11px] font-bold text-text-muted">—</span>;
}
