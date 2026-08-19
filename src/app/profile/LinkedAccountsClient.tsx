'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type LinkedAccount = {
  id: number;
  rsn: string;
  isPrimary: boolean;
  verified: boolean;
  verificationMethod: string | null;
  provisional: boolean;
  inActiveEvent: boolean;
  /** Live event this account is playing, if any — the reason Remove is disabled. */
  playingIn: string | null;
  /** Last plugin push for this account. */
  lastPingAt: string | null;
  /** Visible to clans this account is NOT in. Off by default. */
  shared: boolean;
  /** Sharing is set on the ACCOUNT; `id` above is the per-clan seat. */
  accountId: number;
};

const METHOD_LABEL: Record<string, string> = {
  plugin: 'Verified by the plugin',
  stat_delta: 'Verified by XP gain',
  manual: 'Verified by a moderator',
};

// The account list with per-account Make primary / Remove. Removing unlinks the account from the
// profile; it's blocked (button disabled) while the account is in a live event — the server
// enforces the same rule. After a successful action we refresh so the server-rendered list and the
// detected-accounts inbox both reflect the change.
export default function LinkedAccountsClient({ accounts }: { accounts: LinkedAccount[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

  // Publish this account to clans it is NOT in.
  //
  // Clans you are in can already see the account you are in them with — a seat IS that clan knowing.
  // This is about the rest: whether a clan you are applying to, or playing against, gets a name or a
  // blank. Off by default and instantly reversible, so no confirm step.
  async function setShared(accountId: number, shared: boolean) {
    setSharingId(accountId);
    setError('');
    try {
      const res = await fetch(`/api/profile/accounts/${accountId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Could not change that.');
        return;
      }
      router.refresh();
    } finally {
      setSharingId(null);
    }
  }

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
          className="flex items-center gap-3 flex-wrap border border-card-border rounded-lg px-3.5 py-3 bg-brown-dark/40"
        >
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              {m.rsn}
              {m.isPrimary && (
                <span
                  className="text-[10px] uppercase tracking-wider font-bold bg-gold/15 text-gold-light border border-gold/40 px-1.5 py-0.5 rounded"
                  title="Names your team in per-person events and leads your Discord nickname"
                >
                  ★ primary
                </span>
              )}
              {m.provisional && (
                <span
                  className="text-[10px] uppercase tracking-wider font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded"
                  title="Verified via stat-delta — awaiting moderator confirmation"
                >
                  provisional
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {m.verified ? (
                <>
                  <span className="text-accent-green-light">✓</span>{' '}
                  {METHOD_LABEL[m.verificationMethod ?? ''] ?? `Verified via ${m.verificationMethod ?? 'link'}`}
                </>
              ) : (
                <span className="text-yellow-400">Not verified yet</span>
              )}
              {m.playingIn ? (
                <> · playing {m.playingIn}</>
              ) : m.lastPingAt && nowMs !== null ? (
                <> · last seen {ago(m.lastPingAt, nowMs)}</>
              ) : null}
            </div>
          </div>
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none"
              title={
                m.shared
                  ? 'On: clans you are NOT in can also see this account.'
                  : 'Off: only clans you are in — which already have it on their roster — can see this account.'
              }
            >
              <input
                type="checkbox"
                checked={m.shared}
                disabled={sharingId === m.accountId}
                onChange={(e) => setShared(m.accountId, e.target.checked)}
                className="accent-gold"
              />
              Share
            </label>
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

function ago(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
