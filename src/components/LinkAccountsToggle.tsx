'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Whether the apex may show your shared characters as one person.
 *
 * Sits below the character list rather than beside any one of them, because it is not a property of
 * a character — it is the statement that two of them are the same human, which is a different and
 * larger disclosure than either being visible. It used to happen implicitly the moment a second
 * account was shared.
 */
export default function LinkAccountsToggle({
  linked,
  sharedCount,
}: {
  linked: boolean;
  sharedCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/link-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: !linked }),
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
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">Show these as the same player</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {linked
            ? 'Your shared characters are listed together on a public page, and each links to it.'
            : 'Your shared characters are public individually. Nothing says they belong to one person.'}
          {sharedCount < 2 && ' Takes effect once you have shared more than one.'}
        </p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`ml-auto shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
          linked
            ? 'border-gold/40 text-gold hover:bg-gold/10'
            : 'border-card-border text-text-muted hover:text-foreground hover:bg-brown-light'
        }`}
      >
        {busy ? '…' : linked ? 'Linked' : 'Not linked'}
      </button>
    </div>
  );
}
