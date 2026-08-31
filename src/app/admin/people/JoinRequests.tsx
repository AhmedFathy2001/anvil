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
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  function toggle(id: number) {
    setPicked((v) => {
      const next = new Set(v);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * One row or a selection — the same call either way, because the route takes `ids`.
   *
   * A partial batch answers 207 with what went through and what did not, so a request somebody else
   * answered while this page was open drops out of the list rather than failing the whole action.
   */
  async function decide(ids: number[], decision: 'approve' | 'reject') {
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, decision }),
      });
      const data = await res.json().catch(() => null);
      const done: number[] = data?.done ?? [];
      const failed: { id: number; error: string }[] = data?.failed ?? [];
      if (!res.ok && done.length === 0) throw new Error(data?.error ?? failed[0]?.error ?? 'That didn’t work');
      const settled = new Set([...done, ...failed.map((f) => f.id)]);
      setRequests((v) => v.filter((r) => !settled.has(r.id)));
      setPicked(new Set());
      if (failed.length > 0) {
        setError(`${failed.length} could not be decided — somebody may have answered them already.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
        {requests.length > 1 && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] text-text-muted">
            <input
              type="checkbox"
              checked={picked.size === requests.length}
              onChange={() =>
                setPicked(picked.size === requests.length ? new Set() : new Set(requests.map((r) => r.id)))
              }
              className="h-3.5 w-3.5 accent-gold"
            />
            Select all
          </label>
        )}
      </div>

      {picked.size > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-background px-3.5 py-2.5">
          <span className="text-[13px] font-medium">{picked.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => decide([...picked], 'approve')}
              disabled={busy}
              className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Approve {picked.size}
            </button>
            <button
              type="button"
              onClick={() => decide([...picked], 'reject')}
              disabled={busy}
              className="rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:border-accent-red/40 hover:text-accent-red disabled:opacity-50"
            >
              Decline {picked.size}
            </button>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 sm:flex-row sm:items-center"
          >
            <input
              type="checkbox"
              checked={picked.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Select ${r.rsn}`}
              className="mt-1 h-3.5 w-3.5 shrink-0 self-start accent-gold sm:mt-0 sm:self-center"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {/* THE EVIDENCE, because there is nowhere else to get it. There is no messaging on the
                    site and a stranger is not in your Discord, so the decision has to be makeable from
                    the row: who they are, where they play, and whether they have proved the name. */}
                <a
                  href={`/p/${encodeURIComponent(r.rsn)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold-light hover:underline"
                >
                  {r.rsn}
                </a>
                {r.memberOf ? (
                  <span className="text-text-muted"> · member of {r.memberOf}</span>
                ) : (
                  <span className="text-text-muted"> · in no clan</span>
                )}
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
                onClick={() => decide([r.id], 'approve')}
                disabled={busy}
                className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide([r.id], 'reject')}
                disabled={busy}
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
