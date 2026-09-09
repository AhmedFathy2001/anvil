'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';

/**
 * Acknowledging one item on the "needs you" queue.
 *
 * lib/adminAttention has carried a comment promising this since the queue was written — the key is
 * "used as a React key and to snooze one item without touching the rest" — and nothing implemented
 * it. So the card about fees held against a board that finished in July stood on the dashboard
 * every morning, correct and unactionable, next to the cards that were urgent. A queue you cannot
 * answer is a queue people stop reading, and that costs more than the item did.
 *
 * Only shown where the queue says an item may be put down. A board opening on Friday with no teams
 * has no snooze, and never will.
 */
export default function SnoozeButton({ itemKey, title }: { itemKey: string; title: string }) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);

  async function snooze() {
    const ok = await confirm({
      title: 'Put this down for a week?',
      body: `“${title}” comes back in seven days, or sooner if it gets worse. Everybody's dashboard here goes quiet about it, not just yours.`,
      confirmLabel: 'Snooze for a week',
      tone: 'default',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clanFetch('/api/admin/attention-snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: itemKey, days: 7 }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={snooze}
      disabled={busy}
      title="I know about this — stop showing it for a week"
      aria-label={`Snooze: ${title}`}
      className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-text-muted/70 transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-50"
    >
      {busy ? '…' : 'Snooze'}
    </button>
  );
}
