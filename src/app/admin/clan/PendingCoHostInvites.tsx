'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import type { CohostRow } from '@/lib/coHost';

/**
 * Co-host invites addressed to THIS clan — another clan has asked us to help run their event. An
 * admin accepts (which gives us our own team + staff seats there) or declines. Shown on the clan hub.
 */
/** "12 Aug – 26 Aug", or nothing when nobody has dated it yet. */
function dateRange(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return null;
}

export default function PendingCoHostInvites({ initial }: { initial: CohostRow[] }) {
  const [invites, setInvites] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function respond(id: number, action: 'accept' | 'decline') {
    setBusyId(id);
    setError(null);
    try {
      const res = await clanFetch(`/api/cohosts/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'That didn’t work');
      setInvites((v) => v.filter((i) => i.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-gold/30 bg-gold/[0.05] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold text-gold">Co-host invites</h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-col gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {/* WHO, and what. This said "A clan invited you to co-host X" — the host was a bare id
                  in the row and never selected, so the one fact the reader needed was the one thing
                  missing. Accepting commits your staff and your players to somebody else's board. */}
              <div className="text-[14px] font-medium">
                <span className="text-gold">{i.hostClanName}</span> invited you to co-host{' '}
                <span className="text-gold">{i.eventName}</span>
              </div>
              <div className="text-[12.5px] text-text-muted">
                {[
                  dateRange(i.eventStartDate, i.eventEndDate),
                  i.eventSignupFee ? `${i.eventSignupFee.toLocaleString()} gp entry` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="mt-0.5 text-[12.5px] text-text-muted">
                Accept and you get your own team on their board, run by your staff — roster, proof, your
                players’ fees.
              </div>
              <a
                href={`/c/${i.hostClanSlug}/events/${i.eventId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[12.5px] text-gold hover:text-gold-light"
              >
                Look at the board first →
              </a>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => respond(i.id, 'accept')}
                disabled={busyId === i.id}
                className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => respond(i.id, 'decline')}
                disabled={busyId === i.id}
                className="rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:border-accent-red/40 hover:text-accent-red disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[12.5px] text-accent-red">{error}</p>}
    </section>
  );
}
