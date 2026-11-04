'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';
import { BLOCK_REASON_LABEL, BLOCK_REASONS, type BlockReason } from '@/lib/spacePage/blocklistSeed';

interface Report {
  id: number;
  status: string;
  reason: string | null;
  snapshot: string;
  createdAt: string;
  reporter: string | null;
  space: { id: number; name: string; slug: string; hidden: boolean };
  panel: { id: number; title: string; staffHidden: boolean } | null;
}

interface Blocked {
  id: number;
  domain: string;
  reason: string;
  addedBy: string | null;
  createdAt: string;
}

interface Hidden {
  panels: { id: number; title: string; clanId: number; clanName: string; clanSlug: string; at: string | null }[];
  spaces: { clanId: number; clanName: string; clanSlug: string; at: string | null }[];
}

const STATUS_CLS: Record<string, string> = {
  open: 'bg-gold/15 text-gold',
  hidden: 'bg-red-500/15 text-red-400',
  dismissed: 'bg-brown-light text-text-muted',
};

const btn = 'rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45 disabled:opacity-50';

export default function PromotionsClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<'reports' | 'blocklist' | 'hidden'>('reports');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [blocklist, setBlocklist] = useState<Blocked[]>([]);
  const [hidden, setHidden] = useState<Hidden>({ panels: [], spaces: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState<BlockReason>('rwt');
  const [q, setQ] = useState('');

  const load = useCallback(async (f: 'open' | 'all') => {
    const res = await clanFetch(`/api/staff/promotions?status=${f}`);
    if (res.ok) {
      const d = await res.json();
      setReports(d.reports ?? []);
      setBlocklist(d.blocklist ?? []);
      setHidden(d.hidden ?? { panels: [], spaces: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load(filter);
  }, [filter, load]);

  async function act(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError('');
    const res = await clanFetch('/api/staff/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? 'That did not work.');
    await load(filter);
    setBusy(false);
    return res.ok;
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  const tabCls = (on: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;
  const shownBlocked = q.trim() ? blocklist.filter((b) => b.domain.includes(q.trim().toLowerCase())) : blocklist;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tabCls(tab === 'reports')} onClick={() => setTab('reports')}>
          Reports
        </button>
        <button type="button" className={tabCls(tab === 'hidden')} onClick={() => setTab('hidden')}>
          Hidden ({hidden.panels.length + hidden.spaces.length})
        </button>
        <button type="button" className={tabCls(tab === 'blocklist')} onClick={() => setTab('blocklist')}>
          Link blocklist ({blocklist.length})
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {tab === 'reports' && (
        <>
          <div className="mb-3 flex items-center gap-2">
            {(['open', 'all'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={tabCls(filter === f)}>
                {f === 'open' ? 'Open' : 'All'}
              </button>
            ))}
            <span className="ml-auto text-xs text-text-muted">{reports.length} shown</span>
          </div>
          {reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">
              Nothing {filter === 'open' ? 'open' : 'reported yet'}.
            </div>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-card-border bg-card-bg p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_CLS[r.status] ?? ''}`}>{r.status}</span>
                    <ClanLink href={`/c/${r.space.slug}`} className="font-semibold text-gold hover:text-gold-light">
                      {r.space.name}
                    </ClanLink>
                    <span className="text-text-muted">{r.panel ? `panel “${r.panel.title}”` : 'the page (bio, schedule, featured)'}</span>
                    <span className="ml-auto text-xs text-text-muted">
                      {r.reporter ?? 'someone'} · <LocalTime date={r.createdAt} />
                    </span>
                  </div>
                  {r.reason && <p className="mt-2 text-sm">“{r.reason}”</p>}
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-card-border bg-brown-dark/40 p-3 text-[12.5px] text-text-muted">
                    {r.snapshot || '(nothing)'}
                  </pre>
                  {canWrite && r.status === 'open' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} className={`${btn} text-red-400`} onClick={() => act({ action: 'resolve', id: r.id, how: 'hide' })}>
                        {r.panel ? 'Hide this panel' : 'Hide this page’s promotions'}
                      </button>
                      <button type="button" disabled={busy} className={btn} onClick={() => act({ action: 'resolve', id: r.id, how: 'dismiss' })}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'hidden' && (
        <div className="space-y-4">
          {hidden.panels.length + hidden.spaces.length === 0 && (
            <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">Nothing hidden.</div>
          )}
          {hidden.spaces.length > 0 && (
            <ul className="space-y-2">
              {hidden.spaces.map((s) => (
                <li key={s.clanId} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
                  <span>
                    Whole page: <ClanLink href={`/c/${s.clanSlug}`} className="text-gold">{s.clanName}</ClanLink>
                  </span>
                  {canWrite && (
                    <button type="button" disabled={busy} className={`${btn} ml-auto`} onClick={() => act({ action: 'showSpace', clanId: s.clanId })}>
                      Show again
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hidden.panels.length > 0 && (
            <ul className="space-y-2">
              {hidden.panels.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
                  <span>
                    Panel “{p.title}” on <ClanLink href={`/c/${p.clanSlug}`} className="text-gold">{p.clanName}</ClanLink>
                  </span>
                  {canWrite && (
                    <button type="button" disabled={busy} className={`${btn} ml-auto`} onClick={() => act({ action: 'showPanel', panelId: p.id })}>
                      Show again
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'blocklist' && (
        <div>
          <p className="mb-3 text-sm text-text-muted">
            A domain blocks itself and every subdomain (blocking <code>example.com</code> blocks <code>shop.example.com</code>).
            Panel links and links written in bios and panels are checked on save and again whenever a page renders, so a domain
            added here disappears from live pages within a minute. Host names that spell out the trade (<code>osrs-gold-…</code>,{' '}
            <code>…rsps…</code>, <code>rs-dice…</code>) are refused without being listed.
          </p>
          {canWrite && (
            <form
              className="mb-4 flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ action: 'block', domain, reason })) setDomain('');
              }}
            >
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="min-w-[14rem] flex-1 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm"
              />
              <select value={reason} onChange={(e) => setReason(e.target.value as BlockReason)} className="rounded-lg border border-card-border bg-card-bg px-2 py-1.5 text-sm">
                {BLOCK_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {BLOCK_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy || !domain.trim()} className={`${btn} border-gold/50 text-gold`}>
                Block
              </button>
            </form>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="mb-2 w-full max-w-xs rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm"
          />
          <ul className="divide-y divide-card-border/70 overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {shownBlocked.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono">{b.domain}</span>
                <span className="text-xs text-text-muted">{BLOCK_REASON_LABEL[b.reason as BlockReason] ?? b.reason}</span>
                {b.addedBy && <span className="text-xs text-text-dim">added by {b.addedBy}</span>}
                {canWrite && (
                  <button type="button" disabled={busy} className="ml-auto text-xs text-text-dim hover:text-red-400" onClick={() => act({ action: 'unblock', id: b.id })}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
