'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import {
  STARTING_STATS_POLL_MS,
  STARTING_STATS_POLL_WINDOW_MS,
  retryInTurn,
  type RetryOutcome,
  type StartingStatsStatus,
} from '@/lib/startingStatsRules';

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

/** POST one retry endpoint and say how it went — the 429 matters to "Try all", which stops on it. */
export async function postStartingStatsRetry(url: string): Promise<RetryOutcome> {
  try {
    const res = await clanFetch(url, { method: 'POST' });
    return res.ok ? 'ok' : res.status === 429 ? 'limited' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Ask the server to try one player's starting stats again. */
export function retryStartingStats(eventId: number, playerId: number): Promise<RetryOutcome> {
  return postStartingStatsRetry(`/api/events/${eventId}/players/${playerId}/starting-stats`);
}

/** The players a roster still couldn't read: failed, or pending past the poll window. */
export function unreadIds(
  ids: readonly number[],
  statuses: Record<number, StartingStatsStatus> | undefined,
  lapsed: boolean,
): number[] {
  return ids.filter((id) => {
    const s = statuses?.[id];
    return s?.state === 'failed' || (s?.state === 'pending' && lapsed);
  });
}

/**
 * One line over a roster with several unread players: "Couldn't read 8 players' hiscores yet · Try
 * all". Without it, eight late joiners made the roster a wall of two-line amber notes with a button
 * each. Hidden for fewer than two — one player's own line says it already.
 */
export function StartingStatsSummary({
  ids,
  onRetry,
  onDone,
  className = '',
}: {
  /** The unread players (see unreadIds). */
  ids: number[];
  /** Omit where the viewer can't retry. */
  onRetry?: (id: number) => Promise<RetryOutcome>;
  /** After a run: refresh the roster and reopen the poll window. */
  onDone?: () => Promise<void> | void;
  className?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState('');
  if (ids.length < 2) return null;

  async function tryAll() {
    if (!onRetry) return;
    setNote('');
    setProgress(0);
    try {
      const r = await retryInTurn(ids, onRetry, setProgress);
      setNote(
        r.limited
          ? r.asked > 0
            ? `Asked again for ${r.asked}; the rest are on cooldown — try in a few minutes.`
            : 'Tried too recently — give it a few minutes.'
          : r.failed > 0
            ? `Asked again for ${r.asked}; ${r.failed} didn’t go through.`
            : `Asked again for all ${r.asked}.`,
      );
      await onDone?.();
    } finally {
      setProgress(null);
    }
  }

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-[11px] text-amber-300/90 ${className}`}>
      <span>
        Couldn&apos;t read {ids.length} players&apos; hiscores yet
      </span>
      {onRetry && (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            disabled={progress !== null}
            onClick={tryAll}
            className="text-gold hover:text-gold-light underline underline-offset-2 disabled:opacity-60 disabled:no-underline"
          >
            {progress !== null ? `Trying ${Math.min(progress + 1, ids.length)}/${ids.length}…` : 'Try all'}
          </button>
        </>
      )}
      {note && <span className="text-text-muted">{note}</span>}
    </p>
  );
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

  // One line, truncated: the full sentence lives in the tooltip. A roster of late joiners is many of
  // these at once, and the old two-line note plus button per player buried the names.
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-amber-300/90 ${className}`}
      title="Couldn't read their hiscores yet — Anvil retries on the next sync."
    >
      <span className="truncate">Hiscores not read yet</span>
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
          className="shrink-0 text-gold hover:text-gold-light underline underline-offset-2 disabled:opacity-50"
        >
          {busy ? 'Trying…' : 'Retry'}
        </button>
      )}
    </span>
  );
}
