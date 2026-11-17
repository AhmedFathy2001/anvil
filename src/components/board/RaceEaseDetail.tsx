'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';
import { easeWaitText, type LifelineStatus } from '@/lib/raceEase';

interface EaseTile {
  live: { id: number; label: string; rank: number }[];
  locked: number;
  nextTimedAt: number | null;
  lifeline: LifelineStatus;
}
interface EaseView {
  tiles: Record<string, EaseTile>;
  lifelines: { left: number; total: number } | null;
  canSpend: boolean;
  /** The server's clock when it answered: every "opens in…" is counted from it. */
  now: number;
}

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

const lifelineCount = (n: number) => `${n} ${n === 1 ? 'lifeline' : 'lifelines'}`;

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
  const now = view.now;

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

  const life = tile?.lifeline;
  const left = view.lifelines?.left ?? 0;
  const total = view.lifelines?.total ?? 0;
  let lifeLine: string | null = null;
  if (view.lifelines) {
    if (!tile || life?.state === 'nothing') lifeLine = tile?.live.length ? null : `No easier option on this tile. Your team has ${lifelineCount(left)} of ${total} left.`;
    else if (life?.state === 'spent') lifeLine = `Your team used a lifeline here. ${lifelineCount(left)} of ${total} left.`;
    else if (life?.state === 'none-left') lifeLine = 'This tile has an easier option, but your team has no lifelines left.';
    else if (life?.state === 'not-open') lifeLine = `This tile has an easier option. A lifeline works on it once your team is playing it (${lifelineCount(left)} of ${total} left).`;
    else if (life?.state === 'wait' && life.readyAt != null) lifeLine = `This tile has an easier option. A lifeline works here ${easeWaitText(life.readyAt, now)} (${lifelineCount(left)} of ${total} left).`;
    else if (life?.state === 'ready' && !view.canSpend) lifeLine = `This tile has an easier option. Your captain can use a lifeline to open it (${lifelineCount(left)} of ${total} left).`;
  }
  const canSpendNow = life?.state === 'ready' && view.canSpend;
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
      {tile && tile.locked > 0 && tile.nextTimedAt != null && tile.nextTimedAt > now && (
        <p className="text-xs text-text-muted">
          {tile.live.length ? 'An easier one still' : 'An easier option'} opens for everyone {easeWaitText(tile.nextTimedAt, now)}.
        </p>
      )}
      {lifeLine && <p className="text-xs text-text-muted">{lifeLine}</p>}
      {canSpendNow && !confirming && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors"
          >
            Use a lifeline
          </button>
          <span className="text-xs text-text-muted">
            Opens this tile’s easier option for your team. {lifelineCount(left)} of {total} left.
          </span>
        </div>
      )}
      {canSpendNow && confirming && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground">
            Use one of your team’s {lifelineCount(left)} on this tile? You’ll see the easier option once it’s spent, and it can’t be taken back.
          </p>
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
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
