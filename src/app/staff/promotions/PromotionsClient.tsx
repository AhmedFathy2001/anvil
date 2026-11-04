'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import {
  actionLabel,
  REPORT_CATEGORY_LABEL,
  REPORT_TARGET_LABEL,
  REPORT_TARGETS,
  type ReportAction,
  type ReportCategory,
  type ReportTarget,
} from '@/lib/platformReportRules';
import { BLOCK_REASON_LABEL, BLOCK_REASONS, type BlockReason } from '@/lib/spacePage/blocklistSeed';

interface Report {
  id: number;
  targetType: ReportTarget;
  targetId: number | null;
  category: string;
  status: string;
  note: string | null;
  staffNote: string | null;
  snapshot: string;
  createdAt: string;
  resolvedAt: string | null;
  reporter: string | null;
  resolvedBy: string | null;
  clan: { id: number; name: string; slug: string; platformHidden: boolean; kind: string } | null;
  title: string | null;
  href: string | null;
  hidden: boolean;
  actions: ReportAction[];
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
  highlights: { id: number; title: string; clanId: number; clanName: string; clanSlug: string; at: string | null }[];
}

const STATUS_CLS: Record<string, string> = {
  open: 'bg-gold/15 text-gold',
  hidden: 'bg-red-500/15 text-red-400',
  resolved: 'bg-accent-green/15 text-accent-green-light',
  dismissed: 'bg-brown-light text-text-muted',
};
const STATUS_WORD: Record<string, string> = { open: 'open', hidden: 'actioned', resolved: 'handled', dismissed: 'dismissed' };

// Character and person are both "Player profile" to a reporter; one chip covers both for staff.
const TYPE_CHIPS: { key: 'all' | ReportTarget; label: string; also?: ReportTarget }[] = [
  { key: 'all', label: 'All' },
  ...REPORT_TARGETS.filter((t) => t !== 'person').map((t) => ({ key: t, label: t === 'character' ? 'Profiles' : REPORT_TARGET_LABEL[t], also: t === 'character' ? ('person' as const) : undefined })),
];

const btn = 'rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45 disabled:opacity-50';

