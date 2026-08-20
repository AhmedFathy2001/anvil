'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface FeeBoard {
  eventId: number;
  name: string;
  /** Past its end date or force-ended — the only state where closing out is offered. */
  ended: boolean;
  endDate: string | null;
  /** Nobody has the money yet (pending or player-reported). */
  unpaid: number;
  /** A mod has it; it needs a second pair of eyes. */
  toSign: number;
  disputed: number;
  /** Money still to come in. A collected fee is already in hand, so it isn't counted. */
  outstandingGp: number;
}

const gp = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

/**
 * The boards that still owe something, each with its two actions.
 *
 * Close-out is the one that matters here: it's the action a host wants two months after a bingo
 * ended, and until now it existed only on that board's own Sign-ups tab — a tab you can't find if
 * you can't remember which board it was.
 */
export default function FeesBoardList({ boards, viewerRole }: { boards: FeeBoard[]; viewerRole: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function closeOut(board: FeeBoard) {
    const parts = [
      board.unpaid > 0 ? `write off ${board.unpaid} unpaid` : '',
      board.toSign > 0 ? `settle ${board.toSign} already collected` : '',
      board.disputed > 0 ? `write off ${board.disputed} disputed` : '',
    ].filter(Boolean);
    if (!confirm(`Close out ${board.name}? This will ${parts.join(' and ')}. It can't be undone in bulk.`)) {
      return;
    }
    setBusyId(board.eventId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/fees/close-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: board.eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not close those fees.');
      const said: string[] = [];
      if (data.settled) said.push(`${data.settled} settled`);
      if (data.writtenOff) said.push(`${data.writtenOff} written off`);
      setNotice(`${board.name}: ${said.length ? said.join(' · ') : 'nothing left to close'}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close those fees.');
    } finally {
      setBusyId(null);
    }
  }

  if (boards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border p-10 text-center">
        <p className="text-lg font-semibold mb-1">Nothing outstanding</p>
        <p className="text-sm text-text-muted">Every fee on every board is settled or written off.</p>
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div className="mb-3 text-xs text-accent-green-light border border-accent-green/30 bg-accent-green/10 rounded p-2">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded p-2">{error}</div>
      )}
      <div className="grid gap-2.5">
        {boards.map((b) => (
          <div
            key={b.eventId}
            className="rounded-xl border border-card-border bg-card-bg p-4 flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/admin/events/${b.eventId}/signups`} className="font-semibold hover:text-gold truncate">
                  {b.name}
                </Link>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    b.ended ? 'bg-card-border/70 text-text-muted' : 'bg-accent-green/15 text-accent-green-light'
                  }`}
                >
                  {b.ended ? 'Ended' : 'Running'}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                {[
                  b.unpaid > 0 ? `${b.unpaid} unpaid` : null,
                  b.toSign > 0 ? `${b.toSign} awaiting sign-off` : null,
                  b.disputed > 0 ? `${b.disputed} disputed` : null,
                  b.outstandingGp > 0 ? `${gp(b.outstandingGp)} gp still out` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/admin/events/${b.eventId}/signups`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
              >
                Open Sign-ups
              </Link>
              {/* Only for a finished board, and only for an admin: this writes money off. */}
              {b.ended && viewerRole === 'admin' && (
                <button
                  onClick={() => closeOut(b)}
                  disabled={busyId === b.eventId}
                  title="Settle what was collected and write off what never came in"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {busyId === b.eventId ? 'Closing…' : 'Close out'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
