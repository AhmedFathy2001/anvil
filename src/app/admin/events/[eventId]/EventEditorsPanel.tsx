'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

// Admin-only panel (Overview tab) for granting board-scoped tile editing on THIS event. Adding a
// plain member auto-provisions the minimal login access they need to reach the Tiles tab; removing
// their last grant reverses it. Backed by /api/events/[eventId]/editors.

interface EditorRow {
  userId: number;
  displayName: string;
  discordUsername: string | null;
  role: string;
  editorScope: string;
  createdAt: string;
}
interface Candidate {
  id: number;
  displayName: string;
  discordUsername: string | null;
  role: string;
  editorScope: string;
}

function editsAllBoards(role: string, editorScope: string): boolean {
  return role === 'admin' || (role === 'editor' && editorScope === 'all');
}

export default function EventEditorsPanel({ eventId }: { eventId: number }) {
  const [editors, setEditors] = useState<EditorRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/events/${eventId}/editors`);
      if (res.ok) {
        const d = await res.json();
        setEditors(d.editors ?? []);
        setCandidates(d.candidates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grantedIds = useMemo(() => new Set(editors.map((e) => e.userId)), [editors]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidates
      .filter(
        (c) =>
          !grantedIds.has(c.id) &&
          (c.displayName.toLowerCase().includes(q) || (c.discordUsername ?? '').toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [query, candidates, grantedIds]);

  async function add(userId: number) {
    setBusyId(userId);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/editors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setQuery('');
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not add editor.');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(userId: number) {
    setBusyId(userId);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/editors?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not remove editor.');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border border-card-border rounded-xl p-5 bg-card-bg">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Board editors
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Let specific people build and edit <span className="text-foreground/80">only this board&apos;s</span> tiles,
        without the all-events Editor role. Adding a regular member gives them just enough access to
        reach this board&apos;s Tiles tab.
      </p>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <>
          {editors.length > 0 ? (
            <ul className="mb-4 divide-y divide-card-border/50">
              {editors.map((e) => (
                <li key={e.userId} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground truncate">{e.displayName}</span>
                    {e.discordUsername && (
                      <span className="text-xs text-text-muted ml-1.5 truncate">@{e.discordUsername}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light capitalize shrink-0">
                    {editsAllBoards(e.role, e.editorScope) ? 'edits all boards' : 'board editor'}
                  </span>
                  <button
                    onClick={() => remove(e.userId)}
                    disabled={busyId === e.userId}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {busyId === e.userId ? '…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted mb-4">No board editors yet.</p>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Add a board editor
          </label>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name or Discord…"
            className="text-sm"
          />
          {matches.length > 0 && (
            <ul className="mt-2 border border-card-border rounded-lg overflow-hidden divide-y divide-card-border/50">
              {matches.map((c) => {
                const redundant = editsAllBoards(c.role, c.editorScope);
                return (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2 bg-brown-dark/30">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-foreground truncate">{c.displayName}</span>
                      {c.discordUsername && (
                        <span className="text-xs text-text-muted ml-1.5 truncate">@{c.discordUsername}</span>
                      )}
                      {redundant && (
                        <span className="block text-[11px] text-text-muted">Already edits every board.</span>
                      )}
                    </div>
                    <button
                      onClick={() => add(c.id)}
                      disabled={busyId === c.id || redundant}
                      title={redundant ? 'This person already edits all boards' : undefined}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {busyId === c.id ? '…' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {query.trim() && matches.length === 0 && (
            <p className="mt-2 text-xs text-text-muted">No matching people.</p>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
