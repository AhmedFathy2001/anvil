'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import type { PendingRequest } from '@/lib/guestAdmission';

/**
 * Who has asked to join this clan, and staff's answer.
 *
 * The queue itself was complete before this existed: `admit()` writes a `clan_join_requests` row
 * whenever the clan's policy is `approval`, and `/api/admin/clan/requests` has always been able to
 * list and decide them. Nothing rendered it. `clanJoinRequests` was referenced by exactly one file
 * in the codebase — the one that writes it — so every person who asked was told to wait for an
 * answer from a queue no one could see.
 *
 * Moderator-or-better, matching the route: deciding who is on the roster is roster work, the same
 * tier that can already remove somebody.
 */
export default function JoinRequests({ initial }: { initial: PendingRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function decide(id: number, decision: 'approve' | 'reject') {
    setBusyId(id);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'That didn’t work');
      setRequests((v) => v.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-gold/30 bg-gold/[0.05] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold text-gold">
          Asking to join
          <span className="ml-2 text-[12px] font-normal text-text-muted">
            {requests.length} waiting
          </span>
        </h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                <span className="text-gold">{r.rsn}</span>
                {/* Somebody else's member is the single most useful thing staff can be told here, and
                    it is not a private fact — it is on the in-game roster. */}
                {r.memberOf && <span className="text-text-muted"> · member of {r.memberOf}</span>}
              </div>
              <div className="text-[12.5px] text-text-muted">
                {r.message
                  ? r.message
                  : r.source === 'web'
                    ? 'Applied from the site.'
                    : 'Turned up through the plugin.'}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide(r.id, 'approve')}
                disabled={busyId === r.id}
                className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(r.id, 'reject')}
                disabled={busyId === r.id}
                className="rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:border-accent-red/40 hover:text-accent-red disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[12.5px] text-accent-red">{error}</p>}
    </section>
  );
}
