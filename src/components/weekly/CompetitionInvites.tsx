'use client';

import { useState } from 'react';

import ChipsInput from '@/components/ChipsInput';
import ClanLink from '@/components/ClanLink';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import type { CompetitionInviteRow } from '@/lib/competitionTeamsDb';
import { weeklyMetricLabel } from '@/lib/weeklyLabels';
import { clanPathOf } from '@/lib/clanScopedPaths';

function dateRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

const ENTRANT_OPTIONS = [
  { value: 'all', label: 'All members — everyone on our roster' },
  { value: 'selected', label: 'Selected people — only the ones we pick' },
];

/** All members, or a picked list of RSNs — this clan's side of one competition. */
function EntrantsPicker({
  entrants,
  rsns,
  onChange,
}: {
  entrants: 'all' | 'selected';
  rsns: string[];
  onChange: (e: 'all' | 'selected', rsns: string[]) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <Select value={entrants} onChange={(v) => onChange(v === 'selected' ? 'selected' : 'all', rsns)} ariaLabel="Who races for us" options={ENTRANT_OPTIONS} />
      {entrants === 'selected' && (
        <ChipsInput value={rsns} onChange={(r) => onChange('selected', r)} placeholder="Add an RSN and press Enter" ariaLabel="Who races for us" maxTagLength={12} />
      )}
      <p className="text-[12px] text-text-muted">Each player can still opt out of this competition themselves.</p>
    </div>
  );
}

/**
 * Clan-vs-clan competition invites addressed to THIS clan (lib/competitionTeamsDb), and the running
 * ones it already accepted. An owner/admin accepts — choosing whether all members race or only the
 * people it picks — declines, or declines and blocks the sending clan (lib/clanBlocks). Shown on the
 * People page and the events list.
 */
export default function CompetitionInvites({ initial }: { initial: CompetitionInviteRow[] }) {
  const [invites, setInvites] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ entrants: 'all' | 'selected'; rsns: string[] }>({ entrants: 'all', rsns: [] });
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setError(null);
    setNote(null);
    const res = await clanFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? 'That didn’t work');
      return null;
    }
    const unknown = Array.isArray(data?.unknown) ? (data.unknown as string[]) : [];
    if (unknown.length) setNote(`Not on your roster, so not entered: ${unknown.join(', ')}`);
    return data;
  }

  async function respond(i: CompetitionInviteRow, action: 'accept' | 'decline' | 'block') {
    setBusyId(i.id);
    try {
      const ok = await post(`/api/weekly-invites/${i.id}/respond`, { action, entrants: draft.entrants, rsns: draft.rsns });
      if (!ok) return;
      setOpenId(null);
      setInvites((v) =>
        action === 'accept'
          ? v.map((x) => (x.id === i.id ? { ...x, status: 'accepted', entrants: draft.entrants, picked: draft.rsns } : x))
          : v.filter((x) => x.id !== i.id),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveEntrants(i: CompetitionInviteRow) {
    setBusyId(i.id);
    try {
      const ok = await post(`/api/weekly-invites/${i.id}/entrants`, { entrants: draft.entrants, rsns: draft.rsns });
      if (!ok) return;
      setOpenId(null);
      setInvites((v) => v.map((x) => (x.id === i.id ? { ...x, entrants: draft.entrants, picked: draft.rsns } : x)));
    } finally {
      setBusyId(null);
    }
  }

  function open(i: CompetitionInviteRow) {
    setOpenId(i.id);
    setDraft({ entrants: i.entrants === 'selected' ? 'selected' : 'all', rsns: i.picked });
  }

  const primary = 'rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50';
  const ghost = 'rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:border-red-400/50 hover:text-red-300 disabled:opacity-50';

  return (
    <section className="mb-6 rounded-2xl border border-gold/30 bg-gold/[0.05] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold text-gold">Clan vs clan competitions</h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {invites.map((i) => {
          const accepted = i.status === 'accepted';
          const editing = openId === i.id;
          return (
            <li key={i.id} className="rounded-xl border border-card-border bg-card-bg p-3.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">
                    {accepted ? (
                      <>
                        Racing in <span className="text-gold">{i.title}</span>, hosted by <span className="text-gold">{i.hostName}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-gold">{i.hostName}</span> invited your clan to <span className="text-gold">{i.title}</span>
                      </>
                    )}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {weeklyMetricLabel(i.type, i.metric)} · {dateRange(i.startDate, i.endDate)}
                    {accepted && ` · ${i.entrants === 'selected' ? `${i.picked.length} picked` : 'all members'}`}
                  </div>
                  {!accepted && (
                    <div className="mt-0.5 text-[12.5px] text-text-muted">
                      Nobody from your clan is entered until you accept. Then all your members race — or only the people you
                      pick — and clan totals decide it. The host runs the competition; you see the standings.
                    </div>
                  )}
                  {accepted ? (
                    <ClanLink href={`/weekly/${i.competitionId}`} className="mt-1 inline-block text-[12.5px] text-gold hover:text-gold-light">
                      Standings →
                    </ClanLink>
                  ) : (
                    <a
                      href={clanPathOf({ slug: i.hostSlug, kind: i.hostKind }, `/weekly/${i.competitionId}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[12.5px] text-gold hover:text-gold-light"
                    >
                      Look at it first →
                    </a>
                  )}
                </div>
                {!editing && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {accepted ? (
                      <button type="button" onClick={() => open(i)} disabled={busyId === i.id} className={ghost}>
                        Who races
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => open(i)} disabled={busyId === i.id} className={primary}>
                          Accept…
                        </button>
                        <button type="button" onClick={() => respond(i, 'decline')} disabled={busyId === i.id} className={ghost}>
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => respond(i, 'block')}
                          disabled={busyId === i.id}
                          className={ghost}
                          title="Decline, and refuse every future invite from this clan. Undo in Settings → Blocked clans."
                        >
                          Decline &amp; block this clan
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editing && (
                <div className="mt-2 border-t border-card-border/60 pt-2">
                  <EntrantsPicker entrants={draft.entrants} rsns={draft.rsns} onChange={(entrants, rsns) => setDraft({ entrants, rsns })} />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={primary}
                      disabled={busyId === i.id || (draft.entrants === 'selected' && draft.rsns.length === 0)}
                      onClick={() => (accepted ? saveEntrants(i) : respond(i, 'accept'))}
                    >
                      {accepted ? 'Save' : 'Accept'}
                    </button>
                    <button type="button" className={ghost} onClick={() => setOpenId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-2 text-[12.5px] text-gold">{note}</p>}
      {error && <p className="mt-2 text-[12.5px] text-red-300">{error}</p>}
    </section>
  );
}
