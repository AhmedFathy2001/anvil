'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { STARTING_STATS_POLL_MS, STARTING_STATS_POLL_WINDOW_MS, type StartingStatsStatus } from '@/lib/startingStatsRules';

// The roster line for a player put on a running event after it started (lib/startingStats): their
// starting stats are being read, were taken at a time, or couldn't be read yet. Before the start the
// server sends no status and this renders nothing.

/**
 * Light polling while anyone on the roster is still pending: every 5s, for at most two minutes,
 * only while the tab is visible. After the window, pending reads as "couldn't read yet" — the sweep
 * will still retry. `restart()` opens a fresh window (after "Try again").
 */
export function useStartingStatsPoll(anyPending: boolean, refresh: () => void | Promise<void>) {
  const [lapsed, setLapsed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!anyPending) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt >= STARTING_STATS_POLL_WINDOW_MS) {
        setLapsed(true);
        clearInterval(timer);
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshRef.current();
    }, STARTING_STATS_POLL_MS);
    return () => {
      clearInterval(timer);
      // Nobody pending any more, or a fresh window: the next pending player starts un-lapsed.
      setLapsed(false);
    };
  }, [anyPending, epoch]);

  const restart = useCallback(() => setEpoch((n) => n + 1), []);
  return { lapsed: anyPending && lapsed, restart };
}

/** Ask the server to try one player's starting stats again. */
export async function retryStartingStats(eventId: number, playerId: number): Promise<boolean> {
  const res = await clanFetch(`/api/events/${eventId}/players/${playerId}/starting-stats`, { method: 'POST' });
  return res.ok;
}

function shortTime(iso: string): string {
  const d = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function StartingStatsLine({
  status,
  lapsed = false,
  onRetry,
  className = '',
}: {
  status: StartingStatsStatus | null | undefined;
  /** The poll window ran out with this player still pending. */
  lapsed?: boolean;
  /** Shown as "Try again" on a failed read; omit where the viewer can't retry. */
  onRetry?: () => Promise<void> | void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!status) return null;

  if (status.state === 'taken') {
    const at = shortTime(status.at);
    return (
      <span className={`text-[10px] text-text-muted ${className}`}>
        Starting stats taken{at ? ` ${at}` : ''}
      </span>
    );
  }

  if (status.state === 'pending' && !lapsed) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] text-text-muted ${className}`} role="status">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shrink-0" aria-hidden="true" />
        Capturing starting stats…
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-[10px] text-amber-300/90 ${className}`}>
      Couldn&apos;t read their hiscores yet — we&apos;ll retry on the next sync
      {onRetry && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRetry();
            } finally {
              setBusy(false);
            }
          }}
          className="text-gold hover:text-gold-light border border-gold/30 rounded px-1.5 py-px transition-colors disabled:opacity-50"
        >
          {busy ? 'Trying…' : 'Try again'}
        </button>
      )}
    </span>
  );
}
