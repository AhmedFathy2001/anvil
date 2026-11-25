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
  seats = [],
}: {
  competitionId: number;
  initialOptedOut: boolean;
  /** One line, for the events list. */
  compact?: boolean;
  /** Each of your characters entered (lib/competitionTeamsDb entryStatus). Two or more: one switch each. */
  seats?: { seatId: number; rsn: string; optedOut: boolean }[];
}) {
  if (!compact && seats.length > 1) return <PerCharacter competitionId={competitionId} initial={seats} />;
  return <Whole competitionId={competitionId} initialOptedOut={initialOptedOut} compact={compact} />;
}

/** Several characters entered: each one in or out on its own, so an alt can sit this one out. */
function PerCharacter({ competitionId, initial }: { competitionId: number; initial: { seatId: number; rsn: string; optedOut: boolean }[] }) {
  const router = useRouter();
  const [seats, setSeats] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flip(seatId: number, optOut: boolean) {
    setBusy(seatId);
    setError(null);
    try {
      const res = await clanFetch(`/api/weekly/${competitionId}/opt-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optOut, seatId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That didn’t work');
      if (Array.isArray(data.seats)) setSeats(data.seats);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const inCount = seats.filter((s) => !s.optedOut).length;
  return (
    <div className="mb-5 rounded-xl border border-accent-green/25 bg-gradient-to-r from-accent-green/10 to-card-bg px-4 py-3">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-gold" />
        <span className="text-sm">
          <b>{inCount === 0 ? "You've opted out" : `${inCount} of ${seats.length} of your characters are in`}</b>
          <span className="text-text-muted"> — each one counts on its own.</span>
        </span>
      </div>
      <ul className="divide-y divide-card-border/60">
        {seats.map((s) => (
          <li key={s.seatId} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-sm">
              {s.rsn}
              <span className={`ml-2 text-xs ${s.optedOut ? 'text-text-muted' : 'text-accent-green-light'}`}>{s.optedOut ? 'opted out' : 'in'}</span>
            </span>
            <button
              type="button"
              onClick={() => flip(s.seatId, !s.optedOut)}
              disabled={busy != null}
              className={
                s.optedOut
                  ? 'rounded-lg bg-gold px-2.5 py-1 text-xs font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50 max-sm:min-h-11'
                  : 'rounded-lg border border-card-border px-2.5 py-1 text-xs text-text-muted hover:border-red-400/50 hover:text-red-300 disabled:opacity-50 max-sm:min-h-11'
              }
            >
              {s.optedOut ? 'Opt back in' : 'Opt out'}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function Whole({ competitionId, initialOptedOut, compact }: { competitionId: number; initialOptedOut: boolean; compact: boolean }) {
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
      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs">
        {/* One unbreakable piece, so a narrow row never leaves the dot alone at the end of a line. */}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={optedOut ? 'text-text-muted' : 'text-accent-green-light'}>{label}</span>
          <span aria-hidden className="text-text-muted">·</span>
          <button type="button" onClick={flip} disabled={busy} className="text-gold hover:underline disabled:opacity-50 max-sm:min-h-11 max-sm:px-2">
            {action}
          </button>
        </span>
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
