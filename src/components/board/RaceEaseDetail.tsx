'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';
import { lifelineConfirmText, lifelineLine, lifelineSpendable, nextTimedLine, type TeamEasePayload } from '@/lib/raceEase';

type EaseView = TeamEasePayload;

/** One team's easing view of a race (GET /api/events/:id/race-lifeline), refetched after a spend. */
export function useRaceEase(eventId: number | undefined, teamId: number | null | undefined): { view: EaseView | null; reload: () => void } {
  const [view, setView] = useState<EaseView | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (eventId == null || teamId == null) return;
    let gone = false;
    clanFetch(`/api/events/${eventId}/race-lifeline?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!gone && d) setView(d as EaseView);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [eventId, teamId, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { view, reload };
}

/**
 * A race tile's easier options, in its details (components/TileDetailModal), for the viewer's team:
 * the ones that are live ("or do this instead"), how many are still locked and when the clock opens
 * the next, and the lifeline button. Draws nothing on a tile with no easier option, unless the race
 * has lifelines (then it says so, so a team knows where one can't be spent).
 */
export default function RaceEaseDetail({
  eventId,
  teamId,
  tileId,
  optionDetails,
}: {
  eventId: number | undefined;
  teamId: number | null | undefined;
  tileId: number;
  /** The live options' own descriptions, where the page has their rows (nested on the tile). */
  optionDetails?: { id: number; description?: string | null }[];
}) {
  const router = useRouter();
  const { view, reload } = useRaceEase(eventId, teamId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justOpened, setJustOpened] = useState<string[] | null>(null);
  if (!view || teamId == null || eventId == null) return null;
  const tile = view.tiles[String(tileId)];
  if (!tile && !view.lifelines) return null;

  async function spend() {
    setBusy(true);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-lifeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, tileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || 'Could not use a lifeline.');
      setJustOpened(((data.opened ?? []) as { label: string }[]).map((o) => o.label));
      setConfirming(false);
      reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function giveBack() {
    setBusy(true);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-lifeline`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, tileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || 'Could not give the lifeline back.');
      setJustOpened(null);
      reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const left = view.lifelines?.left ?? 0;
  const canSpendNow = lifelineSpendable(view, tile);
  const lifeLine = lifelineLine(view, tile);
  const timedLine = nextTimedLine(view, tile);
  const descOf = (id: number) => optionDetails?.find((o) => o.id === id)?.description ?? null;

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-card-border bg-brown-dark/40 px-3 py-2.5">
      {tile && tile.live.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-accent-green-light">{tile.live.length > 1 ? 'Easier options open' : 'Easier option open'}</p>
          <p className="text-xs text-text-muted">Finish the tile as written, or do {tile.live.length > 1 ? 'one of these' : 'this'} instead. Either way the tile is done.</p>
          <ul className="mt-1.5 space-y-1">
            {tile.live.map((o) => (
              <li key={o.id} className="text-sm text-foreground">
                {o.label}
                {descOf(o.id) && <span className="block text-xs text-text-muted">{descOf(o.id)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {justOpened && justOpened.length === 0 && <p className="text-xs text-text-muted">Lifeline used.</p>}
      {timedLine && <p className="text-xs text-text-muted">{timedLine}</p>}
      {lifeLine && !canSpendNow && <p className="text-xs text-text-muted">{lifeLine}</p>}
      {canSpendNow && !confirming && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors"
          >
            Use a lifeline
          </button>
          <span className="text-xs text-text-muted">{lifeLine}</span>
        </div>
      )}
      {canSpendNow && confirming && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground">{lifelineConfirmText(left)}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground disabled:opacity-50">
              Keep it
            </button>
            <button type="button" disabled={busy} onClick={() => void spend()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 disabled:opacity-50">
              {busy ? 'Using…' : 'Use the lifeline'}
            </button>
          </div>
        </div>
      )}
      {view.canRefund && tile?.lifeline.state === 'spent' && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void giveBack()} className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 disabled:opacity-50">
            {busy ? 'Giving back…' : 'Give the lifeline back'}
          </button>
          <span className="text-xs text-text-muted">Admin: the team gets it back, and the easier option closes again unless the clock has opened it.</span>
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
