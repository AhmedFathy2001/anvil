'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { EDIT_TAGS, type EditTag } from '@/lib/guideCredit';

export interface QueueWire {
  id: number;
  kind: string;
  name: string;
  guideTitle: string;
  guideSlug: string;
  tier: string | null;
  author: string;
  createdAt: string;
  voters: number;
  avgKc: number;
  reports: { reason: string; at: string }[];
}

const ago = (iso: string) => {
  const h = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 3_600_000));
  return h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.round(h / 24)} days ago`;
};

/**
 * The curator queue. Everything in New is already live as "community" (setups) or waiting (route
 * steps and edits). Promote the best to a main pill / into the route, hide junk, or keep it as is.
 * Steps and edits carry a credit tag: fix, clarification, substantive or upkeep (lib/guideCredit).
 */
export default function CuratorQueue({ tab, rows, counts }: { tab: 'new' | 'reported' | 'promoted'; rows: QueueWire[]; counts: { new: number; reported: number } }) {
  const router = useRouter();
  const [tags, setTags] = useState<Record<number, EditTag>>({});
  const [msg, setMsg] = useState<string | null>(null);
  async function act(id: number, action: 'promote' | 'hide' | 'keep', kind: string) {
    const res = await clanFetch(`/api/guides/contributions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tag: kind === 'setup' ? null : tags[id] ?? 'substantive' }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? null : j.error ?? 'Could not do that.');
    router.refresh();
  }
  const tabs: { key: typeof tab; label: string; n?: number }[] = [
    { key: 'new', label: 'New', n: counts.new },
    { key: 'reported', label: 'Reported', n: counts.reported },
    { key: 'promoted', label: 'Promoted' },
  ];
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-card-border bg-card-bg">
      <div className="space-y-3 border-b border-card-border px-6 pt-5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h1 className="flex-1 text-xl font-extrabold">Community setups to review</h1>
        </div>
        <p className="text-sm text-text-muted">Setups here are already live as &quot;Community&quot;. Promote the best to main, hide junk, or keep it as is. Suggested route steps and edits show once promoted.</p>
        <div role="tablist" aria-label="Queue" className="flex gap-1">
          {tabs.map((t) => (
            <ClanLink key={t.key} href={`/guides/curate?tab=${t.key}`} role="tab" aria-selected={tab === t.key} className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-sm ${tab === t.key ? 'border-gold font-bold text-gold' : 'border-transparent text-text-muted'}`}>
              {t.label}
              {t.n ? <span className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? 'bg-gold text-brown-dark' : 'bg-white/10'}`}>{t.n}</span> : null}
            </ClanLink>
          ))}
        </div>
      </div>
      {msg && <p className="px-6 py-2 text-xs text-red-300">{msg}</p>}
      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-text-muted">Nothing here.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="grid items-center gap-3 border-b border-card-border px-6 py-3 sm:grid-cols-[2.2fr_1.1fr_1fr_auto]">
              <div className="min-w-0">
                <strong className="block truncate text-sm">{r.name}</strong>
                <ClanLink href={`/guides/${r.guideSlug}`} className="text-xs text-text-muted hover:text-gold">
                  {r.guideTitle}
                  {r.tier ? ` · ${r.tier[0].toUpperCase()}${r.tier.slice(1)}` : ''} · {r.kind === 'setup' ? 'setup' : r.kind === 'step' ? 'route step' : 'step edit'}
                </ClanLink>
                {r.reports.map((rep, i) => (
                  <span key={i} className="block text-xs text-amber-200">
                    Reported: {rep.reason}
                  </span>
                ))}
              </div>
              <span className="text-sm">
                {r.author}
                <span className="block text-xs text-text-muted">{ago(r.createdAt)}</span>
              </span>
              <span className="text-sm">
                <strong>{r.voters} used</strong>
                <span className="block text-xs text-text-muted">{r.voters ? `avg ${r.avgKc} kc` : 'no votes yet'}</span>
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {r.kind !== 'setup' && tab !== 'promoted' && (
                  <Select value={tags[r.id] ?? 'substantive'} onChange={(v) => setTags({ ...tags, [r.id]: v as EditTag })} options={EDIT_TAGS.map((t) => ({ value: t.key, label: t.label }))} ariaLabel="Credit tag" className="w-40" />
                )}
                {tab !== 'promoted' && (
                  <button type="button" onClick={() => act(r.id, 'promote', r.kind)} className="h-9 rounded-lg bg-gold px-2.5 text-xs font-bold text-brown-dark">
                    Promote
                  </button>
                )}
                <button type="button" onClick={() => act(r.id, 'hide', r.kind)} className="h-9 rounded-lg border border-card-border px-2.5 text-xs">
                  Hide
                </button>
                {tab !== 'promoted' && (
                  <button type="button" onClick={() => act(r.id, 'keep', r.kind)} className="h-9 rounded-lg border border-[#6b5326] px-2.5 text-xs font-semibold text-gold">
                    Keep
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
