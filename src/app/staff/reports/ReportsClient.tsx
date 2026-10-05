'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';

interface Report {
  id: number;
  kind: string;
  body: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  account: { id: number; rsn: string; playerId: number; ownerName: string | null; claimed: boolean; verificationMethod: string | null; provisional: boolean };
  clan: { name: string; slug: string } | null;
  reporter: string | null;
  claimant: { id: number; name: string } | null;
}

const KIND_LABEL: Record<string, string> = {
  wrong_owner: 'Wrong owner',
  rename: 'Rename',
  merge: 'Duplicate / merge',
  claim_review: 'Disputed link',
  claim_request: 'Clan vouches for a claim',
  other: 'Other',
};

const STATUS_CLS: Record<string, string> = {
  open: 'bg-gold/15 text-gold',
  resolved: 'bg-accent-green/15 text-accent-green-light',
  dismissed: 'bg-brown-light text-text-muted',
};

export default function ReportsClient() {
  const [items, setItems] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load(f: 'open' | 'all') {
    const res = await fetch(`/api/staff/character-reports?status=${f}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load(filter);
  }, [filter]);

  async function act(r: Report, payload: Record<string, unknown>, url: string, method = 'POST') {
    setBusy(r.id);
    setError('');
    const res = await clanFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? 'That did not work.');
    await load(filter);
    setBusy(null);
  }

  const note = (r: Report) => (document.getElementById(`note-${r.id}`) as HTMLTextAreaElement | null)?.value ?? '';

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              filter === f ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {f === 'open' ? 'Open' : 'All'}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted">{items.length} shown</span>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">
          Nothing {filter === 'open' ? 'open' : 'reported yet'}.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border border-card-border bg-card-bg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.account.rsn}</span>
                <span className="rounded-full bg-brown-light px-2 py-0.5 text-[10px] font-medium text-text-muted">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[r.status] ?? ''}`}>{r.status}</span>
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                {r.account.claimed ? (
                  <>
                    Held by <span className="text-foreground">{r.account.ownerName ?? `person #${r.account.playerId}`}</span>
                    {r.account.verificationMethod ? ` · via ${r.account.verificationMethod.replace(/_/g, ' ')}` : ''}
                    {r.account.provisional ? ' · in review' : ''}
                  </>
                ) : (
                  'Unclaimed'
                )}
                {r.clan && (
                  <>
                    {' · raised by '}
                    <ClanLink href={`/c/${r.clan.slug}`} className="text-gold hover:underline">
                      {r.clan.name}
                    </ClanLink>
                  </>
                )}
                {r.reporter ? ` (${r.reporter})` : ''} · <LocalTime date={r.createdAt} format="date" />
              </div>
              {r.body && <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{r.body}</p>}
              {r.resolution && <p className="mt-2 text-xs text-accent-green-light">Outcome: {r.resolution}</p>}

              {r.status === 'open' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    id={`note-${r.id}`}
                    rows={2}
                    placeholder="What you did / why (kept on the report and the operator log)…"
                    className="w-full resize-y rounded border border-card-border bg-brown-dark px-2 py-1.5 text-xs focus:border-gold/40 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {r.claimant && (
                      <button
                        disabled={busy === r.id}
                        onClick={() =>
                          act(r, { action: 'reassign', toPlayerId: r.claimant!.id, note: note(r) || `Given to ${r.claimant!.name}`, reportId: r.id }, `/api/staff/characters/${r.account.id}`)
                        }
                        className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
                      >
                        Give to {r.claimant.name}
                      </button>
                    )}
                    {r.account.claimed && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => act(r, { action: 'detach', note: note(r) || 'Detached', reportId: r.id }, `/api/staff/characters/${r.account.id}`)}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Take it off {r.account.ownerName ?? 'them'}
                      </button>
                    )}
                    <span className="flex items-center gap-1">
                      <input
                        id={`to-${r.id}`}
                        inputMode="numeric"
                        placeholder="person id"
                        className="w-24 rounded border border-card-border bg-brown-dark px-2 py-1.5 text-xs focus:border-gold/40 focus:outline-none"
                      />
                      <button
                        disabled={busy === r.id}
                        onClick={() => {
                          const id = Number((document.getElementById(`to-${r.id}`) as HTMLInputElement | null)?.value);
                          if (!Number.isInteger(id) || id <= 0) return setError('Enter a person id from /staff/people.');
                          void act(r, { action: 'reassign', toPlayerId: id, note: note(r) || `Reassigned to person #${id}`, reportId: r.id }, `/api/staff/characters/${r.account.id}`);
                        }}
                        className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
                      >
                        Give to this person
                      </button>
                    </span>
                    <button
                      disabled={busy === r.id}
                      onClick={() => act(r, { id: r.id, status: 'resolved', resolution: note(r) || 'Resolved' }, '/api/staff/character-reports', 'PATCH')}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
                    >
                      Mark resolved
                    </button>
                    <button
                      disabled={busy === r.id}
                      onClick={() => act(r, { id: r.id, status: 'dismissed', resolution: note(r) || 'No action needed' }, '/api/staff/character-reports', 'PATCH')}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
