'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';

/** Dismiss one "Needs a decision" line (it returns if it grows), or bring the dismissed ones back. */
export default function DismissDecision({ decisionKey, size, restore = false }: { decisionKey?: string; size?: number; restore?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await clanFetch('/api/staff/decisions/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restore ? { restore: true } : { key: decisionKey, size }),
    }).catch(() => null);
    router.refresh();
    setBusy(false);
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void go()}
      className={restore ? 'min-h-10 text-sm text-gold hover:text-gold-light disabled:opacity-50' : 'min-h-10 rounded-lg border border-card-border px-3 text-sm text-text-muted hover:border-gold/50 hover:text-gold disabled:opacity-50'}
      title={restore ? undefined : 'Hide this line. It comes back if it gets bigger.'}
    >
      {restore ? 'Show them' : 'Dismiss'}
    </button>
  );
}
