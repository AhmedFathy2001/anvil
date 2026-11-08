'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';

interface Transfer {
  id: number;
  clanId: number;
  clanName: string;
  clanSlug: string;
  fromName: string;
  toName: string;
  status: string;
  requestedAt: string;
  completesAt: string;
  decidedAt: string | null;
  reason: string | null;
  staffClearedAt: string | null;
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-gold/15 text-gold',
  completed: 'bg-accent-green/15 text-accent-green-light',
  cancelled: 'bg-brown-light text-text-muted',
  declined: 'bg-brown-light text-text-muted',
  blocked: 'bg-red-500/15 text-red-400',
};

/** The staff queue of clan ownership transfers; also embedded, for one clan, on /staff/clans/[id]. */
export default function OwnershipTransfersClient({ canWrite, clanId }: { canWrite: boolean; clanId?: number }) {
  const { confirm, ask, notify } = useDialog();
  const [items, setItems] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function load(f: 'pending' | 'all') {
    const res = await clanFetch(`/api/staff/ownership-transfers?status=${f}${clanId ? `&clanId=${clanId}` : ''}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, clanId]);

  async function act(t: Transfer, action: 'block' | 'clear') {
    let reason: string | null = null;
    if (action === 'block') {
      reason = await ask({
        title: `Block handing ${t.clanName} to ${t.toName}?`,
        body: `${t.fromName} stays the owner. Both of them are told it was stopped, with your reason.`,
        label: 'Reason (both people see this)',
        required: true,
        multiline: true,
        confirmLabel: 'Block transfer',
        tone: 'danger',
      });
      if (!reason) return;
    } else {
      const ok = await confirm({
        title: 'Let this transfer through?',
        body: `It leaves this queue. Ownership still moves to ${t.toName} only when the 3-day hold runs out, unless someone cancels it.`,
        confirmLabel: 'Let it through',
      });
      if (!ok) return;
    }
    setBusy(t.id);
    const res = await clanFetch('/api/staff/ownership-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, action, reason }),
    });
    if (!res.ok) notify((await res.json().catch(() => null))?.error ?? 'That did not work.', 'error');
    else notify(action === 'block' ? 'Blocked' : 'Let through');
    await load(filter);
    setBusy(null);
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(['pending', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              filter === f ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {f === 'pending' ? 'Pending' : 'All'}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted">{items.length} shown</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">
          {filter === 'pending' ? 'No ownership transfers waiting.' : 'No ownership transfers yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="rounded-xl border border-card-border bg-card-bg p-4">
              <div className="flex flex-wrap items-center gap-2">
                {clanId ? (
                  <span className="font-semibold">{t.clanName}</span>
                ) : (
                  <ClanLink href={`/staff/clans/${t.clanId}`} className="font-semibold hover:text-gold">
                    {t.clanName}
                  </ClanLink>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[t.status] ?? ''}`}>{t.status}</span>
                {t.status === 'pending' && t.staffClearedAt && (
                  <span className="rounded-full bg-brown-light px-2 py-0.5 text-[10px] font-medium text-text-muted">let through</span>
                )}
              </div>
              <div className="mt-1 text-sm">
                <span className="text-foreground">{t.fromName}</span> <span className="text-text-muted">→</span>{' '}
                <span className="text-gold">{t.toName}</span>
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                Asked <LocalTime date={t.requestedAt} /> ·{' '}
                {t.status === 'pending' ? (
                  <>
                    moves <LocalTime date={t.completesAt} />
                  </>
                ) : t.decidedAt ? (
                  <>
                    {t.status} <LocalTime date={t.decidedAt} />
                  </>
                ) : (
                  t.status
                )}
              </div>
              {t.reason && <p className="mt-2 text-sm text-gray-300">{t.reason}</p>}
              {canWrite && t.status === 'pending' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy === t.id}
                    onClick={() => act(t, 'block')}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Block
                  </button>
                  {!t.staffClearedAt && (
                    <button
                      disabled={busy === t.id}
                      onClick={() => act(t, 'clear')}
                      className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
                    >
                      Let it through
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
