'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatHoursRange } from '@/lib/signup';
import type { WarRoom, WarRoomPerson } from '@/lib/warRoom';
import { rosterShape } from '@/lib/rosterShape';
import RosterShapePanel from '@/components/RosterShapePanel';
import PlayerDrawer, { DOMAIN_LABEL, TierChip } from './PlayerDrawer';
import { clanFetch } from '@/lib/clanFetch';
import Input from '@/components/Input';

// The captain's scouting surface: the pool with everything known about it, and their own shortlist
// over the top. Replaces a flat applicant list that had no ordering, no filtering, and nowhere to
// put a plan — so the plan lived in a Discord DM until the draft started.

const DOMAINS = ['raids', 'endgame-pvm', 'midgame-pvm', 'wildy-pvp'] as const;

type Filter = 'all' | 'shortlist' | 'top' | 'played' | (typeof DOMAINS)[number];

const FILTERS: { key: Filter; label: string; hint?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'shortlist', label: 'My shortlist' },
  { key: 'top', label: 'S & A only' },
  ...DOMAINS.map((d) => ({ key: d as Filter, label: DOMAIN_LABEL[d] })),
  { key: 'played', label: 'Played before' },
];

export default function WarRoomClient({ teamId }: { teamId: number }) {
  const [data, setData] = useState<WarRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The shortlist is edited locally and pushed on a debounce: reordering is a rapid series of
  // clicks, and a round-trip per click would make the list feel like it was fighting back.
  const [order, setOrder] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/team/${teamId}/pool`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load the pool');
      const room = body as WarRoom;
      setData(room);
      setOrder(
        room.people
          .filter((p) => p.shortlistAt != null)
          .sort((a, b) => (a.shortlistAt ?? 0) - (b.shortlistAt ?? 0))
          .map((p) => p.personKey),
      );
      setNotes(
        Object.fromEntries(
          room.people.filter((p) => p.shortlistNote).map((p) => [p.personKey, p.shortlistNote as string]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the pool');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    (nextOrder: string[], nextNotes: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await clanFetch(`/api/team/${teamId}/pool`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personKeys: nextOrder, notes: nextNotes }),
          });
        } catch {
          /* the list is still on screen; the next edit retries */
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [teamId],
  );

  const byKey = useMemo(() => new Map((data?.people ?? []).map((p) => [p.personKey, p])), [data]);

  const toggleShortlist = useCallback(
    (personKey: string) => {
      setOrder((prev) => {
        const next = prev.includes(personKey) ? prev.filter((k) => k !== personKey) : [...prev, personKey];
        persist(next, notes);
        return next;
      });
    },
    [notes, persist],
  );

  const move = useCallback(
    (personKey: string, delta: number) => {
      setOrder((prev) => {
        const i = prev.indexOf(personKey);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        persist(next, notes);
        return next;
      });
    },
    [notes, persist],
  );

  const setNote = useCallback(
    (personKey: string, note: string) => {
      setNotes((prev) => {
        const next = { ...prev, [personKey]: note };
        // A note is an opinion about someone, which is the same signal as shortlisting them.
        setOrder((prevOrder) => {
          const nextOrder = note.trim() && !prevOrder.includes(personKey) ? [...prevOrder, personKey] : prevOrder;
          persist(nextOrder, next);
          return nextOrder;
        });
        return next;
      });
    },
    [persist],
  );

  const shown = useMemo(() => {
    const people = data?.people ?? [];
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (q && !p.rsn.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'shortlist':
          return order.includes(p.personKey);
        case 'top':
          return p.tier === 'S' || p.tier === 'A';
        case 'played':
          return p.evidenceEvents > 0;
        case 'all':
          return true;
        default:
          return p.domains.includes(filter);
      }
    });
  }, [data, filter, order, search]);

  // Coverage counts the pool that's still gettable, not the whole event — a domain nobody left has
  // is a different problem from one nobody ever had.
  const coverage = useMemo(() => {
    const available = (data?.people ?? []).filter((p) => p.teamId == null);
    const mine = data?.roster ?? [];
    return DOMAINS.map((d) => ({
      domain: d,
      inPool: available.filter((p) => p.domains.includes(d)).length,
      onRoster: mine.filter((p) => p.domains.includes(d)).length,
    }));
  }, [data]);

  // The roster's own sign-up answers, folded into a shape. Recomputed from the payload, so it moves
  // with every pick — which is the only version of this worth having during a live draft.
  const shape = useMemo(() => rosterShape((data?.roster ?? []).map((p) => p.answers ?? {})), [data]);

  if (loading) return <div className="text-center py-12 text-text-muted">Loading the pool…</div>;
  if (error) {
    return (
      <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">{error}</div>
    );
  }
  if (!data || data.people.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-card-border rounded-xl text-text-muted">
        Nobody in the pool yet. Once sign-ups are enrolled they show up here.
      </div>
    );
  }

  const openPerson = openKey ? byKey.get(openKey) ?? null : null;
  const shortlisted = order.map((k) => byKey.get(k)).filter((p): p is WarRoomPerson => !!p);
  const available = data.people.filter((p) => p.teamId == null).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-5 content-start">
        {data.unrated && (
          <div className="text-sm border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2.5 text-yellow-200/90">
            Nobody in this pool has been rated yet — the tiers below are placeholders until the stats sweep
            has seen them at least once.
          </div>
        )}

        {shape.answered > 0 && (
          <RosterShapePanel
            shape={shape}
            title="What you've drafted so far"
            note="from their sign-up answers"
            limit={6}
          />
        )}

        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">The pool</h2>
            <span className="ml-auto text-xs text-text-muted">
              {available} available · {data.people.length - available} taken
            </span>
          </div>

          <div className="flex gap-2 flex-wrap items-center mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a name…"
              aria-label="Search the pool"
              className="flex-1 min-w-[140px] rounded-lg py-1.5"
            />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  filter === f.key
                    ? 'bg-gold text-brown-dark border-gold'
                    : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Nobody matches that.</p>
          ) : (
            <div className="grid">
              {shown.map((p) => {
                const at = order.indexOf(p.personKey);
                const taken = p.teamId != null;
                return (
                  <div
                    key={p.personKey}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center py-2.5 px-1 border-b border-card-border/60 last:border-b-0 ${
                      taken ? 'opacity-45' : ''
                    } ${at >= 0 ? 'bg-gold/[0.04]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(p.personKey)}
                      className="text-left min-w-0 group"
                    >
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap group-hover:text-gold-light">
                        <TierChip tier={p.tier} />
                        <span className={taken ? 'line-through' : ''}>{p.rsn}</span>
                        {at >= 0 && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-gold/15 text-gold-light border border-gold/40 px-1.5 rounded">
                            shortlist · {at + 1}
                          </span>
                        )}
                        {p.subbedOutBefore && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 rounded">
                            subbed out
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted mt-1 flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-12 h-1 rounded-full bg-brown-light overflow-hidden">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
                              style={{ width: `${Math.round(p.rating * 100)}%` }}
                            />
                          </span>
                          <span className="font-mono">{p.rating.toFixed(2)}</span>
                        </span>
                        {p.domains.length > 0 && (
                          <span className="flex gap-1">
                            {p.domains.map((d) => (
                              <span
                                key={d}
                                className="text-[10px] px-1.5 rounded bg-brown-light border border-gold-dark/50 text-foreground/80"
                              >
                                {DOMAIN_LABEL[d] ?? d}
                              </span>
                            ))}
                          </span>
                        )}
                        {p.answers?.timezone && <span>{p.answers.timezone}</span>}
                        {formatHoursRange(p.answers?.activeDailyHours) && (
                          <span>{formatHoursRange(p.answers?.activeDailyHours)}h/day</span>
                        )}
                        <span>
                          {p.evidenceEvents === 0
                            ? 'no history'
                            : `${p.evidenceEvents} event${p.evidenceEvents === 1 ? '' : 's'}`}
                        </span>
                        {taken && <span className="text-foreground/70">taken by {p.teamName}</span>}
                      </div>
                    </button>

                    {!taken && (
                      <button
                        type="button"
                        onClick={() => toggleShortlist(p.personKey)}
                        className={`shrink-0 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
                          at >= 0
                            ? 'border-gold/40 text-gold-light bg-gold/10'
                            : 'border-card-border text-text-muted hover:text-foreground hover:border-gold/40'
                        }`}
                      >
                        {at >= 0 ? '★ Shortlisted' : '☆ Shortlist'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-5 content-start">
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Your shortlist</h2>
            <span className="ml-auto text-xs text-text-muted">
              {saving ? 'saving…' : order.length > 0 ? `${order.length} · in order` : 'empty'}
            </span>
          </div>

          {shortlisted.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nobody yet. Shortlist people from the pool and put them in the order you&rsquo;d take them —
              private to you, and one button takes the top name still available when you&rsquo;re on the clock.
            </p>
          ) : (
            <div className="grid gap-1.5">
              {shortlisted.map((p, i) => (
                <div
                  key={p.personKey}
                  className={`flex items-center gap-2 border border-card-border rounded-lg px-2.5 py-2 bg-brown-dark/40 ${
                    p.teamId != null ? 'opacity-45' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] text-text-muted w-4">{i + 1}</span>
                  <TierChip tier={p.tier} />
                  <button
                    type="button"
                    onClick={() => setOpenKey(p.personKey)}
                    className="min-w-0 text-left text-sm font-medium truncate hover:text-gold-light"
                  >
                    {p.teamId != null ? <span className="line-through">{p.rsn}</span> : p.rsn}
                  </button>
                  <span className="ml-auto flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(p.personKey, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${p.rsn} up`}
                      className="text-text-muted hover:text-foreground disabled:opacity-30 px-1"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(p.personKey, 1)}
                      disabled={i === shortlisted.length - 1}
                      aria-label={`Move ${p.rsn} down`}
                      className="text-text-muted hover:text-foreground disabled:opacity-30 px-1"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleShortlist(p.personKey)}
                      aria-label={`Remove ${p.rsn} from shortlist`}
                      className="text-text-muted hover:text-red-400 px-1"
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="text-lg font-semibold">Coverage</h2>
          </div>
          <p className="text-xs text-text-muted mb-3">
            What your roster can already attempt, against who&rsquo;s still available to fix a gap.
          </p>
          <div className="grid gap-2">
            {coverage.map((c) => (
              <div
                key={c.domain}
                className={`flex items-center gap-2 text-sm border rounded-lg px-2.5 py-2 ${
                  c.onRoster > 0 ? 'border-card-border bg-brown-dark/40' : 'border-dashed border-card-border'
                }`}
              >
                <span className={c.onRoster > 0 ? 'text-accent-green-light' : 'text-text-muted'}>
                  {c.onRoster > 0 ? '✓' : '—'}
                </span>
                <span>{DOMAIN_LABEL[c.domain]}</span>
                <span className="ml-auto font-mono text-[11px] text-text-muted">
                  {c.onRoster} yours · {c.inPool} left
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <PlayerDrawer
        person={
          openPerson
            ? {
                ...openPerson,
                shortlistAt: order.indexOf(openPerson.personKey) >= 0 ? order.indexOf(openPerson.personKey) : null,
                shortlistNote: notes[openPerson.personKey] ?? null,
              }
            : null
        }
        onClose={() => setOpenKey(null)}
        onToggleShortlist={toggleShortlist}
        onNote={setNote}
      />
    </div>
  );
}
