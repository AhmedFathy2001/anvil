'use client';

import { useCallback, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

interface FieldChange {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

interface HistoryEntry {
  id: number;
  tileId: number | null;
  tileLabel: string | null;
  action: 'created' | 'updated' | 'deleted' | 'imported' | 'reordered' | 'duplicated';
  changedFields: string | null;
  oldValue: string | null;
  newValue: string | null;
  occurredAt: string;
  actorUserId: number | null;
  actorName: string | null;
}

const ACTION_META: Record<HistoryEntry['action'], { label: string; cls: string }> = {
  created: { label: 'Created', cls: 'bg-accent-green/15 text-accent-green-light border-accent-green/30' },
  updated: { label: 'Edited', cls: 'bg-gold/15 text-gold border-gold/30' },
  deleted: { label: 'Deleted', cls: 'bg-red-400/10 text-red-400 border-red-400/25' },
  imported: { label: 'Imported', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  reordered: { label: 'Reordered', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  duplicated: { label: 'Duplicated', cls: 'bg-accent-green/10 text-accent-green-light border-accent-green/25' },
};

const FILTERS: { key: 'all' | HistoryEntry['action']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'updated', label: 'Edits' },
  { key: 'created', label: 'Created' },
  { key: 'duplicated', label: 'Duplicated' },
  { key: 'deleted', label: 'Deleted' },
  { key: 'imported', label: 'Imports' },
  { key: 'reordered', label: 'Reorders' },
];

// The database default is "YYYY-MM-DD HH:MM:SS" in UTC — parse as UTC, render local.
function parseUtc(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z');
}

function relativeTime(d: Date): string {
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

// Render a stored field value compactly. JSON arrays/objects are shown short; empty → "(empty)".
function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if ((t.startsWith('[') || t.startsWith('{'))) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.length ? parsed.map((x) => String(x)).join(', ') : '(none)';
        return t.length > 80 ? t.slice(0, 80) + '…' : t;
      } catch {
        /* not JSON — fall through */
      }
    }
    return v.length > 120 ? v.slice(0, 120) + '…' : v;
  }
  return String(v);
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// One-line summary of an import/reorder entry from its newValue counts.
function summaryLine(entry: HistoryEntry): string | null {
  const nv = safeParse<Record<string, number>>(entry.newValue);
  if (!nv) return null;
  if (entry.action === 'imported') {
    const parts: string[] = [];
    if (nv.applied) parts.push(`${nv.applied} edited`);
    if (nv.created) parts.push(`${nv.created} created`);
    if (nv.unchanged) parts.push(`${nv.unchanged} unchanged`);
    if (nv.ignored) parts.push(`${nv.ignored} ignored`);
    return parts.length ? parts.join(', ') : null;
  }
  if (entry.action === 'reordered') return nv.total ? `${nv.total} tiles reordered` : null;
  return null;
}

// Change history for the event's tiles: who created / edited / deleted / imported / reordered a
// tile, and (for edits) the old→new field diff. Collapsed by default; loads on first open.
export default function TileHistoryPanel({ eventId }: { eventId: number }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | HistoryEntry['action']>('all');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles/history`);
      if (!res.ok) throw new Error();
      setEntries(await res.json());
      setLoaded(true);
    } catch {
      setError('Could not load history.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Lazy-load the first time the panel is opened; the refresh button re-fetches thereafter.
  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (e.currentTarget.open && !loaded && !loading) load();
  }

  const shown = (entries ?? []).filter((e) => filter === 'all' || e.action === filter);

  return (
    <details className="mb-6 border border-card-border rounded-xl bg-card-bg group" onToggle={onToggle}>
      <summary className="cursor-pointer select-none list-none flex items-center gap-2 p-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Change history
        </h2>
        <span className="text-xs text-text-muted">who changed what, and when</span>
        <span className="ml-auto text-text-muted transition-transform group-open:rotate-90">▸</span>
      </summary>

      <div className="px-4 pb-4">
        {/* Filters + refresh */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f.key
                  ? 'bg-gold/15 text-gold border-gold/30'
                  : 'text-text-muted border-card-border hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto text-xs px-2.5 py-1 rounded-full border border-card-border text-text-muted hover:text-foreground disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && loaded && shown.length === 0 && (
          <p className="text-sm text-text-muted">No changes recorded yet.</p>
        )}

        <ol className="space-y-2">
          {shown.map((entry) => {
            const meta = ACTION_META[entry.action];
            const when = parseUtc(entry.occurredAt);
            const changes = safeParse<FieldChange[]>(entry.changedFields) ?? [];
            const summary = summaryLine(entry);
            return (
              <li key={entry.id} className="border border-card-border rounded-lg p-3 bg-brown-dark/40 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.cls}`}>
                    {meta.label}
                  </span>
                  {entry.action === 'updated' &&
                    safeParse<{ liveOverride?: boolean }>(entry.newValue)?.liveOverride && (
                      <span
                        title="A normally-frozen field was edited on a live event by an admin."
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30"
                      >
                        🔓 Live override
                      </span>
                    )}
                  {entry.tileLabel ? (
                    <span className="font-medium">{entry.tileLabel}</span>
                  ) : (
                    <span className="text-text-muted italic">board</span>
                  )}
                  <span className="ml-auto text-xs text-text-muted" title={when.toLocaleString()}>
                    {relativeTime(when)}
                  </span>
                </div>

                <div className="text-xs text-text-muted mt-1">
                  by {entry.actorName ?? 'Unknown'}
                </div>

                {/* Edited: field-by-field diff */}
                {entry.action === 'updated' && changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {changes.map((c, i) => (
                      <li key={i} className="text-xs flex flex-wrap items-baseline gap-1.5">
                        <span className="text-text-muted">{c.label}:</span>
                        <span className="line-through text-red-400/80">{formatValue(c.from)}</span>
                        <span className="text-text-muted">→</span>
                        <span className="text-accent-green-light">{formatValue(c.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Import / reorder summary */}
                {summary && <div className="text-xs text-text-muted mt-1.5">{summary}</div>}
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
