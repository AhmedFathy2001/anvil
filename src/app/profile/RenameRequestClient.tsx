'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';

type PendingRename = {
  id: number;
  clanMemberId: number;
  oldRsn: string;
  newRsn: string;
  status: string;
  resolution: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  approved: 'text-accent-green-light border-accent-green/30 bg-accent-green/10',
  rejected: 'text-red-400 border-red-500/30 bg-red-500/10',
};

// Changed your RSN in game? A moderator carries the history across, so a rename doesn't cost you
// your events, your milestones or your place on the boards. The API has always been here; this is
// the first UI for it.
export default function RenameRequestClient({
  accounts,
}: {
  accounts: { id: number; rsn: string }[];
}) {
  const router = useRouter();
  const [clanMemberId, setClanMemberId] = useState<number | null>(accounts[0]?.id ?? null);
  const [newRsn, setNewRsn] = useState('');
  const [requests, setRequests] = useState<PendingRename[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/rename-request')
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => alive && setRequests(d.requests ?? []))
      .catch(() => {
        /* the form still works without the history */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (!newRsn.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profile/rename-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanMemberId, newRsn: newRsn.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not submit the request');
        return;
      }
      setDone(true);
      setNewRsn('');
      router.refresh();
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setSaving(false);
    }
  }

  if (accounts.length === 0) return null;
  const open = requests.filter((r) => r.status === 'pending');

  return (
    <div>
      <div className="font-semibold text-sm">Name change</div>
      <p className="text-xs text-text-muted mt-0.5 max-w-[70ch]">
        Changed your RSN in game? Tell us the new name and a moderator moves your history — events,
        milestones and standings — across to it.
      </p>

      {open.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {open.map((r) => (
            <div
              key={r.id}
              className={`text-xs border rounded-lg px-3 py-2 ${STATUS_STYLE[r.status] ?? 'border-card-border'}`}
            >
              <span className="font-mono">{r.oldRsn}</span> → <span className="font-mono">{r.newRsn}</span> ·
              waiting on a moderator
            </div>
          ))}
        </div>
      )}

      {done && open.length === 0 && (
        <p className="text-xs text-accent-green-light mt-2.5">Sent — a moderator will pick it up.</p>
      )}

      <div className="flex flex-wrap gap-2 mt-2.5 max-w-[640px]">
        {accounts.length > 1 && (
          <select
            value={clanMemberId ?? ''}
            onChange={(e) => setClanMemberId(Number(e.target.value))}
            className="bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rsn}
              </option>
            ))}
          </select>
        )}
        <Input
          value={newRsn}
          onChange={(e) => setNewRsn(e.target.value)}
          placeholder="New RuneScape name"
          maxLength={12}
          className="flex-1 min-w-[200px] bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
        />
        <button
          type="button"
          onClick={submit}
          disabled={saving || newRsn.trim().length === 0}
          className="px-3.5 py-2 text-sm font-semibold border border-card-border rounded-lg hover:border-gold/40 transition-colors disabled:opacity-50"
        >
          {saving ? 'Sending…' : 'Request change'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
