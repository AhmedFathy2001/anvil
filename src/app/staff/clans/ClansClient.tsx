'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ClanRow } from '@/lib/platformView';

const STATUSES = ['active', 'suspended', 'archived'] as const;
const PLANS = ['free', 'bronze', 'silver', 'gold'] as const;

const STATUS_STYLE: Record<string, string> = {
  active: 'text-emerald-400',
  suspended: 'text-amber-400',
  archived: 'text-gray-500',
};

/**
 * The clan directory, with the lifecycle controls inline.
 *
 * Editing in the row rather than behind a detail page: there are four fields, and the operator is
 * nearly always comparing clans at the moment they change one.
 */
export default function ClansClient({ clans, canWrite }: { clans: ClanRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? clans.filter((c) => [c.name, c.slug, c.host, c.owner ?? ''].some((s) => s.toLowerCase().includes(needle)))
    : clans;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name, slug, host or owner…"
        className="mb-4 w-full rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-sm outline-none focus:border-gold"
      />

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">Clan</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Guests</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {shown.map((c) => (
              <tr key={c.id} className={busy === c.id ? 'opacity-50' : undefined}>
                <td className="px-4 py-3">
                  <a href={`https://${c.host}`} target="_blank" rel="noreferrer" className="font-medium hover:text-gold">
                    {c.name}
                  </a>
                  <div className="text-xs text-gray-500">{c.host}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{c.owner ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.members}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400">{c.guests}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.events}</td>
                <td className="px-4 py-3">
                  {canWrite ? (
                    <select
                      value={c.status}
                      disabled={busy != null}
                      onChange={(e) => patch(c.id, { status: e.target.value })}
                      className={`rounded-lg border border-card-border bg-brown-dark px-2 py-1 text-xs ${STATUS_STYLE[c.status] ?? ''}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs ${STATUS_STYLE[c.status] ?? ''}`}>{c.status}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canWrite ? (
                    <select
                      value={c.plan}
                      disabled={busy != null}
                      onChange={(e) => patch(c.id, { plan: e.target.value })}
                      className="rounded-lg border border-card-border bg-brown-dark px-2 py-1 text-xs"
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-300">{c.plan}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && <p className="mt-4 text-sm text-gray-500">No clan matches that.</p>}
    </div>
  );
}
