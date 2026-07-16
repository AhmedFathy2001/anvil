'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { avatarUrl } from '@/lib/discord-oauth';
import Input from '@/components/Input';

interface UserRow {
  id: number;
  displayName: string;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  role: string;
}

interface Props {
  teamId: number;
  currentCaptainUserId: number | null;
}

export default function CaptainAssignment({ teamId, currentCaptainUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : { people: [] }))
      // The endpoint now returns { people, unlinked }; tolerate the old bare-array shape too.
      .then((data) => setUsers(Array.isArray(data) ? data : data.people ?? []))
      .catch(() => setUsers([]));
  }, []);

  const current = useMemo(() => users.find((u) => u.id === currentCaptainUserId) ?? null, [users, currentCaptainUserId]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Only Discord-linked users can be assigned — anyone else can't actually claim the seat.
    const linked = users.filter((u) => Boolean(u.discordId));
    if (!q) return linked.slice(0, 10);
    return linked
      .filter((u) =>
        `${u.displayName} ${u.discordUsername ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [users, search]);

  async function assign(userId: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/captain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save');
      } else {
        setOpen(false);
        setSearch('');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h3 className="font-semibold">Team Captain</h3>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          {open ? 'Close' : current ? 'Change' : 'Assign'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {current ? (
          <>
            {current.discordId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl(current.discordId, current.discordAvatar) || ''}
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
            ) : (
              <span className="w-9 h-9 rounded-full bg-gold/20 text-gold flex items-center justify-center font-semibold">
                {current.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{current.displayName}</div>
              <div className="text-xs text-text-muted truncate">
                {current.discordUsername ? `@${current.discordUsername}` : 'No Discord linked'}
              </div>
            </div>
            <button
              onClick={() => assign(null)}
              disabled={saving}
              className="ml-auto px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Unassign
            </button>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            No Discord captain assigned. Team uses captain password fallback.
          </p>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-card-border pt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Discord-linked users…"
            className="w-full bg-brown-light border border-card-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="text-text-muted text-sm py-2">No matching users.</p>
            ) : (
              candidates.map((u) => {
                const avatar = u.discordId ? avatarUrl(u.discordId, u.discordAvatar) : null;
                return (
                  <button
                    key={u.id}
                    onClick={() => assign(u.id)}
                    disabled={saving || u.id === currentCaptainUserId}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-brown-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" width={28} height={28} className="rounded-full" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs">
                        {u.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{u.displayName}</div>
                      <div className="text-xs text-text-muted truncate">
                        {u.discordUsername && `@${u.discordUsername}`}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase text-text-muted">{u.role}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
