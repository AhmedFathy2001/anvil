'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';

export interface PendingMember {
  id: number;
  rsn: string;
  verifiedAt: string | null;
  verificationMethod: string | null;
  claimedAt: string | null;
  notes: string | null;
  user: {
    id: number;
    displayName: string | null;
    discordUsername: string | null;
    avatarUrl: string | null;
  } | null;
}

export default function VerificationsClient({ items }: { items: PendingMember[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: number, action: 'approve' | 'reject', note?: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/verifications/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Action failed');
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-8 text-center text-text-muted">
        Nothing to review. Provisional verifications will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      {items.map((m) => {
        const busy = pendingId === m.id;
        const isManualPending = m.verificationMethod === 'manual' && !m.verifiedAt;
        const methodLabel = isManualPending
          ? 'manual request'
          : m.verificationMethod
            ? `via ${m.verificationMethod}`
            : 'unverified';
        return (
          <div
            key={m.id}
            className="border border-card-border rounded-xl bg-card-bg p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {m.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.avatarUrl} alt="" width={40} height={40} className="rounded-full mt-0.5" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-gold/20 text-gold flex items-center justify-center font-semibold mt-0.5">
                    {(m.user?.displayName || m.rsn || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                    {m.rsn}
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        isManualPending
                          ? 'bg-orange-500/20 text-orange-300'
                          : m.verificationMethod === 'stat_delta'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-brown-light text-text-muted'
                      }`}
                    >
                      {methodLabel}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {m.user
                      ? `${m.user.displayName}${m.user.discordUsername ? ` · @${m.user.discordUsername}` : ''}`
                      : 'No linked user'}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {m.verifiedAt
                      ? `Verified ${new Date(m.verifiedAt).toLocaleString()}`
                      : m.claimedAt
                        ? `Requested ${new Date(m.claimedAt).toLocaleString()}`
                        : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => act(m.id, 'reject')}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => act(m.id, 'approve')}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
            {m.notes && (
              <div className="mt-3 pt-3 border-t border-card-border/50 text-sm text-foreground/80 whitespace-pre-wrap">
                <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">User note</div>
                {m.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
