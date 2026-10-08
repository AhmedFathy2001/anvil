'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

interface SignupRow {
  id: number;
  status: string;
  signedUpAt: string | null;
  user: { displayName: string | null; discordUsername: string | null } | null;
  account: { rsn: string } | null;
  team: { name: string } | null;
}

const STATUS: Record<string, string> = {
  pending: 'text-yellow-300',
  approved: 'text-accent-green-light',
  rejected: 'text-accent-red',
  withdrawn: 'text-text-muted',
};

/**
 * This clan's own members' sign-ups on a co-hosted board: approve, reject, withdraw — nothing else.
 *
 * The routes are the host's (the event and its sign-ups live there), so they're called at the host's
 * address. They answer a co-host's staff with only the sign-ups held through this clan's seats.
 */
export default function CohostSignupsClient({ eventId, hostSlug }: { eventId: number; hostSlug: string }) {
  const { confirm } = useDialog();
  const base = `/c/${hostSlug}/api/admin/events/${eventId}/signups`;
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    // Deliberately the HOST's address (`/c/<host>/…`), where this event's sign-ups live; clanFetch
    // passes an already-prefixed path through untouched.
    const res = await clanFetch(base);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? 'Could not load sign-ups.');
      return;
    }
    setRows(data.signups ?? []);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(row: SignupRow, action: 'approve' | 'reject' | 'withdraw') {
    if (action !== 'approve') {
      const ok = await confirm({
        title: action === 'reject' ? 'Reject this sign-up?' : 'Withdraw this player?',
        body: action === 'withdraw' ? 'They come off the event roster, including their team.' : undefined,
        confirmLabel: action === 'reject' ? 'Reject' : 'Withdraw',
      });
      if (!ok) return;
    }
    setBusy(row.id);
    setError(null);
    try {
      const res = await clanFetch(`${base}/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'That didn’t work.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;
  const shown = filter === 'pending' ? rows.filter((r) => r.status === 'pending') : rows;
  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {(['pending', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 ${filter === f ? 'border-gold/60 text-gold' : 'border-card-border text-text-muted'}`}
          >
            {f === 'pending' ? `Waiting (${pending})` : `All (${rows.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-text-muted">
          {filter === 'pending' ? 'Nobody from your clan is waiting.' : 'Nobody from your clan has signed up yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-card-border rounded-lg border border-card-border">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.account?.rsn ?? r.user?.displayName ?? 'Unknown'}</div>
                <div className="text-[12px] text-text-muted">
                  {r.user?.discordUsername ? `@${r.user.discordUsername} · ` : ''}
                  <span className={STATUS[r.status] ?? ''}>{r.status}</span>
                  {r.team && ` · ${r.team.name}`}
                </div>
              </div>
              <div className="flex gap-2">
                {r.status === 'pending' && (
                  <>
                    <button disabled={busy !== null} onClick={() => act(r, 'approve')} className="rounded-md bg-gold px-2.5 py-1 text-[12px] font-semibold text-black disabled:opacity-50">
                      Approve
                    </button>
                    <button disabled={busy !== null} onClick={() => act(r, 'reject')} className="rounded-md border border-card-border px-2.5 py-1 text-[12px] disabled:opacity-50">
                      Reject
                    </button>
                  </>
                )}
                {r.status === 'approved' && (
                  <button disabled={busy !== null} onClick={() => act(r, 'withdraw')} className="rounded-md border border-accent-red/50 px-2.5 py-1 text-[12px] text-accent-red disabled:opacity-50">
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-accent-red">{error}</p>}
    </div>
  );
}
