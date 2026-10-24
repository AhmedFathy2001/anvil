'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The platform's "hide this clan" switch (clans.platform_hidden). It overrides the clan's own
 * visibility and listing choices on every public surface, and is logged in the clan's audit log.
 */
export default function PlatformHiddenToggle({ clanId, hidden }: { clanId: number; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/staff/clans/${clanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformHidden: !hidden }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-gray-300">
        {hidden ? (
          <>This clan is <span className="text-gold">hidden by the platform</span>.</>
        ) : (
          <>This clan follows its own listing settings.</>
        )}
      </p>
      <p className="text-xs text-text-muted">
        Hidden keeps it off the clans directory, leaderboards, the home feed, search, player profiles, the sitemap and
        monthly Wrapped, and shows its Discord card (and off-site embed/badge) to its own members only — whatever the
        clan chose. Its members notice nothing.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-200 hover:border-gold/60 disabled:opacity-50"
      >
        {busy ? 'Saving…' : hidden ? 'Unhide' : 'Hide from public'}
      </button>
    </div>
  );
}
