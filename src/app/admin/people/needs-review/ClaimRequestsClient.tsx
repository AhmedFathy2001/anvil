'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';
import type { ClaimRequest } from '@/lib/claimRequests';

/**
 * Claim requests — a mod vouching that a person is the member they say they are.
 *
 * These appear because the plugin refused to auto-claim an established member on a public RSN (the
 * takeover fix). A request names a Discord identity and the roster member it wants; the mod's job is
 * the one a machine cannot do — recognise the person. Approve binds it; reject leaves the member to
 * prove it themselves by XP.
 *
 * The distinction from the verifications list below: those are members who ALREADY proved control by
 * XP and want a confirmation stamp; these have NOT proved anything, and the mod's recognition is
 * standing in for the proof. So the copy leans on identity ("do you know this person?") rather than
 * on a method.
 */
export default function ClaimRequestsClient({ items }: { items: ClaimRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: number, action: 'approve' | 'reject') {
    setBusyId(id);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/claim-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Action failed');
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[16.5px] font-semibold">Claim requests</h2>
      </div>
      <p className="mb-3.5 ml-4 max-w-[64ch] text-[13.5px] text-text-muted">
        Someone is asking to link one of your members&rsquo; accounts. A public name is no longer proof
        of ownership, so approve only if you recognise the person — otherwise leave it, and they can
        prove it themselves by training the account a little.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="space-y-3">
        {items.map((r) => {
          const busy = busyId === r.id;
          return (
            <div key={r.id} className="rounded-xl border border-card-border bg-card-bg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {r.requester.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.requester.avatarUrl} alt="" width={40} height={40} className="mt-0.5 rounded-full" />
                  ) : (
                    <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 font-semibold text-gold">
                      {(r.requester.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {/* The line a mod reads: this PERSON wants this CHARACTER. */}
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                      <span className="truncate">{r.requester.displayName ?? 'Someone'}</span>
                      {r.requester.discordUsername && (
                        <span className="text-xs font-normal text-text-muted">@{r.requester.discordUsername}</span>
                      )}
                      <span className="text-text-muted">wants</span>
                      <span className="truncate text-gold">{r.rsn}</span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Seen playing it {new Date(r.requestedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => act(r.id, 'reject')}
                    disabled={busy}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Not them
                  </button>
                  <button
                    onClick={() => act(r.id, 'approve')}
                    disabled={busy}
                    className="rounded-lg border border-accent-green/40 bg-accent-green/20 px-3 py-1.5 text-sm text-accent-green-light transition-colors hover:bg-accent-green/30 disabled:opacity-50"
                  >
                    Yes, that&rsquo;s them
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
