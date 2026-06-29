'use client';

import { useState } from 'react';

type Detected = { id: number; rsn: string; lastSeenAt: string };

// Opt-in inbox for accounts the plugin saw this user play but that aren't linked yet. Add
// attaches + verifies the account; Ignore opts out (the server keeps it dismissed so it
// won't be re-suggested). The whole section hides itself once the list is empty.
export default function DetectedAccountsClient({ initial }: { initial: Detected[] }) {
  const [accounts, setAccounts] = useState<Detected[]>(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function act(id: number, action: 'link' | 'dismiss') {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/profile/detected-accounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (action === 'link' ? 'Could not add account' : 'Could not ignore account'));
        return;
      }
      setAccounts((list) => list.filter((a) => a.id !== id));
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setBusyId(null);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <section className="border border-gold/30 bg-gold/5 rounded-xl p-5 mt-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">Accounts we noticed you playing</h2>
        </div>
        <span className="text-xs text-text-muted">{accounts.length}</span>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Your plugin played these RuneScape accounts but they aren&rsquo;t linked to your profile yet.
        Add the ones that are yours; ignore the rest and we won&rsquo;t ask again.
      </p>
      <div className="space-y-2">
        {accounts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 border border-card-border rounded-lg p-3 bg-brown-dark/40"
          >
            <div className="font-medium truncate">{a.rsn}</div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => act(a.id, 'dismiss')}
                disabled={busyId === a.id}
                className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-text-muted transition-colors disabled:opacity-50"
              >
                Ignore
              </button>
              <button
                type="button"
                onClick={() => act(a.id, 'link')}
                disabled={busyId === a.id}
                className="px-3 py-1.5 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {busyId === a.id ? 'Working…' : 'Add to my accounts'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </section>
  );
}
