'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';

export interface GuestSeatRow {
  seatId: number;
  rsn: string;
  clanName: string;
  clanSlug: string;
}

/**
 * The clans you guest in, from the apex profile, each with its own Leave.
 *
 * Guest seats arrive in quiet ways — a plugin session in a clan you were visiting, a request you
 * forgot about, a demotion when you joined somewhere else — and the only Leave lived inside each
 * clan's locker drawer. Here they are in one list. Leaving goes through /api/me/seats/[id]/leave,
 * which ends exactly one of your own seats and refuses a member seat the in-game list holds.
 */
export default function GuestSeatsClient({ seats }: { seats: GuestSeatRow[] }) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function leave(s: GuestSeatRow) {
    const ok = await confirm({
      title: `Stop guesting in ${s.clanName} with ${s.rsn}?`,
      body: 'Results already recorded stay where they are. You can ask to guest again later.',
      confirmLabel: 'Leave',
    });
    if (!ok) return;
    setBusy(s.seatId);
    setError('');
    try {
      const res = await fetch(`/api/me/seats/${s.seatId}/leave`, { method: 'POST' });
      if (!res.ok) {
        setError(`Couldn’t leave ${s.clanName} — refresh and try again.`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-lg font-semibold">Clans you guest in</h2>
      <p className="mb-3 text-sm text-text-muted">
        You can play these clans&rsquo; events, but you&rsquo;re not on their in-game member list.
      </p>
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {seats.map((s) => (
          <li key={s.seatId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <ClanLink href={`/c/${s.clanSlug}`} className="text-sm font-medium hover:text-gold">
              {s.clanName}
            </ClanLink>
            <span className="text-xs text-text-muted">as {s.rsn}</span>
            <button
              type="button"
              onClick={() => leave(s)}
              disabled={busy === s.seatId}
              className="ml-auto rounded-lg border border-card-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent-red/50 hover:text-accent-red disabled:opacity-50"
            >
              {busy === s.seatId ? 'Leaving…' : 'Leave'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
