'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { claimColor, claimInitials, claimMarkersByTile, claimsByPerson, NOTE_MAX, type TeamClaim } from '@/lib/tileClaimsView';
import ClaimAvatars from '@/components/ClaimAvatars';
import { deriveTileIcon } from '@/lib/tileIcons';
import type { Tile } from '@/lib/types';

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

  const byTile = useMemo(() => claimMarkersByTile(state.claims), [state.claims]);
  return { ...state, byTile, error, busyTile, claim, unclaim };
}

type Claims = ReturnType<typeof useTeamClaims>;

export type ClaimFilter = 'all' | 'unclaimed' | 'mine' | 'claimed';

/** The board tiles a claim filter keeps, or null for "all". Unclaimed means still open AND nobody's on it. */
export function claimFilterIds(
  filter: ClaimFilter,
  tiles: { id: number }[],
  claims: TeamClaim[],
  completedIds: Set<number>,
): Set<number> | null {
  if (filter === 'all') return null;
  const claimed = new Set(claims.map((c) => c.tileId));
  const mine = new Set(claims.filter((c) => c.mine).map((c) => c.tileId));
  return new Set(
    tiles
      .filter((t) =>
        filter === 'mine' ? mine.has(t.id) : filter === 'claimed' ? claimed.has(t.id) : !claimed.has(t.id) && !completedIds.has(t.id),
      )
      .map((t) => t.id),
  );
}

const CHIPS_SHOWN = 4;

/**
 * "Who's going for what": one card per teammate (yours first) with how much they've taken on and
 * their tiles as chips, plus a filter that narrows the board to unclaimed / your / claimed tiles.
 * Collapsible, with the one-line summary always visible.
 */
export function TeamPlanPanel({
  claims,
  tiles,
  completedIds,
  filter,
  onFilter,
  onOpenTile,
}: {
  claims: Claims;
  tiles: Tile[];
  completedIds: Set<number>;
  filter: ClaimFilter;
  onFilter: (f: ClaimFilter) => void;
  onOpenTile: (tileId: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const tileById = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);
  const people = claimsByPerson(claims.claims);
  const claimedTiles = new Set(claims.claims.map((c) => c.tileId));
  const openTiles = tiles.filter((t) => !completedIds.has(t.id));
  const unclaimed = openTiles.filter((t) => !claimedTiles.has(t.id)).length;
  const mineCount = new Set(claims.claims.filter((c) => c.mine).map((c) => c.tileId)).size;

  const filters: { key: ClaimFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All tiles' },
    { key: 'unclaimed', label: 'Nobody on it', count: unclaimed },
    { key: 'mine', label: 'Mine', count: mineCount },
    { key: 'claimed', label: 'Claimed', count: claimedTiles.size },
  ];

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-card-border bg-card-bg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-bg-hover"
        aria-expanded={open}
      >
        <span className="h-5 w-1 shrink-0 rounded-full bg-sky-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Who’s going for what</div>
          <div className="text-[12px] text-text-muted">
            {people.length === 0
              ? 'Nobody has called a tile yet'
              : `${people.length} ${people.length === 1 ? 'person' : 'people'} planning ${claimedTiles.size} tile${claimedTiles.size === 1 ? '' : 's'}`}
            {openTiles.length > 0 && <> · <b className="text-foreground">{unclaimed}</b> open with nobody on it</>}
          </div>
        </div>
        <span className="hidden text-[11px] text-text-muted sm:inline">Only your team sees this</span>
        <span className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="border-t border-card-border px-4 pb-4 pt-3">
          {people.length === 0 ? (
            <p className="mb-3 text-[13px] text-text-muted">
              Open a tile and press <b className="text-foreground">I’m going for this</b> so the team doesn’t double up.
            </p>
          ) : (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {people.map((p) => {
                const pts = p.claims.reduce((sum, c) => sum + (tileById.get(c.tileId)?.points ?? 0), 0);
                const showAll = expanded.has(p.userId);
                const chips = showAll ? p.claims : p.claims.slice(0, CHIPS_SHOWN);
                return (
                  <div
                    key={p.userId}
                    className={`rounded-lg border p-2.5 ${p.mine ? 'border-gold/40 bg-gold/5' : 'border-card-border bg-brown-dark/40'}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${p.mine ? 'ring-2 ring-gold' : ''}`}
                        style={{ backgroundColor: claimColor(p.name) }}
                        aria-hidden
                      >
                        {claimInitials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">
                          {p.name}
                          {p.mine && <span className="ml-1 font-normal text-gold">(you)</span>}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {p.claims.length} tile{p.claims.length === 1 ? '' : 's'}
                          {pts > 0 && <> · {pts.toLocaleString()} pts</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {chips.map((c) => {
                        const tile = tileById.get(c.tileId);
                        const icon = tile ? tile.icon || deriveTileIcon(tile) : null;
                        return (
                          <button
                            key={c.tileId}
                            type="button"
                            onClick={() => onOpenTile(c.tileId)}
                            title={c.note ? `${tile?.label ?? 'Tile'} — ${c.note}` : tile?.label}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-card-border bg-card-bg px-1.5 py-0.5 text-[11px] hover:border-gold/50 hover:text-gold"
                          >
                            {icon && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                            )}
                            <span className="truncate">{tile?.label ?? 'A tile'}</span>
                            {c.note && <span className="shrink-0 text-sky-300" aria-label="has a note">•</span>}
                          </button>
                        );
                      })}
                      {p.claims.length > CHIPS_SHOWN && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.userId)) next.delete(p.userId);
                              else next.add(p.userId);
                              return next;
                            })
                          }
                          className="rounded-md px-1.5 py-0.5 text-[11px] text-text-muted hover:text-gold"
                        >
                          {showAll ? 'show less' : `+${p.claims.length - CHIPS_SHOWN} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-text-muted">Show</span>
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] ${
                  filter === f.key ? 'border-sky-400/60 bg-sky-500/15 text-sky-200' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                {f.label}
                {f.count != null && <span className="ml-1 opacity-70">{f.count}</span>}
              </button>
            ))}
          </div>
        </div>
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
        <span className="text-sm font-semibold">Planning</span>
        <span className="text-[11px] text-text-muted">Only your team sees this</span>
      </div>
      {onTile.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nobody on your team has called this one.</p>
      ) : (
        <ul className="mb-2 space-y-1 text-[13px]">
          {onTile.map((c) => (
            <li key={c.userId} className="flex items-center gap-2">
              <ClaimAvatars claims={[{ name: c.name, mine: c.mine }]} size="sm" />
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
