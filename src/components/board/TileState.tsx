'use client';

import { cn } from '@/lib/utils';
import type { TileStateKind, TileStateView } from '@/lib/tileState';

/**
 * The tile-state look shared by race tiles and missions (lib/tileState): a padlock for locked, a
 * gold "Next"/"Live" tag for open, a check for done, faded for closed, an hourglass for expired.
 * `TileStateChip` sits in a row; `TileStateBanner` heads a tile's details.
 */

export function TileStateIcon({ kind, className }: { kind: TileStateKind; className?: string }) {
  const common = { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className };
  if (kind === 'locked' || kind === 'closed') {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
    );
  }
  if (kind === 'expired') {
    return (
      <svg {...common}>
        <path d="M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6" />
      </svg>
    );
  }
  if (kind === 'done') {
    return (
      <svg {...common}>
        <path d="M3 8.5l3.2 3L13 4.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" />
    </svg>
  );
}

const CHIP: Record<TileStateKind, string> = {
  open: 'bg-gold text-brown-dark font-bold',
  done: 'bg-gold/15 text-gold border border-gold/40',
  locked: 'bg-brown-dark/70 text-text-muted border border-card-border',
  closed: 'bg-brown-dark/50 text-text-muted/70 border border-card-border',
  expired: 'bg-brown-dark/50 text-text-muted/70 border border-card-border grayscale',
};

export function TileStateChip({ view, className, withDetail = false }: { view: TileStateView; className?: string; withDetail?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap', CHIP[view.kind], className)}>
      <TileStateIcon kind={view.kind} />
      {view.label}
      {withDetail && view.detail ? <span className="font-normal opacity-80">· {view.detail}</span> : null}
    </span>
  );
}

const BANNER: Record<TileStateKind, string> = {
  open: 'border-2 border-dashed border-gold/80 bg-gold/10 text-foreground shadow-[0_0_16px_rgba(224,170,30,0.25)]',
  done: 'border border-gold/50 bg-gold/10 text-foreground',
  locked: 'border border-card-border bg-brown-dark/60 text-text-muted',
  closed: 'border border-card-border bg-brown-dark/40 text-text-muted grayscale',
  expired: 'border border-card-border bg-brown-dark/40 text-text-muted grayscale',
};

export function TileStateBanner({ view, title, children, className }: { view: TileStateView; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2.5 flex items-start gap-2.5', BANNER[view.kind], className)} role="status">
      <span className={cn('mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0', view.kind === 'open' || view.kind === 'done' ? 'bg-gold text-brown-dark' : 'bg-brown-dark text-text-muted')}>
        <TileStateIcon kind={view.kind} className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title ?? view.label}{view.detail ? <span className="font-normal text-text-muted"> · {view.detail}</span> : null}</p>
        {children}
      </div>
    </div>
  );
}
