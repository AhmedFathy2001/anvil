'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTeamForPick } from '@/lib/draft';
import type { WarRoom, WarRoomPerson } from '@/lib/warRoom';
import PlayerDrawer, { DOMAIN_LABEL, TierChip } from './applicants/PlayerDrawer';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

// The captain's pick surface. Two polls with different costs: the draft state is cheap and drives
// the clock, so it runs on a short interval; the pool carries ratings and answers (a profile sweep)
// and is only refetched when a pick actually lands.
//
// Everything a captain needs to pick fast is on one screen: their own shortlist first, who they
// can't replace if they wait, and what their roster still can't attempt.

const DRAFT_POLL_MS = 2500;

interface DraftState {
  status: string;
  teamOrder: number[];
  players: { id: number; name: string; teamId: number | null; pickNumber: number | null; pickedAt: string | null }[];
  teams: { id: number; name: string; color: string }[];
  currentPickNumber: number;
  currentTeamId: number | null;
  round: number;
  pickInRound: number;
  totalPicked: number;
  poolRemaining: number;
  balanceMode?: string;
  /** Seconds per pick (0 = no clock) and when the current one is due. */
  pickSeconds?: number;
  pickDueAt?: string | null;
}

/** Time left, floored at zero — an overrun reads as 0:00 rather than counting up past the limit. */
function countdown(dueIso: string, nowMs: number): string {
  const ms = Math.max(0, Date.parse(dueIso) - nowMs);
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function elapsed(sinceIso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(sinceIso);
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DraftClockClient({ teamId, eventId }: { teamId: number; eventId: number }) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pool, setPool] = useState<WarRoom | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastPickedCount = useRef<number>(-1);

  const fetchPool = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/team/${teamId}/pool`);
      if (res.ok) setPool((await res.json()) as WarRoom);
    } catch {
      /* the clock keeps working without ratings */
    }
  }, [teamId]);

  const fetchDraft = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/events/${eventId}/draft`);
      if (!res.ok) return;
      const data = (await res.json()) as DraftState;
      setDraft(data);
      // A pick landed (or the page just opened) — the pool's tiers are relative to who's left, so
      // it has to be re-read, but only then.
      if (data.totalPicked !== lastPickedCount.current) {
        lastPickedCount.current = data.totalPicked;
        void fetchPool();
      }
    } catch {
      /* transient — the next tick covers it */
    }
  }, [eventId, fetchPool]);

  useEffect(() => {
    void fetchDraft();
    const id = setInterval(fetchDraft, DRAFT_POLL_MS);
    return () => clearInterval(id);
  }, [fetchDraft]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Shortlisting mid-draft is a real move ("I'll take them next round"), so the drawer's buttons
  // work here too. Same whole-list contract as the war room; the pool refetch reflects it back.
  const writeShortlist = useCallback(
    async (personKeys: string[], notes?: Record<string, string>) => {
      setPool((prev) =>
        prev
          ? {
              ...prev,
              people: prev.people.map((p) => ({
                ...p,
                shortlistAt: personKeys.indexOf(p.personKey) >= 0 ? personKeys.indexOf(p.personKey) : null,
                shortlistNote: notes?.[p.personKey] ?? p.shortlistNote,
              })),
            }
          : prev,
      );
      try {
        await clanFetch(`/api/team/${teamId}/pool`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personKeys, notes: notes ?? {} }),
        });
      } catch {
        /* the optimistic list stands; the next pool refetch corrects it */
      }
    },
    [teamId],
  );

  const currentOrder = useCallback(
    () =>
      (pool?.people ?? [])
        .filter((p) => p.shortlistAt != null)
        .sort((a, b) => (a.shortlistAt ?? 0) - (b.shortlistAt ?? 0))
        .map((p) => p.personKey),
    [pool],
  );

  const toggleShortlist = useCallback(
    (personKey: string) => {
      const order = currentOrder();
      void writeShortlist(order.includes(personKey) ? order.filter((k) => k !== personKey) : [...order, personKey]);
    },
    [currentOrder, writeShortlist],
  );

  const noteFor = useCallback(
    (personKey: string, note: string) => {
      const order = currentOrder();
      void writeShortlist(order.includes(personKey) ? order : [...order, personKey], { [personKey]: note });
    },
    [currentOrder, writeShortlist],
  );

  const pick = useCallback(
    async (person: WarRoomPerson) => {
      setPicking(true);
      setError('');
      try {
        const res = await clanFetch(`/api/events/${eventId}/draft/pick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: person.leadPlayerId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'That pick did not go through');
        } else {
          setOpenKey(null);
        }
        await fetchDraft();
      } finally {
        setPicking(false);
      }
    },
    [eventId, fetchDraft],
  );

  const isMyTurn = draft?.status === 'active' && draft.currentTeamId === teamId;
  const currentTeam = draft?.teams.find((t) => t.id === draft.currentTeamId) ?? null;

  // When the last pick landed — what the clock counts from. Falls back to nothing rather than
  // inventing a start time.
  const lastPickAt = useMemo<string | null>(() => {
    const picked = (draft?.players ?? []).filter((p) => p.pickedAt);
    if (picked.length === 0) return null;
    return picked.map((p) => p.pickedAt as string).sort().at(-1) ?? null;
  }, [draft]);

  // Memoized so every derived list below doesn't rebuild on each render of the 1s clock tick.
  const people = useMemo(() => pool?.people ?? [], [pool]);
  const available = useMemo(() => people.filter((p) => p.teamId == null), [people]);
  const shortlisted = useMemo(
    () =>
      available
        .filter((p) => p.shortlistAt != null)
        .sort((a, b) => (a.shortlistAt ?? 0) - (b.shortlistAt ?? 0)),
    [available],
  );
  const rest = useMemo(() => available.filter((p) => p.shortlistAt == null), [available]);
  const topOfList = shortlisted[0] ?? null;

  const myRoster = useMemo(() => people.filter((p) => p.teamId === teamId), [people, teamId]);
  const myCoverage = useMemo(() => new Set(myRoster.flatMap((p) => p.domains)), [myRoster]);

  // How many picks happen before this captain is up again — the window that decides who they can
  // still afford to wait on.
  const picksUntilMine = useMemo(() => {
    if (!draft || draft.teamOrder.length === 0) return null;
    if (!draft.teamOrder.includes(teamId)) return null;
    // Walked with the same helper the server picks with, rather than re-deriving snake order here —
    // two implementations of "whose turn is it" is exactly the bug that shows up at pick 14.
    const start = draft.currentTeamId === teamId ? draft.currentPickNumber + 1 : draft.currentPickNumber;
    for (let i = start, gap = 0; i < start + draft.teamOrder.length * 4; i++, gap++) {
      if (getTeamForPick(draft.teamOrder, i) === teamId) return gap;
    }
    return null;
  }, [draft, teamId]);

  // The best of what's left, capped at what could plausibly go before this captain is up again.
  // `available` is already rating-sorted by the server, so this is a head, not a re-sort.
  const likelyGone = useMemo(() => {
    if (picksUntilMine == null || picksUntilMine === 0) return [];
    return available.slice(0, Math.min(picksUntilMine, 4));
  }, [available, picksUntilMine]);

  const recent = useMemo(() => {
    const picked = (draft?.players ?? [])
      .filter((p) => p.teamId != null && p.pickedAt)
      .sort((a, b) => (b.pickedAt ?? '').localeCompare(a.pickedAt ?? ''))
      .slice(0, 6);
    const teamById = new Map((draft?.teams ?? []).map((t) => [t.id, t]));
    return picked.map((p) => ({ ...p, team: p.teamId != null ? teamById.get(p.teamId) ?? null : null }));
  }, [draft]);

  if (!draft) return <div className="text-center py-16 text-text-muted">Loading the draft…</div>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-5 content-start">
        {/* The clock */}
        <section
          className={`rounded-xl border p-4 sm:p-5 flex items-center gap-4 flex-wrap ${
            isMyTurn ? 'border-accent-green/40 bg-accent-green/[0.07]' : 'border-card-border bg-card-bg'
          }`}
        >
          <div className="min-w-0">
            <div className="text-lg font-bold">
              {draft.status === 'paused'
                ? 'The draft is paused'
                : isMyTurn
                  ? "It's your pick."
                  : `Waiting for ${currentTeam?.name ?? 'the next team'}`}
            </div>
            <div className="text-sm text-text-muted mt-0.5">
              {/* round/pick are 0-based on the wire; nobody counts rounds from zero out loud. */}
              Round {draft.round + 1} · pick {draft.currentPickNumber + 1} · {draft.poolRemaining} left in the pool
            </div>
          </div>

          {isMyTurn && topOfList && (
            <button
              type="button"
              disabled={picking}
              onClick={() => pick(topOfList)}
              className="px-4 py-2.5 text-sm font-bold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {picking ? 'Picking…' : `Pick ${topOfList.rsn} — top of your shortlist`}
            </button>
          )}

          {/* With a per-pick clock the honest number is time REMAINING, and a captain must see it —
              a deadline only the host can see is a trap. Without one it counts up from the last
              pick, and before the first pick there's nothing to count from at all. */}
          {draft.pickSeconds && draft.pickSeconds > 0 && draft.pickDueAt ? (
            <div
              className={`ml-auto font-mono text-2xl font-bold tabular-nums ${
                Date.parse(draft.pickDueAt) - now <= 0
                  ? 'text-red-400'
                  : isMyTurn
                    ? 'text-accent-green-light'
                    : 'text-text-muted'
              }`}
              title={`${draft.pickSeconds}s per pick`}
            >
              {countdown(draft.pickDueAt, now)}
            </div>
          ) : lastPickAt ? (
            <div
              className={`ml-auto font-mono text-2xl font-bold tabular-nums ${
                isMyTurn ? 'text-accent-green-light' : 'text-text-muted'
              }`}
              title="Time since the last pick"
            >
              {elapsed(lastPickAt, now)}
            </div>
          ) : null}
        </section>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        {/* Pool, shortlist first */}
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Pool</h2>
            <span className="ml-auto text-xs text-text-muted">
              {available.length} left · shortlist first
            </span>
          </div>

          {!pool ? (
            <p className="text-sm text-text-muted">Rating the pool…</p>
          ) : (
            <>
              {shortlisted.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-bold mb-2">
                    Your shortlist
                  </div>
                  <div className="grid gap-1.5">
                    {shortlisted.map((p) => (
                      <PoolRow
                        key={p.personKey}
                        person={p}
                        rank={(p.shortlistAt ?? 0) + 1}
                        canPick={isMyTurn}
                        picking={picking}
                        onPick={pick}
                        onOpen={setOpenKey}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-bold mb-2">
                Everyone else
              </div>
              <div className="grid gap-1.5">
                {rest.slice(0, 25).map((p) => (
                  <PoolRow
                    key={p.personKey}
                    person={p}
                    canPick={isMyTurn}
                    picking={picking}
                    onPick={pick}
                    onOpen={setOpenKey}
                  />
                ))}
                {rest.length > 25 && (
                  <p className="text-xs text-text-muted pt-1">
                    +{rest.length - 25} more — use the{' '}
                    <ClanLink href={`/team/${teamId}/applicants`} className="text-gold hover:text-gold-light">
                      war room
                    </ClanLink>{' '}
                    to search and shortlist.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Who won't last */}
        {picksUntilMine != null && picksUntilMine > 0 && likelyGone.length > 0 && (
          <section className="border border-card-border rounded-xl bg-card-bg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="text-lg font-semibold">Before your next pick</h2>
              <span className="ml-auto text-xs text-text-muted">{picksUntilMine} picks away</span>
            </div>
            <p className="text-xs text-text-muted mb-3">
              The best of what&rsquo;s left, against the {picksUntilMine} picks that happen before
              you&rsquo;re up again. Take the ones you can&rsquo;t replace.
            </p>
            <div className="grid gap-1.5">
              {likelyGone.map((p) => (
                <div
                  key={p.personKey}
                  className="flex items-center gap-2.5 text-sm border border-card-border rounded-lg px-2.5 py-2 bg-brown-dark/40"
                >
                  <TierChip tier={p.tier} />
                  <button
                    type="button"
                    onClick={() => setOpenKey(p.personKey)}
                    className="font-medium hover:text-gold-light truncate"
                  >
                    {p.rsn}
                  </button>
                  <span className="ml-auto text-xs text-text-muted">
                    {p.domains.filter((d) => !myCoverage.has(d)).length > 0
                      ? `covers ${p.domains
                          .filter((d) => !myCoverage.has(d))
                          .map((d) => DOMAIN_LABEL[d] ?? d)
                          .join(', ')}`
                      : 'you already cover this'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Rail */}
      <div className="grid gap-5 content-start">
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Your roster</h2>
            <span className="ml-auto text-xs text-text-muted">{myRoster.length}</span>
          </div>
          {myRoster.length === 0 ? (
            <p className="text-sm text-text-muted">Nobody yet — your first pick is coming.</p>
          ) : (
            <div className="grid gap-1.5">
              {myRoster.map((p) => (
                <div
                  key={p.personKey}
                  className="flex items-center gap-2 text-sm border border-card-border rounded-lg px-2.5 py-2 bg-brown-dark/40"
                >
                  <TierChip tier={p.tier} />
                  <button
                    type="button"
                    onClick={() => setOpenKey(p.personKey)}
                    className="truncate hover:text-gold-light"
                  >
                    {p.rsn}
                  </button>
                  {p.pickNumber != null && (
                    <span className="ml-auto font-mono text-[11px] text-text-muted">pick {p.pickNumber + 1}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-bold mb-2">
              Coverage so far
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['raids', 'endgame-pvm', 'midgame-pvm', 'wildy-pvp'] as const).map((d) => (
                <span
                  key={d}
                  className={`text-[11px] px-2 py-0.5 rounded border ${
                    myCoverage.has(d)
                      ? 'border-gold-dark/60 bg-gold/10 text-foreground'
                      : 'border-dashed border-card-border text-text-muted'
                  }`}
                >
                  {DOMAIN_LABEL[d]} {myCoverage.has(d) ? '✓' : '—'}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Draft order</h2>
            <span className="ml-auto text-xs text-text-muted">round {draft.round + 1}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {draft.teamOrder.map((tid) => {
              const t = draft.teams.find((x) => x.id === tid);
              const isNow = draft.currentTeamId === tid;
              return (
                <span
                  key={tid}
                  title={t?.name}
                  className={`w-6 h-6 rounded grid place-items-center text-[10px] font-bold text-brown-dark ${
                    isNow ? 'ring-2 ring-foreground' : 'opacity-60'
                  }`}
                  style={{ backgroundColor: t?.color ?? '#8a7e6c' }}
                >
                  {tid === teamId ? '★' : ''}
                </span>
              );
            })}
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-text-muted">No picks yet.</p>
          ) : (
            <div className="grid">
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-xs py-1.5 border-b border-card-border/50 last:border-b-0"
                >
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: p.team?.color ?? '#8a7e6c' }}
                  />
                  <span className="text-text-muted truncate">
                    {p.team?.name ?? 'A team'} took <span className="text-foreground font-medium">{p.name}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {draft.balanceMode === 'tiered-snake' && (
          <section className="border border-violet-500/35 bg-violet-500/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1 h-5 bg-violet-400 rounded-full" />
              <h2 className="text-lg font-semibold">Tiered snake is on</h2>
            </div>
            <p className="text-sm text-text-muted">
              You can&rsquo;t take a second <b className="text-gold-light">S</b> or{' '}
              <b className="text-violet-300">A</b> while another team has none. If a pick is refused,
              that&rsquo;s why — the message says which tier.
            </p>
          </section>
        )}
      </div>

      <PlayerDrawer
        person={openKey ? people.find((p) => p.personKey === openKey) ?? null : null}
        onClose={() => setOpenKey(null)}
        onToggleShortlist={toggleShortlist}
        onNote={noteFor}
        canPick={isMyTurn}
        onPick={pick}
      />
    </div>
  );
}

function PoolRow({
  person,
  rank,
  canPick,
  picking,
  onPick,
  onOpen,
}: {
  person: WarRoomPerson;
  rank?: number;
  canPick: boolean;
  picking: boolean;
  onPick: (p: WarRoomPerson) => void;
  onOpen: (key: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 border rounded-lg px-2.5 py-2 ${
        rank ? 'border-gold/25 bg-gold/[0.04]' : 'border-card-border bg-brown-dark/40'
      }`}
    >
      {rank && <span className="font-mono text-[11px] text-gold-light w-4">{rank}</span>}
      <TierChip tier={person.tier} />
      <button
        type="button"
        onClick={() => onOpen(person.personKey)}
        className="min-w-0 text-left hover:text-gold-light"
      >
        <span className="font-medium text-sm">{person.rsn}</span>
        <span className="block text-[11px] text-text-muted truncate">
          {person.domains.map((d) => DOMAIN_LABEL[d] ?? d).join(' · ') || 'no markers'}
          {person.answers?.timezone ? ` · ${person.answers.timezone}` : ''}
        </span>
      </button>
      {canPick && (
        <button
          type="button"
          disabled={picking}
          onClick={() => onPick(person)}
          className="ml-auto shrink-0 text-xs font-semibold px-2.5 py-1.5 bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
        >
          Pick
        </button>
      )}
    </div>
  );
}
