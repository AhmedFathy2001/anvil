'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Ignored = { id: number; rsn: string; lastSeenAt: string };

// Collapsed "Ignored" list: accounts the user removed / opted out of. They won't auto-re-add on
// play; re-adding here routes through the same secure claim path (`link` → claimAccountForUser).
export default function IgnoredAccountsClient({ initial }: { initial: Ignored[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Ignored[]>(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function readd(id: number) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/profile/detected-accounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not re-add account');
        return;
      }
      setAccounts((list) => list.filter((a) => a.id !== id));
      router.refresh();
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setBusyId(null);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <details className="border border-card-border rounded-xl bg-card-bg group">
      <summary className="cursor-pointer select-none list-none px-5 py-3 flex items-center gap-2 text-sm font-medium">
        <span className="transition-transform group-open:rotate-90 text-text-muted" aria-hidden>▸</span>
        <span className="w-1 h-4 bg-text-muted/40 rounded-full" />
        Ignored accounts
        <span className="text-xs text-text-muted ml-auto">{accounts.length}</span>
      </summary>
      <div className="px-5 pb-4">
        <p className="text-sm text-text-muted mb-3">
          Accounts you removed. They won&rsquo;t re-add themselves when you play — re-add any that are yours.
        </p>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 border border-card-border rounded-lg p-3 bg-brown-dark/40"
            >
              <div className="font-medium truncate min-w-0 text-text-muted">{a.rsn}</div>
              <button
                type="button"
                onClick={() => readd(a.id)}
                disabled={busyId === a.id}
                className="shrink-0 px-3 py-1.5 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {busyId === a.id ? 'Working…' : 'Re-add'}
              </button>
            </div>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    </details>
  );
}
