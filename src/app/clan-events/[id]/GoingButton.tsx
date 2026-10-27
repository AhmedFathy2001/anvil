'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

/** "I'm going" for the occurrence on now or next; the count moves with it. */
export default function GoingButton({ id, initialGoing, initialCount, canSay, signedIn }: { id: number; initialGoing: boolean; initialCount: number; canSay: boolean; signedIn: boolean }) {
  const [going, setGoing] = useState(initialGoing);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    const r = await clanFetch(`/api/clan-events/${id}/going`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ going: !going }) });
    setBusy(false);
    const body = (await r.json().catch(() => ({}))) as { event?: { mine: boolean; going: number }; error?: string };
    if (!r.ok || !body.event) return setError(body.error ?? 'Couldn’t save that.');
    setGoing(body.event.mine);
    setCount(body.event.going);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canSay ? (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className={going ? 'rounded border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-50' : 'rounded bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50'}
        >
          {going ? 'You’re going ✓ · Not going' : 'I’m going'}
        </button>
      ) : (
        <p className="text-sm text-text-muted">{signedIn ? 'Members of this clan can say they’re going.' : 'Sign in to say you’re going.'}</p>
      )}
      <span className="text-sm text-text-muted">{count} going</span>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
