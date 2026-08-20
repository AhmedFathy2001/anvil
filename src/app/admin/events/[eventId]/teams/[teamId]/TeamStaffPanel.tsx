'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import type { TeamStaffRow } from '@/lib/teamStaff';
import { clanFetch } from '@/lib/clanFetch';

interface UserRow {
  id: number;
  displayName: string;
  discordId: string | null;
  discordUsername: string | null;
  role: string;
}

/**
 * Extra people who can run this team, alongside the captain.
 *
 * The case this exists for: a clan-v-clan where the other side's moderator needs to manage their
 * own 25 without an admin account here — and without taking the captain's seat off the person
 * actually playing.
 */
export default function TeamStaffPanel({ teamId }: { teamId: number }) {
  const router = useRouter();
  const [staff, setStaff] = useState<TeamStaffRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/admin/teams/${teamId}/staff`);
      if (res.ok) setStaff((await res.json()).staff ?? []);
    } catch {
      /* the list stays as it was */
    }
  }, [teamId]);

  useEffect(() => {
    void load();
    clanFetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((data) => setUsers(Array.isArray(data) ? data : data.people ?? []))
      .catch(() => setUsers([]));
  }, [load]);

  const held = useMemo(() => new Set(staff.map((s) => s.userId)), [staff]);
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Only Discord-linked accounts can sign in to use a seat.
    const linked = users.filter((u) => Boolean(u.discordId) && !held.has(u.id));
    if (!q) return linked.slice(0, 8);
    return linked
      .filter((u) => `${u.displayName} ${u.discordUsername ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, search, held]);

  const grant = async (userId: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/teams/${teamId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not add them');
        return;
      }
      setStaff(data.staff ?? []);
      setSearch('');
      setNote('');
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/teams/${teamId}/staff?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not remove them');
        return;
      }
      setStaff(data.staff ?? []);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-base font-bold">Team staff</h2>
        <span className="text-xs text-text-muted">{staff.length} beside the captain</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-xs font-semibold px-3 py-1.5 border border-card-border rounded-lg hover:border-gold/40 transition-colors"
        >
          {open ? 'Close' : 'Add someone'}
        </button>
      </div>
      <p className="text-xs text-text-muted mb-3 max-w-[75ch]">
        Extra people who can run <b>this team only</b> — its roster, its submissions and proof, and
        marking its players&rsquo; fees paid. They can&rsquo;t touch another team, edit the board, make
        draft picks, or sub anyone out once the event is live. For a clan-v-clan, this is how the
        visiting side&rsquo;s moderator runs their own half.
      </p>

      {staff.length > 0 && (
        <div className="grid gap-1.5 mb-3">
          {staff.map((s) => (
            <div
              key={s.userId}
              className="flex items-center gap-2.5 border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {s.displayName}
                  {s.discordUsername && <span className="text-text-muted font-normal"> · @{s.discordUsername}</span>}
                </div>
                {s.note && <div className="text-xs text-text-muted truncate">{s.note}</div>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => revoke(s.userId)}
                className="ml-auto shrink-0 text-xs px-2.5 py-1.5 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="border border-card-border rounded-lg p-3 bg-brown-dark/30">
          <div className="grid gap-2 sm:grid-cols-2 mb-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Discord-linked people…"
              aria-label="Search people"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note, e.g. Ironforge's mod"
              maxLength={120}
              aria-label="Note"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="text-xs text-text-muted">Nobody matches — they need a linked Discord account.</p>
          ) : (
            <div className="grid gap-1">
              {candidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy}
                  onClick={() => grant(u.id)}
                  className="flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-lg border border-card-border hover:border-gold/40 hover:bg-gold/5 transition-colors disabled:opacity-50"
                >
                  <span className="truncate">{u.displayName}</span>
                  {u.discordUsername && (
                    <span className="text-xs text-text-muted truncate">@{u.discordUsername}</span>
                  )}
                  <span className="ml-auto text-xs text-gold">Give a seat</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  );
}
