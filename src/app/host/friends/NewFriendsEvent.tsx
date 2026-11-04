'use client';

import { useState } from 'react';

/**
 * "New friends event": makes the person's hidden friends host on first use (POST /api/friends/host)
 * and goes to its quick event screen. A full navigation: it crosses from the apex into the host.
 */
export default function NewFriendsEvent({ label = 'New friends event' }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends/host', { method: 'POST' });
      const data: { next?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.next) {
        setError(data.error ?? 'That didn’t work. Try again.');
        return;
      }
      window.location.assign(data.next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="rounded-xl bg-gold px-5 py-3 text-base font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-60"
      >
        {busy ? 'Opening…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
