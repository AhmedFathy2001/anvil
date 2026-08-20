'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';

interface RenameSuggestion {
  leftMemberId: number;
  joinedMemberId: number;
  oldRsn: string;
  newRsn: string;
  rank: string | null;
  leftAt: string;
  joinedAt: string;
  deltaSeconds: number;
  leftXp: number | null;
  joinedXp: number | null;
  xpMatchPct: number | null;
}

export interface AuditEntry {
  id: number;
  clanMemberId: number | null;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  actorDisplayName: string | null;
  notes: string | null;
  occurredAt: string;
  memberRsn: string | null;
}

export interface LeftMember {
  id: number;
  rsn: string;
  leftAt: string;
  rank: string | null;
}

export interface JoinedMember {
  id: number;
  rsn: string;
  joinedAt: string;
  rank: string | null;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  joined: { label: 'Joined', color: 'text-accent-green-light' },
  left: { label: 'Left', color: 'text-red-400' },
  returned: { label: 'Returned', color: 'text-accent-green-light' },
  renamed: { label: 'Renamed', color: 'text-yellow-400' },
  verified: { label: 'Verified', color: 'text-gold' },
  claimed: { label: 'Claimed', color: 'text-gold' },
  merged: { label: 'Merged', color: 'text-purple-400' },
  rename_dismissed: { label: 'Not a rename', color: 'text-text-muted' },
  mod_approved: { label: 'Mod approved', color: 'text-accent-green-light' },
  mod_rejected: { label: 'Mod rejected', color: 'text-red-400' },
  user_signed_up: { label: 'Signed up', color: 'text-text-muted' },
  signup_approved: { label: 'Sign-up approved', color: 'text-accent-green-light' },
  signup_rejected: { label: 'Sign-up rejected', color: 'text-red-400' },
  signup_withdrawn: { label: 'Sign-up withdrawn', color: 'text-yellow-400' },
  signup_admin_added: { label: 'Signed up by admin', color: 'text-gold' },
  signup_answers_edited: { label: 'Sign-up answers edited', color: 'text-text-muted' },
  captain_promoted: { label: 'Captain promoted', color: 'text-gold' },
  captain_demoted: { label: 'Captain demoted', color: 'text-text-muted' },
  fee_confirmed: { label: 'Fee confirmed', color: 'text-accent-green-light' },
};