function TargetLink({ r }: { r: Report }) {
  const label = r.title ?? `${REPORT_TARGET_LABEL[r.targetType]} #${r.targetId ?? '?'}`;
  if (!r.href) return <span className="font-semibold">{label}</span>;
  if (/^https?:\/\//.test(r.href)) {
    return (
      <a href={r.href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-gold hover:text-gold-light">
        {label} ↗
      </a>
    );
  }
  return (
    <ClanLink href={r.href} className="font-semibold text-gold hover:text-gold-light">
      {label}
    </ClanLink>
  );
}

export default function PromotionsClient({ canWrite }: { canWrite: boolean }) {
  const { confirm, ask } = useDialog();
  const [tab, setTab] = useState<'reports' | 'blocklist' | 'hidden'>('reports');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [type, setType] = useState<'all' | ReportTarget>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [blocklist, setBlocklist] = useState<Blocked[]>([]);
  const [hidden, setHidden] = useState<Hidden>({ panels: [], spaces: [], highlights: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState<BlockReason>('rwt');
  const [q, setQ] = useState('');

  const load = useCallback(async (f: 'open' | 'all', t: 'all' | ReportTarget) => {
    // clan-prefix: platform -- the staff inbox lives on the apex.
    const res = await clanFetch(`/api/staff/promotions?status=${f}&type=${t}`);
    if (res.ok) {
      const d = await res.json();
      setReports(d.reports ?? []);
      setCounts(d.counts ?? {});
      setBlocklist(d.blocklist ?? []);
      setHidden({ panels: [], spaces: [], highlights: [], ...(d.hidden ?? {}) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load(filter, type);
  }, [filter, type, load]);

  async function act(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError('');
    // clan-prefix: platform -- the staff inbox lives on the apex.
    const res = await clanFetch('/api/staff/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? 'That did not work.');
    await load(filter, type);
    setBusy(false);
    return res.ok;
  }

  async function onAction(r: Report, a: ReportAction) {
    if (a === 'unlist') {
      const name = r.clan?.name ?? 'this clan';
      const ok = await confirm({
        title: r.targetType === 'event' ? `Hide ${name} (the host) from directories?` : `Hide ${name} from directories?`,
        body: 'It comes off every public listing, the events directory and outsiders’ Discord cards, the same as the platform hide on /staff/clans. Its own members keep using it. Undo it from the clan’s staff page.',
        confirmLabel: 'Hide from directories',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await act({ action: 'report', id: r.id, op: a });
  }

  async function onNote(r: Report) {
    const note = await ask({ title: 'Staff note', label: 'Only platform staff see this.', initial: r.staffNote ?? '', multiline: true, confirmLabel: 'Save note' });
    if (note == null) return;
    await act({ action: 'report', id: r.id, op: 'note', note });
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  const tabCls = (on: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;
  const chipCls = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[12.5px] ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;
  const shownBlocked = q.trim() ? blocklist.filter((b) => b.domain.includes(q.trim().toLowerCase())) : blocklist;
  const openTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const hiddenTotal = hidden.panels.length + hidden.spaces.length + hidden.highlights.length;
  // The "Profiles" chip asks for characters, which the API widens to people too.
  const shownReports = reports;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tabCls(tab === 'reports')} onClick={() => setTab('reports')}>
          Reports{openTotal > 0 ? ` (${openTotal})` : ''}
        </button>
        <button type="button" className={tabCls(tab === 'hidden')} onClick={() => setTab('hidden')}>
          Hidden ({hiddenTotal})
        </button>
        <button type="button" className={tabCls(tab === 'blocklist')} onClick={() => setTab('blocklist')}>
          Creator link blocklist ({blocklist.length})
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {tab === 'reports' && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {(['open', 'all'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={tabCls(filter === f)}>
                {f === 'open' ? 'Open' : 'All'}
              </button>
            ))}
            <span className="ml-auto text-xs text-text-muted">{shownReports.length} shown</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TYPE_CHIPS.map((c) => {
              const n = c.key === 'all' ? openTotal : (counts[c.key] ?? 0) + (c.also ? (counts[c.also] ?? 0) : 0);
              return (
                <button key={c.key} type="button" onClick={() => setType(c.key)} className={chipCls(type === c.key)}>
                  {c.label}
                  {n > 0 && <span className="ml-1 text-gold">{n}</span>}
                </button>
              );
            })}
          </div>
          {shownReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">
              Nothing {filter === 'open' ? 'open' : 'reported yet'}.
            </div>
          ) : (
            <ul className="space-y-3">
              {shownReports.map((r) => (
                <li key={r.id} className="rounded-xl border border-card-border bg-card-bg p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_CLS[r.status] ?? ''}`}>{STATUS_WORD[r.status] ?? r.status}</span>
                    <span className="rounded border border-card-border px-1.5 py-0.5 text-[11px] text-text-muted">{REPORT_TARGET_LABEL[r.targetType]}</span>
                    <TargetLink r={r} />
                    {r.clan && r.targetType !== 'clan' && r.targetType !== 'space' && <span className="text-text-muted">on {r.clan.name}</span>}
                    {r.hidden && <span className="text-[11px] text-red-400">already hidden</span>}
                    <span className="ml-auto text-xs text-text-muted">
                      {r.reporter ?? 'someone'} · <LocalTime date={r.createdAt} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-text-muted">Reason:</span> {REPORT_CATEGORY_LABEL[r.category as ReportCategory] ?? r.category}
                  </p>
                  {r.note && <p className="mt-1 text-sm">“{r.note}”</p>}
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-card-border bg-brown-dark/40 p-3 text-[12.5px] text-text-muted">
                    {r.snapshot || '(nothing)'}
                  </pre>
                  {r.staffNote && (
                    <p className="mt-2 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[13px]">
                      <span className="text-text-muted">Staff note:</span> {r.staffNote}
                    </p>
                  )}
                  {r.status !== 'open' && r.resolvedAt && (
                    <p className="mt-2 text-xs text-text-dim">
                      {STATUS_WORD[r.status] ?? r.status} by {r.resolvedBy ?? 'staff'} · <LocalTime date={r.resolvedAt} />
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canWrite && r.status === 'open' && (
                      <>
                        {r.actions.map((a) => (
                          <button key={a} type="button" disabled={busy} className={`${btn} text-red-400`} onClick={() => void onAction(r, a)}>
                            {actionLabel(r.targetType, a)}
                          </button>
                        ))}
                        <button type="button" disabled={busy} className={btn} onClick={() => void act({ action: 'report', id: r.id, op: 'resolve' })}>
                          Mark handled
                        </button>
                        <button type="button" disabled={busy} className={btn} onClick={() => void act({ action: 'report', id: r.id, op: 'dismiss' })}>
                          Dismiss
                        </button>
                      </>
                    )}
                    {canWrite && (
                      <button type="button" disabled={busy} className={btn} onClick={() => void onNote(r)}>
                        {r.staffNote ? 'Edit note' : 'Add note'}
                      </button>
                    )}
                    <span className="ml-auto flex gap-3 text-[12.5px]">
                      {r.clan && (
                        <ClanLink href={`/staff/clans/${r.clan.id}`} className="text-text-muted hover:text-gold">
                          {r.clan.kind === 'creator' ? 'Space' : 'Clan'} in staff
                        </ClanLink>
                      )}
                      {(r.targetType === 'character' || r.targetType === 'person') && (
                        <ClanLink href="/staff/people" className="text-text-muted hover:text-gold">
                          People
                        </ClanLink>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'hidden' && (
        <div className="space-y-4">
          {hiddenTotal === 0 && <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">Nothing hidden.</div>}
          {hidden.spaces.length > 0 && (
            <ul className="space-y-2">
              {hidden.spaces.map((s) => (
                <li key={s.clanId} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
                  <span>
                    Page promotions: <ClanLink href={`/c/${s.clanSlug}`} className="text-gold">{s.clanName}</ClanLink>
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
          {hidden.highlights.length > 0 && (
            <ul className="space-y-2">
              {hidden.highlights.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
                  <span>
                    Highlight “{h.title}” on <ClanLink href={`/c/${h.clanSlug}`} className="text-gold">{h.clanName}</ClanLink>
                  </span>
                  {canWrite && (
                    <button type="button" disabled={busy} className={`${btn} ml-auto`} onClick={() => act({ action: 'showHighlight', highlightId: h.id })}>
                      Show again
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-dim">Clans hidden from directories are undone from their page under Clans.</p>
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
