'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

interface Result {
  clanId: number;
  clanName: string;
  status: 'sent' | 'skipped' | 'failed';
}

/**
 * "Post rules to Discord". At the host's address it posts to every clan on the board; at a
 * co-host's, to that clan's own server (the route decides — see post-rules/route.ts). Reports per
 * clan, because "posted" means nothing to a host whose co-host never set up a channel.
 */
export default function PostRulesButton({ eventId, label = 'Post rules to Discord' }: { eventId: number; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/post-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not post the rules.');
      else setResults(d.results ?? []);
    } catch {
      setError('Could not post the rules.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={post}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-sm border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Posting…' : label}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {results && (
        <ul className="text-xs space-y-0.5">
          {results.length === 0 && <li className="text-text-muted">Nothing to post to.</li>}
          {results.map((r) => (
            <li key={r.clanId} className={r.status === 'sent' ? 'text-green-400' : r.status === 'failed' ? 'text-red-400' : 'text-text-muted'}>
              {r.clanName}:{' '}
              {r.status === 'sent'
                ? 'posted'
                : r.status === 'failed'
                  ? 'Discord refused the post'
                  : 'no channel set up (Integrations → Webhooks)'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
