'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type LinkedAccount = {
  id: number;
  rsn: string;
  isPrimary: boolean;
  verified: boolean;
  verificationMethod: string | null;
  provisional: boolean;
  inActiveEvent: boolean;
};

// The "RuneScape Accounts" list with per-account Make primary / Remove. Removing unlinks the
// account from the profile; it's blocked (button disabled) while the account is in a live event —
// the server enforces the same rule. After a successful action we refresh so the server-rendered
// list and the detected-accounts inbox both reflect the change.
export default function LinkedAccountsClient({ accounts }: { accounts: LinkedAccount[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Promote to primary — the account that names your team in per-person events and leads your
  // Discord nickname. Reversible, so no confirm step.
  async function makePrimary(id: number) {
    setPromotingId(id);
    setError('');
    try {
      const res = await fetch(`/api/profile/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not change your primary account');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setPromotingId(null);
    }
  }

  async function remove(id: number, rsn: string) {
    if (!confirm(`Remove ${rsn} from your account? You can add it back later by playing it with the plugin.`)) return;
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/profile/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not remove account');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {accounts.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-3 border border-card-border rounded-lg p-3 bg-brown-dark/40"
        >
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2">
              {m.rsn}
              {m.isPrimary && (
                <span
                  className="text-[10px] uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded"
                  title="Names your team in per-person events and leads your Discord nickname"
                >
                  primary
                </span>
              )}
              {m.provisional && (
                <span
                  className="text-[10px] uppercase tracking-wide bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded"
                  title="Verified via stat-delta — awaiting moderator confirmation"
                >
                  provisional
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted">
              {m.verified ? `Verified via ${m.verificationMethod}` : 'Not verified'}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {/* Only offered when there's something to switch to — a lone account is already primary. */}
            {!m.isPrimary && accounts.length > 1 && (
              <button
                type="button"
                onClick={() => makePrimary(m.id)}
                disabled={promotingId === m.id}
                title="Make this your primary account"
                className="px-3 py-1.5 text-sm border border-card-border rounded-lg text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-40"
              >
                {promotingId === m.id ? 'Setting…' : 'Make primary'}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(m.id, m.rsn)}
              disabled={m.inActiveEvent || busyId === m.id}
              title={m.inActiveEvent ? 'In an active event — removable once it ends' : 'Remove this account from your profile'}
              className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              {busyId === m.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
}