export default function AuditLogClient({
  entries,
  leftMembers,
  activeMembers,
}: {
  entries: AuditEntry[];
  leftMembers: LeftMember[];
  activeMembers: JoinedMember[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [showMerge, setShowMerge] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous re-entry lock for the mutating actions (merge/confirm/dismiss). The
  // buttons' `disabled` prop only updates after a React re-render, so a burst of rapid
  // native clicks can all fire their handler before that — firing the same merge 3+ times.
  // A ref flips synchronously on the first click and blocks the rest until the request
  // settles.
  const actionLock = useRef(false);

  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [actingOn, setActingOn] = useState<number | null>(null); // joinedMemberId currently being merged/dismissed
  const [dismissed, setDismissed] = useState<Set<number>>(new Set()); // joinedMemberId

  useEffect(() => {
    let cancelled = false;
    clanFetch('/api/admin/clan/suspected-renames')
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data: { suggestions: RenameSuggestion[] }) => {
        if (!cancelled) {
          setSuggestions(data.suggestions ?? []);
          setSuggestionsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmSuggestion(s: RenameSuggestion) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActingOn(s.joinedMemberId);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: s.leftMemberId,
          targetId: s.joinedMemberId,
          note: `Approved as rename: ${s.oldRsn} → ${s.newRsn} (${s.deltaSeconds}s apart, rank ${s.rank ?? 'unknown'})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Merge failed');
      } else {
        // Drop this suggestion from the list and refresh the audit feed below.
        setSuggestions((prev) => prev.filter((p) => p.joinedMemberId !== s.joinedMemberId));
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setActingOn(null);
      actionLock.current = false;
    }
  }

  async function dismissSuggestion(s: RenameSuggestion) {
    if (actionLock.current) return;
    actionLock.current = true;
    // Optimistically hide it, then persist so it doesn't return on the next load.
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(s.joinedMemberId);
      return next;
    });
    setActingOn(s.joinedMemberId);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/suspected-renames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftMemberId: s.leftMemberId, joinedMemberId: s.joinedMemberId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save dismissal — it may reappear.');
        // Roll back the optimistic hide so the mod can retry.
        setDismissed((prev) => {
          const next = new Set(prev);
          next.delete(s.joinedMemberId);
          return next;
        });
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(s.joinedMemberId);
        return next;
      });
    } finally {
      setActingOn(null);
      actionLock.current = false;
    }
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.joinedMemberId));

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.eventType === filter);
  }, [entries, filter]);

  async function doMerge() {
    if (!sourceId || !targetId) return;
    if (actionLock.current) return;
    actionLock.current = true;
    setMerging(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Merge failed');
      } else {
        setShowMerge(false);
        setSourceId(null);
        setTargetId(null);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setMerging(false);
      actionLock.current = false;
    }
  }

  return (
    <div>
      {/* Suspected renames — heuristic matches of left+joined pairs that look like renames */}
      {!suggestionsLoading && visibleSuggestions.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-yellow-300 flex items-center gap-2">
                <span className="w-1 h-5 bg-yellow-500 rounded-full" />
                Suspected renames
                <span className="text-xs font-normal text-text-muted">({visibleSuggestions.length})</span>
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Left+joined pairs from the same sync, sharing a rank, whose Hiscores XP matches
                closely enough to be the same account. Confirm to merge histories, or dismiss if unrelated.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {visibleSuggestions.map((s) => {
              const busy = actingOn === s.joinedMemberId;
              return (
                <li
                  key={s.joinedMemberId}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-brown-dark/40 border border-yellow-500/20 rounded-lg flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      <span className="text-red-400">{s.oldRsn}</span>
                      <span className="text-text-muted mx-2">→</span>
                      <span className="text-accent-green-light">{s.newRsn}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {s.rank ? <>rank: <span className="text-foreground/80">{s.rank}</span> · </> : null}
                      {s.deltaSeconds}s apart · {new Date(s.joinedAt).toLocaleString()}
                    </div>
                    {s.leftXp != null && s.joinedXp != null && (
                      <div className="text-[11px] text-accent-green-light/80 mt-0.5">
                        XP match: {s.leftXp.toLocaleString()} → {s.joinedXp.toLocaleString()}
                        {s.xpMatchPct != null && <span className="text-text-muted"> ({s.xpMatchPct}% diff)</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => dismissSuggestion(s)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 border border-card-border text-text-muted hover:text-foreground hover:bg-brown-light rounded transition-colors disabled:opacity-50"
                    >
                      Not a rename
                    </button>
                    <button
                      onClick={() => confirmSuggestion(s)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 rounded transition-colors disabled:opacity-50"
                    >
                      {busy ? 'Merging…' : 'Confirm rename'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Filter</span>
          <Select
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter by event type"
            className="w-56 max-w-full"
            options={[
              { value: 'all', label: 'All events' },
              ...Object.entries(EVENT_LABELS).map(([value, meta]) => ({ value, label: meta.label })),
            ]}
          />
        </div>
        <button
          onClick={() => setShowMerge((v) => !v)}
          className="px-3 py-1.5 text-sm bg-purple-500/15 border border-purple-500/40 text-purple-300 hover:bg-purple-500/25 rounded-lg transition-colors"
        >
          {showMerge ? 'Close merge tool' : 'Merge two members'}
        </button>
      </div>

      {showMerge && (
        <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground/80 mb-3">
            Select the &ldquo;left&rdquo; record (source) and the active record it should be merged into (target).
            All event history, weekly participation, and audit entries from source will move to target.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Source (left)</label>
              <Select
                value={sourceId == null ? '' : String(sourceId)}
                onChange={(v) => setSourceId(v ? Number(v) : null)}
                ariaLabel="Source (left record)"
                placeholder="— pick a left record —"
                options={leftMembers.map((m) => ({
                  value: String(m.id),
                  label: `${m.rsn} (left ${new Date(m.leftAt).toLocaleDateString()})`,
                }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Target (active)</label>
              <Select
                value={targetId == null ? '' : String(targetId)}
                onChange={(v) => setTargetId(v ? Number(v) : null)}
                ariaLabel="Target (active record)"
                placeholder="— pick an active record —"
                options={activeMembers.map((m) => ({
                  value: String(m.id),
                  label: `${m.rsn} (joined ${new Date(m.joinedAt).toLocaleDateString()})`,
                }))}
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="flex justify-end mt-3">
            <button
              onClick={doMerge}
              disabled={!sourceId || !targetId || merging || sourceId === targetId}
              className="bg-purple-500 hover:bg-purple-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {merging ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      )}

      <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-text-muted text-sm p-8 text-center">No matching audit entries.</div>
        ) : (
          <ul className="divide-y divide-card-border">
            {filtered.map((e) => {
              // Unknown types (not in EVENT_LABELS) can be long ALL_CAPS_SNAKE tokens — de-snake them
              // so they wrap at spaces instead of overflowing the fixed-width label column into the RSN.
              const meta = EVENT_LABELS[e.eventType] ?? {
                label: e.eventType.replace(/_/g, ' '),
                color: 'text-foreground',
              };
              return (
                <li key={e.id} className="px-4 py-3 flex flex-wrap items-start gap-x-4 gap-y-1">
                  <div
                    className={`text-xs font-semibold uppercase tracking-wide w-32 shrink-0 break-words leading-snug ${meta.color}`}
                  >
                    {meta.label}
                  </div>
                  {/* On phones the detail drops to its own full-width line under label + timestamp */}
                  <div className="flex-1 min-w-0 basis-full order-last sm:basis-0 sm:order-none">
                    <div className="text-sm">
                      {e.memberRsn || (() => {
                        try {
                          if (e.newValue) {
                            const parsed = JSON.parse(e.newValue);
                            return parsed.rsn || parsed.discordUsername || `member ${e.clanMemberId ?? '?'}`;
                          }
                        } catch {}
                        return `member ${e.clanMemberId ?? '?'}`;
                      })()}
                      {e.oldValue && (() => {
                        try {
                          const parsed = JSON.parse(e.oldValue);
                          if (parsed.rsn && e.eventType === 'renamed') {
                            return <span className="text-text-muted text-xs ml-2">was {parsed.rsn}</span>;
                          }
                        } catch {}
                        return null;
                      })()}
                    </div>
                    {e.notes && <div className="text-xs text-text-muted mt-0.5">{e.notes}</div>}
                  </div>
                  <div className="text-[11px] text-text-muted shrink-0 text-right ml-auto sm:ml-0">
                    <div>{new Date(e.occurredAt).toLocaleString()}</div>
                    {e.actorDisplayName && <div className="opacity-70">by {e.actorDisplayName}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
