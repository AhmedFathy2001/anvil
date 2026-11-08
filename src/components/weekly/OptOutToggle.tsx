'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';

/**
 * "You're in · Opt out" for one competition (lib/competitionTeamsDb setOptOut). Opting out takes
 * every character of yours off this competition's boards; opting back in (while it runs) restores
 * them with their progress intact.
 */
export default function OptOutToggle({
  competitionId,
  initialOptedOut,
  compact = false,
}: {
  competitionId: number;
  initialOptedOut: boolean;
  /** One line, for the events list. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [optedOut, setOptedOut] = useState(initialOptedOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/weekly/${competitionId}/opt-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optOut: !optedOut }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That didn’t work');
      setOptedOut(!!data.optedOut);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = optedOut ? "You've opted out" : "You're in";
  const action = optedOut ? 'Opt back in' : 'Opt out';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={optedOut ? 'text-text-muted' : 'text-accent-green-light'}>{label}</span>
        <span className="text-text-muted">·</span>
        <button type="button" onClick={flip} disabled={busy} className="text-gold hover:underline disabled:opacity-50">
          {action}
        </button>
        {error && <span className="text-red-300">{error}</span>}
      </span>
    );
  }

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
        optedOut ? 'border-card-border bg-card-bg' : 'border-accent-green/25 bg-gradient-to-r from-accent-green/10 to-card-bg'
      }`}
    >
      <span className="h-5 w-1 rounded-full bg-gold" />
      <span className="flex-1 text-sm text-foreground">
        <b>{label}</b>
        <span className="text-text-muted">
          {optedOut ? ' — you’re off the board for this competition.' : ' — your gains count on the board.'}
        </span>
      </span>
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        className={
          optedOut
            ? 'rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50'
            : 'rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-red-400/50 hover:text-red-300 disabled:opacity-50'
        }
      >
        {action}
      </button>
      {error && <span className="w-full text-xs text-red-300">{error}</span>}
    </div>
  );
}
