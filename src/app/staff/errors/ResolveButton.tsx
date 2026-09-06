'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * "I have looked at this."
 *
 * Not a fix and not a mute: the next occurrence clears it again (lib/errorEvents), because a failure
 * that came back is news whatever anybody ticked last week. It exists so two operators looking at
 * the same list can tell what the other has already picked up.
 */
export default function ResolveButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/errors/${id}/resolve`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not resolve.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={resolve}
        disabled={busy}
        className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-50"
      >
        {busy ? 'Resolving…' : 'Mark resolved'}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
