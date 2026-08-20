'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';

interface Props {
  eventId: number;
  /** Editing currently refused (finished + not unlocked). */
  locked: boolean;
  /** Only admins may flip the lock; others see the state without the button. */
  canToggle: boolean;
}

// Shown on every admin tab of a FINISHED event (past end date / force-ended). Finished events are
// read-only — the API refuses content mutations (lib/eventLock) — so this explains why buttons
// fail and, for admins, offers the explicit unlock for corrections (and re-lock when done).
export default function EventLockBanner({ eventId, locked, canToggle }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setLock(unlock: boolean) {
    if (
      unlock &&
      !confirm(
        'Unlock editing on this finished event? Teams, players, tiles, completions and submissions become editable again — results can change. Lock it again when you\'re done.',
      )
    )
      return;
    setBusy(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: unlock ? 'unlock-editing' : 'lock-editing' }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
        <span aria-hidden>🔒</span>
        <p className="text-sm text-text-muted flex-1 min-w-[16rem]">
          This event has finished — editing is locked so the recorded results can&apos;t drift.
          {canToggle ? ' Unlock it to make corrections.' : ' An admin can unlock it for corrections.'}
        </p>
        {canToggle && (
          <button
            onClick={() => setLock(true)}
            disabled={busy}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {busy ? '…' : 'Unlock editing'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
      <span aria-hidden>🔓</span>
      <p className="text-sm text-amber-200/90 flex-1 min-w-[16rem]">
        Editing is unlocked on this finished event — changes can alter the recorded results. Lock it
        again when you&apos;re done.
      </p>
      {canToggle && (
        <button
          onClick={() => setLock(false)}
          disabled={busy}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
        >
          {busy ? '…' : 'Lock editing'}
        </button>
      )}
    </div>
  );
}
