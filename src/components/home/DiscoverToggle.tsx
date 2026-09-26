'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Turns the apex home's "Open to everyone" feed off (a quiet "Hide" beside its title) or back on (a
 * one-line offer where it used to be). The page re-renders from the server either way.
 */
export default function DiscoverToggle({ show, variant }: { show: boolean; variant: 'hide' | 'offer' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set() {
    setBusy(true);
    try {
      const res = await fetch('/api/profile/discover-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'hide') {
    return (
      <button
        type="button"
        onClick={set}
        disabled={busy}
        className="ml-auto text-[13px] text-text-muted hover:text-gold disabled:opacity-50"
      >
        {busy ? 'Hiding…' : 'Hide'}
      </button>
    );
  }
  return (
    <p className="text-[13px] text-text-muted">
      Public events from other clans are hidden.{' '}
      <button
        type="button"
        onClick={set}
        disabled={busy}
        className="text-gold-dark hover:text-gold disabled:opacity-50"
      >
        {busy ? 'Showing…' : 'Show them again'}
      </button>
    </p>
  );
}
