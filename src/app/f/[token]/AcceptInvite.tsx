'use client';

import { useState } from 'react';

/** "Join": accept the invite (POST /api/friends/invite), then the event's own page takes over. */
export default function AcceptInvite({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
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
        className="w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-60"
      >
        {busy ? 'Opening…' : 'Open the event'}
      </button>
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
