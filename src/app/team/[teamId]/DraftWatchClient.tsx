'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// What a player sees while the draft runs.
//
// It used to be one grey box: "the draft is in progress, your board opens here once it wraps up."
// That's the most-watched ten minutes of an event and the page said nothing — so this reads the
// same state the captains already poll, from the other side: who's gone, who's left, and the
// moment your own name goes up.

const POLL_MS = 3000;

interface DraftState {
  status: string;
  teamOrder: number[];
  players: { id: number; name: string; teamId: number | null; pickNumber: number | null; pickedAt: string | null }[];
  teams: { id: number; name: string; color: string }[];
  currentTeamId: number | null;
  currentPickNumber: number;
  round: number;
  totalPicked: number;
  poolRemaining: number;
}

export default function DraftWatchClient({
  eventId,
  teamId,
  teamName,
  /** The viewer's own player row on this team, when they have one. */
  myPlayerId,
}: {
  eventId: number;
  teamId: number;
  teamName: string;
  myPlayerId: number | null;
}) {
  const [draft, setDraft] = useState<DraftState | null>(null);

  const fetchDraft = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/draft`);
      if (res.ok) setDraft((await res.json()) as DraftState);
    } catch {
      /* the next tick covers it */
    }
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling an external system
    void fetchDraft();
    const id = setInterval(fetchDraft, POLL_MS);
    return () => clearInterval(id);
  }, [fetchDraft]);

  const me = useMemo(
    () => (myPlayerId != null ? draft?.players.find((p) => p.id === myPlayerId) ?? null : null),
    [draft, myPlayerId],
  );
  const onTheClock = draft?.teams.find((t) => t.id === draft.currentTeamId) ?? null;
  const teamById = useMemo(() => new Map((draft?.teams ?? []).map((t) => [t.id, t])), [draft]);

  const feed = useMemo(() => {
    return (draft?.players ?? [])
      .filter((p) => p.teamId != null && p.pickedAt)
      .sort((a, b) => (b.pickedAt ?? '').localeCompare(a.pickedAt ?? ''))
      .slice(0, 10);
  }, [draft]);

  const myTeamRoster = useMemo(
    () => (draft?.players ?? []).filter((p) => p.teamId === teamId),
    [draft, teamId],
  );

  if (!draft) return <div className="text-center py-16 text-text-muted">Loading the draft…</div>;

  const drafted = me?.teamId != null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="grid gap-5 content-start">
        <section
          className={`rounded-xl border p-5 ${
            drafted ? 'border-accent-green/40 bg-accent-green/[0.07]' : 'border-card-border bg-card-bg'
          }`}
        >
          {draft.status === 'paused' ? (
            <>
              <div className="text-lg font-bold">The draft is paused</div>
              <p className="text-sm text-text-muted mt-1">
                An admin stopped the clock. It picks up where it left off — nothing you need to do.
              </p>
            </>
          ) : drafted ? (
            <>
              <div className="text-lg font-bold text-accent-green-light">
                {teamName} picked you{me?.pickNumber != null ? ` at pick ${me.pickNumber + 1}` : ''}.
              </div>
              <p className="text-sm text-text-muted mt-1">
                You&rsquo;re on the roster. Your board opens here the moment the draft wraps up.
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-bold">You&rsquo;re still in the pool.</div>
              <p className="text-sm text-text-muted mt-1">
                {draft.totalPicked} of {draft.totalPicked + draft.poolRemaining} taken
                {onTheClock ? ` · ${onTheClock.name} is picking now` : ''}.
              </p>
            </>
          )}
        </section>

        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">As it happens</h2>
            <span className="ml-auto text-xs text-text-muted">round {draft.round + 1}</span>
          </div>
          {feed.length === 0 ? (
            <p className="text-sm text-text-muted">No picks yet — the first one is about to land.</p>
          ) : (
            <div className="grid">
              {feed.map((p) => {
                const t = p.teamId != null ? teamById.get(p.teamId) : null;
                const isMe = myPlayerId != null && p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2.5 py-2 text-sm border-b border-card-border/50 last:border-b-0 ${
                      isMe ? 'text-accent-green-light font-medium' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: t?.color ?? '#8a7e6c' }}
                    />
                    <span className={isMe ? '' : 'text-text-muted'}>
                      {t?.name ?? 'A team'} took <span className={isMe ? '' : 'text-foreground'}>{p.name}</span>
                      {isMe && ' — that’s you'}
                    </span>
                    {p.pickNumber != null && (
                      <span className="ml-auto font-mono text-[11px] text-text-muted">#{p.pickNumber + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="border border-card-border rounded-xl bg-card-bg p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">{teamName}</h2>
          <span className="ml-auto text-xs text-text-muted">{myTeamRoster.length}</span>
        </div>
        {myTeamRoster.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody drafted yet.</p>
        ) : (
          <div className="grid gap-1.5">
            {myTeamRoster
              .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0))
              .map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 text-sm border rounded-lg px-2.5 py-2 ${
                    myPlayerId === p.id
                      ? 'border-accent-green/40 bg-accent-green/[0.07]'
                      : 'border-card-border bg-brown-dark/40'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.pickNumber != null && (
                    <span className="ml-auto font-mono text-[11px] text-text-muted">pick {p.pickNumber + 1}</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
