'use client';

import { useState } from 'react';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

interface Blocked { clanId: number; name: string; slug: string; createdAt: string }

/**
 * Settings → Blocked clans (lib/clanBlocks). A blocked clan's invites — clan-vs-clan competitions
 * and event co-hosting — are refused silently, and this clan can't invite it until it's unblocked.
 * Owner/admin only (the page is admin-gated; the API checks clan_staff again).
 */
export default function BlockedClans({ initial }: { initial: Blocked[] }) {
  const [blocked, setBlocked] = useState(initial);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That didn’t work');
      setBlocked(data.blocked ?? []);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Blocked clans
      </h2>
      <p className="mb-3 text-sm text-text-muted">
        Invites from a blocked clan — clan vs clan competitions and co-hosted events — are turned away quietly. They aren&rsquo;t
        told. You can&rsquo;t invite them either until you unblock them.
      </p>

      {blocked.length === 0 ? (
        <p className="mb-3 text-sm text-text-muted">No clans blocked.</p>
      ) : (
        <ul className="mb-3 divide-y divide-card-border/60 rounded-lg border border-card-border/70">
          {blocked.map((b) => (
            <li key={b.clanId} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {b.name} <span className="text-text-muted">/c/{b.slug}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => call(`/api/admin/clan-blocks?clanId=${b.clanId}`, { method: 'DELETE' })}
                className="rounded-lg border border-card-border px-3 py-1 text-sm text-text-muted hover:border-gold/60 hover:text-gold disabled:opacity-50"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (slug.trim() && (await call('/api/admin/clan-blocks', { method: 'POST', body: JSON.stringify({ slug: slug.trim() }) }))) setSlug('');
        }}
      >
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Clan address to block"
          aria-label="Clan address to block"
          className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-light px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy || !slug.trim()} className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground hover:border-red-400/50 disabled:opacity-50">
          Block
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
