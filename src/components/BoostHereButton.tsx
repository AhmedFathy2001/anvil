'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** "Boost this clan": puts one free slot on the viewer's seat here (api/profile/boosts). */
export default function BoostHereButton({ seatId }: { seatId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function boost() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/boosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'place', seatId }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'That didn’t work.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={boost}
        disabled={busy}
        className="rounded-lg border border-[#ff7ab8]/45 bg-[#ff7ab8]/10 px-3 py-1.5 text-[13px] font-medium text-[#ffc2de] transition-colors hover:bg-[#ff7ab8]/20 disabled:opacity-50"
      >
        {busy ? '…' : 'Boost this clan'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </>
  );
}
