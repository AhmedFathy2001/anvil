'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { categoryOf, type CategoryView } from '@/lib/guideCategories';

interface Row {
  id: number;
  title: string;
  category: string;
  targetGuideId: number | null;
  status: string;
  proposer: string;
  note: string | null;
  updatedAt: string;
}

/** Proposals from members everywhere, waiting on the library team — and what was decided lately. */
export default function ProposalQueueClient() {
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [categories, setCategories] = useState<CategoryView[]>([]);

  const load = useCallback(async (t: 'pending' | 'reviewed') => {
    const res = await fetch(`/api/staff/guides/proposals?status=${t}`);
    if (res.ok) {
      const j = await res.json();
      setRows(j.proposals);
      setCategories(j.categories ?? []);
    }
  }, []);
  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  return (
    <div className="space-y-5">
      <div>
        <ClanLink href="/staff/guides" className="text-xs text-text-muted hover:text-gold">
          ← Guide library
        </ClanLink>
        <h1 className="mt-1 text-2xl font-bold text-gold">Guide proposals</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          New guides and edits written by players. Approving a new guide publishes it to the library; approving an edit saves it as the
          guide&apos;s next version, which reaches clans like any library update.
        </p>
      </div>
      <div className="flex gap-1">
        {(['pending', 'reviewed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setRows(null);
              setTab(t);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
          >
            {t === 'pending' ? 'Waiting' : 'Decided'}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
          {tab === 'pending' ? 'Nothing waiting.' : 'Nothing decided yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-card-border rounded-xl border border-card-border bg-card-bg">
          {rows.map((p) => (
            <li key={p.id}>
              <ClanLink href={`/staff/guides/proposals/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] ${p.targetGuideId ? 'bg-sky-900/40 text-sky-200' : 'bg-gold/15 text-gold'}`}>
                  {p.targetGuideId ? 'EDIT' : 'NEW'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {categoryOf(p.category, categories).icon} {p.title}
                  </div>
                  <div className="text-xs text-text-muted">
                    by {p.proposer}
                    {p.note ? ` — ${p.note.slice(0, 120)}` : ''}
                  </div>
                </div>
                {tab === 'reviewed' && <span className="shrink-0 text-xs capitalize text-text-muted">{p.status}</span>}
                <span className="shrink-0 text-xs text-text-muted">{p.updatedAt.slice(0, 10)}</span>
              </ClanLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
