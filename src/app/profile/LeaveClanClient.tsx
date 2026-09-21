'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';

/**
 * Taking yourself off this clan's roster.
 *
 * Every other way a seat ends belongs to somebody else — a sync drops you, an admin removes you, a
 * ban bars you — and seats arrive without being asked for: added by hand, or created as a guest by
 * a plugin session while you were visiting. This is the half the person holds.
 *
 * The in-game case is stated BEFORE the button rather than as an error afterwards. Membership of a
 * clan that syncs its roster is the roster's word; a seat ended here would come back on the next
 * push, and being told that after clicking would read as the site refusing to let you leave.
 */
export default function LeaveClanClient({
  clanName,
  seat,
}: {
  clanName: string;
  /** 'guest' covers anything the in-game roster is not holding open — a visit, or a manual add. */
  seat: 'guest' | 'member-in-game';
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function leave() {
    const ok = await confirm({
      title: `Leave ${clanName}?`,
      body:
        `You come off their roster and out of their event pools. What you already played stays on ` +
        `their record — results are not rewritten by somebody leaving. If you want back in later, ` +
        `they add you again, or you join their clan chat in game.`,
      confirmLabel: 'Leave',
      tone: 'danger',
    });
    if (!ok) return;

    setBusy(true);
    setError('');
    try {
      const res = await clanFetch('/api/profile/leave-clan', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not do that.');
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="text-xs text-accent-green-light">
        You are off {clanName}&rsquo;s roster.
      </p>
    );
  }

  return (
    <div>
      <div className="font-semibold text-sm">Leave {clanName}</div>
      {seat === 'member-in-game' ? (
        <p className="text-xs text-text-muted mt-0.5 max-w-[70ch]">
          You are on this clan&rsquo;s in-game roster, so the site follows the game here: leave the clan
          chat in game and the next roster sync takes you off this site too. Nothing here can hold
          that open or close it.
        </p>
      ) : (
        <>
          <p className="text-xs text-text-muted mt-0.5 mb-3 max-w-[70ch]">
            You hold a seat here without being on their in-game roster — added by hand, or picked up
            as a guest while you played with this clan&rsquo;s site set in your plugin. You can take it
            back. What you already played stays on their record.
          </p>
          {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
          <button
            type="button"
            onClick={leave}
            disabled={busy}
            className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-red-900 hover:text-red-300 disabled:opacity-50"
          >
            {busy ? 'Leaving…' : `Leave ${clanName}`}
          </button>
        </>
      )}
    </div>
  );
}
