'use client';

import { useEffect, useState } from 'react';
import Select from '@/components/Select';
import LocalTime from '@/components/LocalTime';

interface Item {
  id: number;
  kind: string;
  subject: string;
  body: string;
  status: string;
  contact: string | null;
  pageUrl: string | null;
  adminNotes: string | null;
  elevated: boolean;
  elevatedAt: string | null;
  createdAt: string;
  reporter: string | null;
}

const STATUS_OPTS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_CLS: Record<string, string> = {
  open: 'bg-gold/15 text-gold',
  in_progress: 'bg-blue-500/15 text-blue-400',
  resolved: 'bg-accent-green/15 text-accent-green-light',
  closed: 'bg-brown-light text-text-muted',
};

export default function FeedbackAdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [canElevate, setCanElevate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/admin/feedback');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setCanElevate(data.canElevate);
    }
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  async function patch(id: number, patch: { status?: string; adminNotes?: string }) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  async function elevate(id: number) {
    setBusyId(id);
    setError('');
    const res = await fetch(`/api/admin/feedback/${id}/elevate`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) load();
    else setError((await res.json().catch(() => ({}))).error || 'Could not elevate.');
  }

  if (loading) return <p className="text-text-muted text-sm">Loading…</p>;

  const shown = filter === 'open' ? items.filter((i) => i.status === 'open' || i.status === 'in_progress') : items;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {(['open', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filter === f ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {f === 'open' ? 'Open' : 'All'}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">{shown.length} shown</span>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {shown.length === 0 ? (
        <div className="border border-dashed border-card-border rounded-xl p-10 text-center text-text-muted">
          Nothing here — no reports {filter === 'open' ? 'open' : 'yet'}.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((i) => (
            <div key={i.id} className="border border-card-border rounded-xl bg-card-bg p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-lg shrink-0" aria-hidden>
                  {i.kind === 'bug' ? '🐛' : '💡'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{i.subject}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[i.status] ?? ''}`}>
                      {i.status.replace('_', ' ')}
                    </span>
                    {i.elevated && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                        Elevated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {i.reporter ?? 'Unknown'} · <LocalTime date={i.createdAt} format="date" />
                    {i.pageUrl ? ` · from ${i.pageUrl}` : ''}
                  </div>
                  <p className="text-sm text-text-muted whitespace-pre-wrap mt-2">{i.body}</p>
                  <textarea
                    defaultValue={i.adminNotes ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (i.adminNotes ?? '')) patch(i.id, { adminNotes: v });
                    }}
                    rows={2}
                    placeholder="Private admin notes…"
                    className="w-full text-xs px-2 py-1.5 mt-2 bg-brown-dark border border-card-border rounded resize-y focus:outline-none focus:border-gold/40"
                  />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="w-40">
                    <Select
                      value={i.status}
                      onChange={(v) => patch(i.id, { status: v })}
                      options={STATUS_OPTS}
                      ariaLabel={`Status for ${i.subject}`}
                    />
                  </div>
                  {canElevate && !i.elevated && (
                    <button
                      onClick={() => elevate(i.id)}
                      disabled={busyId === i.id}
                      className="px-3 py-1.5 text-xs border border-purple-500/40 text-purple-300 rounded-lg hover:bg-purple-500/10 disabled:opacity-50 transition-colors"
                      title="Send this to the Anvil operator"
                    >
                      {busyId === i.id ? 'Elevating…' : 'Elevate to Anvil'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
