'use client';

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import type { CompetitionInviteRow } from '@/lib/competitionTeamsDb';
import { weeklyMetricLabel } from '@/lib/weeklyLabels';

function dateRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Clan-vs-clan competition invites addressed to THIS clan (lib/competitionTeamsDb), plus the ones
 * it already accepted that are still running. An owner/admin accepts — the whole roster then races
 * for this clan in the host's competition — or declines.
 */
export default function CompetitionInvites({ initial }: { initial: CompetitionInviteRow[] }) {
  const [invites, setInvites] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function respond(id: number, action: 'accept' | 'decline') {
    setBusyId(id);
    setError(null);
    try {
      const res = await clanFetch(`/api/weekly-invites/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'That didn’t work');
      setInvites((v) => (action === 'decline' ? v.filter((i) => i.id !== id) : v.map((i) => (i.id === id ? { ...i, status: 'accepted' } : i))));
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
        <h2 className="text-[15px] font-semibold text-gold">Clan vs clan competitions</h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-col gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {i.status === 'accepted' ? (
                  <>
                    Racing <span className="text-gold">{i.hostName}</span> in <span className="text-gold">{i.title}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gold">{i.hostName}</span> challenged you to <span className="text-gold">{i.title}</span>
                  </>
                )}
              </div>
              <div className="text-[12.5px] text-text-muted">
                {weeklyMetricLabel(i.type, i.metric)} · {dateRange(i.startDate, i.endDate)}
              </div>
              {i.status !== 'accepted' && (
                <div className="mt-0.5 text-[12.5px] text-text-muted">
                  Accept and your whole roster races for your clan; clan totals decide it. You see the standings, they run the
                  competition.
                </div>
              )}
              {/* Under THIS clan's address: a partner reads the standings from its own pages. Before accepting,
                  the host's page is the only one that will show it. */}
              {i.status === 'accepted' ? (
                <ClanLink href={`/weekly/${i.competitionId}`} className="mt-1 inline-block text-[12.5px] text-gold hover:text-gold-light">
                  Standings →
                </ClanLink>
              ) : (
                <a
                  href={`/c/${i.hostSlug}/weekly/${i.competitionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[12.5px] text-gold hover:text-gold-light"
                >
                  Look at it first →
                </a>
              )}
            </div>
            {i.status !== 'accepted' && (
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
                  className="rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[12.5px] text-red-300">{error}</p>}
    </section>
  );
}
