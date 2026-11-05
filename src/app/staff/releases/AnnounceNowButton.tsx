'use client';

import { useState } from 'react';

/** "Announce now" for a silent release: production posts it on its next tick. */
export default function AnnounceNowButton({ version }: { version: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    const res = await fetch('/api/staff/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announce: version }),
    }).catch(() => null);
    setState(res?.ok ? 'done' : 'error');
  }
  if (state === 'done') return <span className="text-xs text-gold">Queued: posts within a minute on production.</span>;
  return (
    <button
      type="button"
      onClick={go}
      disabled={state === 'busy'}
      className="rounded-lg border border-gold/40 px-2.5 py-1 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
    >
      {state === 'busy' ? 'Queuing…' : state === 'error' ? 'Try again' : 'Announce now'}
    </button>
  );
}
