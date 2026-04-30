'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  mod_approved: { label: 'Mod approved', color: 'text-accent-green-light' },
  mod_rejected: { label: 'Mod rejected', color: 'text-red-400' },
  user_signed_up: { label: 'Signed up', color: 'text-text-muted' },
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

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.eventType === filter);
  }, [entries, filter]);

  const filterOptions = ['all', ...Object.keys(EVENT_LABELS)];

  async function doMerge() {
    if (!sourceId || !targetId) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/clan/merge', {
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
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {filterOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                filter === opt
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'border border-card-border text-text-muted hover:text-foreground hover:bg-brown-light'
              }`}
            >
              {opt === 'all' ? 'All' : EVENT_LABELS[opt]?.label ?? opt}
            </button>
          ))}
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
              <select
                value={sourceId ?? ''}
                onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
              >
                <option value="">— pick a left record —</option>
                {leftMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rsn} (left {new Date(m.leftAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-text-muted mb-1">Target (active)</label>
              <select
                value={targetId ?? ''}
                onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
              >
                <option value="">— pick an active record —</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rsn} (joined {new Date(m.joinedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
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
              const meta = EVENT_LABELS[e.eventType] ?? { label: e.eventType, color: 'text-foreground' };
              return (
                <li key={e.id} className="px-4 py-3 flex items-start gap-4">
                  <div className={`text-xs font-semibold uppercase tracking-wide w-28 shrink-0 ${meta.color}`}>
                    {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
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
                  <div className="text-[11px] text-text-muted shrink-0 text-right">
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
