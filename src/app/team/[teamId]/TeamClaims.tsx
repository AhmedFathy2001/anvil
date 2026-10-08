'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { claimNamesByTile, claimsByPerson, NOTE_MAX, type TeamClaim } from '@/lib/tileClaimsView';

interface ClaimsState {
  claims: TeamClaim[];
  canClaim: boolean;
  canClear: boolean;
}

/**
 * The team's planning — who's going for which tile — loaded for THIS team only (its own route, which
 * answers nobody else). Refreshes every 30s while the tab is visible, and right after any change.
 */
export function useTeamClaims(teamId: number, enabled: boolean) {
  const [state, setState] = useState<ClaimsState>({ claims: [], canClaim: false, canClear: false });
  const [error, setError] = useState<string | null>(null);
  const [busyTile, setBusyTile] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const res = await clanFetch(`/api/team/${teamId}/claims`);
    if (res.ok) setState(await res.json());
  }, [teamId, enabled]);

  useEffect(() => {
    load();
    if (!enabled) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(t);
  }, [load, enabled]);

  const mutate = useCallback(
    async (tileId: number, init: RequestInit, path = `/api/team/${teamId}/claims`) => {
      setBusyTile(tileId);
      setError(null);
      try {
        const res = await clanFetch(path, init);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? 'That didn’t work.');
        setState((s) => ({ ...s, claims: data.claims ?? s.claims }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyTile(null);
      }
    },
    [teamId],
  );

  const claim = (tileId: number, note: string) =>
    mutate(tileId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId, note }),
    });
  const unclaim = (tileId: number, userId?: number) =>
    mutate(
      tileId,
      { method: 'DELETE' },
      `/api/team/${teamId}/claims?tileId=${tileId}${userId != null ? `&userId=${userId}` : ''}`,
    );

  const byTile = useMemo(() => claimNamesByTile(state.claims), [state.claims]);
  return { ...state, byTile, error, busyTile, claim, unclaim };
}

type Claims = ReturnType<typeof useTeamClaims>;

/** "Who's going for what" — every teammate's claims, yours first. Click a tile to open it. */
export function TeamPlanPanel({
  claims,
  tileLabel,
  onOpenTile,
}: {
  claims: Claims;
  tileLabel: (tileId: number) => string | null;
  onOpenTile: (tileId: number) => void;
}) {
  const people = claimsByPerson(claims.claims);
  return (
    <div className="mb-4 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">🎯 Who’s going for what</h3>
        <span className="text-[11px] text-text-muted">Only your team sees this</span>
      </div>
      {people.length === 0 ? (
        <p className="text-[13px] text-text-muted">
          Nobody has called a tile yet. Open a tile and press <b>I’m going for this</b> so the team doesn’t double up.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[13px]">
          {people.map((p) => (
            <li key={p.userId} className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={`font-semibold ${p.mine ? 'text-gold' : ''}`}>{p.mine ? `${p.name} (you)` : p.name}:</span>
              {p.claims.map((c, i) => (
                <span key={c.tileId}>
                  <button type="button" onClick={() => onOpenTile(c.tileId)} className="underline-offset-2 hover:text-gold hover:underline">
                    {tileLabel(c.tileId) ?? 'a tile'}
                  </button>
                  {c.note && <span className="text-text-muted"> ({c.note})</span>}
                  {i < p.claims.length - 1 && ','}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The planning block inside a tile's popup: who's on it, and claim / unclaim for you. */
export function TileClaimSection({ claims, tileId, completed }: { claims: Claims; tileId: number; completed: boolean }) {
  const onTile = claims.claims.filter((c) => c.tileId === tileId);
  const mine = onTile.find((c) => c.mine);
  const [note, setNote] = useState(mine?.note ?? '');
  useEffect(() => setNote(mine?.note ?? ''), [mine?.note, tileId]);
  if (completed && onTile.length === 0) return null;
  const busy = claims.busyTile === tileId;

  return (
    <div className="rounded-lg border border-sky-400/30 bg-sky-500/5 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">🎯 Planning</span>
        <span className="text-[11px] text-text-muted">Only your team sees this</span>
      </div>
      {onTile.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nobody on your team has called this one.</p>
      ) : (
        <ul className="mb-2 space-y-1 text-[13px]">
          {onTile.map((c) => (
            <li key={c.userId} className="flex items-center gap-2">
              <span className={c.mine ? 'font-semibold text-gold' : 'font-semibold'}>{c.mine ? 'You' : c.name}</span>
              {c.note && <span className="text-text-muted">— {c.note}</span>}
              {!c.mine && claims.canClear && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => claims.unclaim(tileId, c.userId)}
                  className="ml-auto text-[11px] text-text-muted hover:text-accent-red"
                  title="Clear this claim (captain / team staff)"
                >
                  clear
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {claims.canClaim && !completed && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="Note (optional) — e.g. doing it tonight"
            className="min-w-0 flex-1 rounded-md border border-card-border bg-transparent px-2 py-1 text-[13px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => claims.claim(tileId, note)}
            className="rounded-md bg-sky-500/80 px-3 py-1 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {mine ? 'Update' : 'I’m going for this'}
          </button>
          {mine && (
            <button
              type="button"
              disabled={busy}
              onClick={() => claims.unclaim(tileId)}
              className="rounded-md border border-card-border px-3 py-1 text-[13px] disabled:opacity-50"
            >
              Drop it
            </button>
          )}
        </div>
      )}
      {claims.error && <p className="mt-1 text-[12px] text-accent-red">{claims.error}</p>}
    </div>
  );
}
