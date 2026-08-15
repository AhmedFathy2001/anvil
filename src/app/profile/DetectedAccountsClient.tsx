'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Detected = { id: number; rsn: string; lastSeenAt: string };

// Opt-in inbox for accounts the plugin saw this user play but that aren't linked yet. Add attaches
// + verifies the account; Ignore opts out (the server keeps it dismissed so it won't be re-suggested).
//
// Renders as bare rows at the top of the "Your accounts" card rather than its own section: it's the
// same list, one state earlier, and a member shouldn't have to work out why their accounts are in
// two places on one page. Hides itself once the list is empty.
export default function DetectedAccountsClient({ initial }: { initial: Detected[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Detected[]>(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Relative time is client-only — a server-rendered "14 minutes ago" would hydrate against a
  // different minute and warn.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

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
      router.refresh();
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setBusyId(null);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-2 mb-2">
      {accounts.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 flex-wrap border border-gold/35 bg-gold/5 rounded-lg px-3.5 py-3"
        >
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {a.rsn}
              <span className="text-[10px] uppercase tracking-wider font-bold bg-gold/15 text-gold-light border border-gold/40 px-1.5 py-0.5 rounded">
                new
              </span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              We saw you play this{nowMs !== null ? ` ${ago(a.lastSeenAt, nowMs)}` : ''}. Yours?
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => act(a.id, 'dismiss')}
              disabled={busyId === a.id}
              className="px-3 py-1.5 text-sm text-text-muted border border-card-border rounded-lg hover:text-foreground transition-colors disabled:opacity-50"
            >
              Not mine
            </button>
            <button
              type="button"
              onClick={() => act(a.id, 'link')}
              disabled={busyId === a.id}
              className="px-3 py-1.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {busyId === a.id ? 'Working…' : 'Add to my profile'}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

function ago(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
