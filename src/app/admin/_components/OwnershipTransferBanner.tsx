'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { fmtTransferMoment } from '@/lib/ownershipTransferRules';

/**
 * The clan's pending ownership transfer, said on every admin page while it waits out its 3-day hold
 * (lib/ownershipTransfers). The owner who asked gets Cancel; the person it's going to gets Decline;
 * every other admin just sees that it is happening.
 */
export default function OwnershipTransferBanner({
  viewerUserId,
  transfer,
}: {
  viewerUserId: number;
  transfer: { fromUserId: number; fromName: string; toUserId: number; toName: string; completesAt: string };
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const when = fmtTransferMoment(transfer.completesAt);
  const isOwner = viewerUserId === transfer.fromUserId;
  const isTarget = viewerUserId === transfer.toUserId;

  async function act(action: 'cancel' | 'decline') {
    const ok = await confirm(
      action === 'cancel'
        ? {
            title: 'Cancel the ownership transfer?',
            body: `You stay the owner and ${transfer.toName} stays an admin. You can ask again later — it starts a fresh 3-day hold.`,
            confirmLabel: 'Cancel transfer',
            cancelLabel: 'Keep it',
          }
        : {
            title: `Decline ownership of this clan?`,
            body: `${transfer.fromName} stays the owner and you stay an admin. They'll be told you declined.`,
            confirmLabel: 'Decline',
            cancelLabel: 'Keep it',
            tone: 'danger',
          },
    );
    if (!ok) return;
    setBusy(true);
    const res = await clanFetch('/api/admin/ownership-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      notify(data.error || 'Something went wrong', 'error');
      return;
    }
    notify(action === 'cancel' ? 'Transfer cancelled' : 'Declined');
    router.refresh();
  }

  const button =
    'shrink-0 rounded-lg border border-card-border px-3 py-1.5 text-sm font-semibold text-gold hover:border-gold/60 disabled:opacity-50';

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gold/40 bg-card-bg px-4 py-3 text-sm sm:flex-row sm:items-center">
      <span className="hidden h-5 w-1 shrink-0 rounded-full bg-gold sm:block" />
      <div className="min-w-0 flex-1">
        {isTarget ? (
          <>
            <span className="font-semibold text-gold">{transfer.fromName} is handing this clan to you.</span>{' '}
            <span className="text-gray-300">You become the owner on {when} unless it is cancelled.</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-gold">Ownership moves to {transfer.toName} on {when}.</span>{' '}
            <span className="text-gray-300">
              {isOwner
                ? 'You can cancel any time before then. Anvil staff have been told.'
                : `${transfer.fromName} asked for it; there is a 3-day hold before it happens.`}
            </span>
          </>
        )}
      </div>
      {isOwner && (
        <button type="button" className={button} disabled={busy} onClick={() => act('cancel')}>
          Cancel
        </button>
      )}
      {isTarget && (
        <button type="button" className={button} disabled={busy} onClick={() => act('decline')}>
          Decline
        </button>
      )}
    </div>
  );
}
