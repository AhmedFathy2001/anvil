'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Publish one of your own characters, or stop — on the PERSON's page.
 *
 * The same control exists inside the clan locker (profile/LinkedAccountsClient), but that surface is
 * reachable only from within a clan, and sharing is not a clan-shaped decision: it is the one thing
 * a person says about themselves to clans they are NOT in. Leaving it only there had a visible
 * consequence — `accounts.shared` was false for every account on the platform, so `/u/<id>` and
 * `/p/<rsn>` 404'd for everyone and the leaderboard's Players table was permanently empty. A whole
 * slice of the product was dark because its only switch was behind a door most people never open.
 *
 * PATCHes the same person-scoped endpoint, which takes no clan and refuses to touch anyone else's
 * account. Off by default and instantly reversible, so there is no confirm step.
 */
export default function ShareToggle({
  accountId,
  shared,
  rsn,
}: {
  accountId: number;
  shared: boolean;
  rsn: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/profile/accounts/${accountId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !shared }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Could not change that.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not change that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={shared ? `Stop sharing ${rsn}` : `Share ${rsn}`}
        className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
          shared
            ? 'border-gold/40 text-gold hover:bg-gold/10'
            : 'border-card-border text-text-muted hover:text-foreground hover:bg-brown-light'
        }`}
      >
        {busy ? '…' : shared ? 'Shared' : 'Private'}
      </button>
    </span>
  );
}
