'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { categoryOf, type CategoryView } from '@/lib/guideCategories';
import BulkPostPanel from '@/components/guides/BulkPostPanel';
import CategoryManager from '@/components/guides/CategoryManager';
import BulkRunsList from '@/components/guides/BulkRunsList';

interface Card {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  coverUrl: string | null;
  status: string;
  version: number;
  sourceGuideId: number | null;
  sourceVersion: number | null;
  followsSource: boolean;
  updatedAt: string;
  copyId?: number | null;
}

interface Offer {
  copyId: number;
  copyTitle: string;
  fromVersion: number;
  toVersion: number;
  notes: { version: number; note: string | null }[];
}

interface Data {
  canEdit: boolean;
  showLibrary: boolean;
  categories: (CategoryView & { id: number })[];
  guides: Card[];
  library: Card[];
  offers: Offer[];
}

export default function GuidesAdminClient({ clanName }: { clanName: string }) {
  const router = useRouter();
  const { ask, notify } = useDialog();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'mine' | 'library' | 'categories'>('mine');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [busy, setBusy] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [runsKey, setRunsKey] = useState(0);

  const load = useCallback(async () => {
    const res = await clanFetch('/api/admin/guides');
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const offersByCopy = useMemo(() => new Map((data?.offers ?? []).map((o) => [o.copyId, o])), [data]);

  async function create() {
    const title = await ask({ title: 'New guide', label: 'Title', placeholder: 'e.g. Our ToA learner raids', confirmLabel: 'Create' });
    if (!title?.trim()) return;
    const res = await clanFetch('/api/admin/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', title }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return notify(j.error ?? 'Could not create', 'error');
    router.push(clanUrl(`/admin/guides/${j.guide.id}`));
  }

  async function copy(sourceId: number) {
    setBusy(sourceId);
    try {
      const res = await clanFetch('/api/admin/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', sourceId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return notify(j.error ?? 'Could not copy', 'error');
      notify('Copied to your guides — it follows the library until you edit it');
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Adopting the library wholesale: copy everything not copied yet, then offer to post it all.
  async function copyAll() {
    if (!data) return;
    const ids = data.library.filter((g) => !g.copyId).map((g) => g.id);
    if (!ids.length) return;
    setBusy(-1);
    try {
      const res = await clanFetch('/api/admin/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copyMany', sourceIds: ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return notify(j.error ?? 'Could not copy', 'error');
      notify(`Copied ${ids.length} guide${ids.length === 1 ? '' : 's'} — they follow the library until you edit them`);
      await load();
      setTab('mine');
      setBulkOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function setShowLibrary(v: boolean) {
    const res = await clanFetch('/api/admin/guides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showLibrary: v }),
    });
    if (res.ok) setData((d) => (d ? { ...d, showLibrary: v } : d));
  }

  if (!data) return <p className="text-sm text-text-muted">Loading…</p>;

  const match = (g: Card) =>
    (!cat || g.category === cat) && (!q || `${g.title} ${g.summary}`.toLowerCase().includes(q.toLowerCase()));
  const list = (tab === 'mine' ? data.guides : data.library).filter(match);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gold">Guides</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            In-game guides for {clanName}: on your site under <span className="text-foreground">Guides</span>, and posted to your Discord
            channels or forums by the bot — which edits its messages whenever the guide changes. Start from the Anvil library or write
            your own.
          </p>
        </div>
        {data.canEdit && (
          <div className="flex flex-wrap gap-2">
            {data.guides.some((g) => g.status === 'published') && (
              <button
                onClick={() => setBulkOpen((v) => !v)}
                className="rounded-lg bg-[#5865f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4]"
              >
                Post to Discord
              </button>
            )}
            <button onClick={create} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light">
              New guide
            </button>
          </div>
        )}
      </div>

      {bulkOpen && data.canEdit && (
        <BulkPostPanel
          guides={data.guides}
          guideCategories={data.categories}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            void load();
            setRunsKey((k) => k + 1);
          }}
        />
      )}
      {data.canEdit && <BulkRunsList refreshKey={runsKey} />}

      {data.offers.length > 0 && (
        <div className="rounded-xl border border-amber-700/70 bg-amber-950/25 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-100">
            {data.offers.length} library guide{data.offers.length === 1 ? ' was' : 's were'} updated since you customised your cop
            {data.offers.length === 1 ? 'y' : 'ies'}
          </p>
          <ul className="space-y-1.5 text-sm">
            {data.offers.map((o) => (
              <li key={o.copyId} className="flex flex-wrap items-center gap-2">
                <ClanLink href={`/admin/guides/${o.copyId}`} className="font-medium text-amber-200 hover:underline">
                  {o.copyTitle}
                </ClanLink>
                <span className="text-xs text-amber-200/70">
                  v{o.fromVersion} → v{o.toVersion}
                  {o.notes.find((n) => n.note) ? ` · ${o.notes.find((n) => n.note)!.note}` : ''}
                </span>
                <ClanLink href={`/admin/guides/${o.copyId}`} className="ml-auto text-xs text-gold hover:underline">
                  Review →
                </ClanLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['mine', 'library', 'categories'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
          >
            {t === 'mine' ? `Your guides (${data.guides.length})` : t === 'library' ? `Anvil library (${data.library.length})` : 'Categories'}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={cat}
            onChange={setCat}
            ariaLabel="Category"
            className="w-48"
            options={[
              { value: '', label: 'All categories' },
              ...data.categories.filter((c) => !c.archived).map((c) => ({ value: c.key, label: `${c.icon} ${c.label}${c.clanId ? ' · ours' : ''}` })),
            ]}
          />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-44" />
        </div>
      </div>

      {tab === 'library' && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
          <Checkbox
            checked={data.showLibrary}
            onChange={setShowLibrary}
            disabled={!data.canEdit}
            label="Show library guides on our site"
            description="Library guides you haven't copied appear on your Guides page too, always current. Copies replace their original either way."
          />
          {data.canEdit && data.library.some((g) => !g.copyId) && (
            <button
              onClick={copyAll}
              disabled={busy === -1}
              className="shrink-0 rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {busy === -1 ? 'Copying…' : `Copy all ${data.library.filter((g) => !g.copyId).length} to our guides`}
            </button>
          )}
        </div>
      )}

      {tab === 'categories' ? (
        <CategoryManager scope="clan" />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
          {tab === 'mine' ? (
            <>
              No guides yet. Copy one from the{' '}
              <button onClick={() => setTab('library')} className="text-gold hover:underline">
                Anvil library
              </button>{' '}
              or write your own.
            </>
          ) : (
            'Nothing matches.'
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g) => {
            const c = categoryOf(g.category, data.categories);
            const offer = offersByCopy.get(g.id);
            const isMine = tab === 'mine';
            const body = (
              <>
                {g.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.coverUrl} alt="" className="mb-3 h-28 w-full rounded-lg object-cover opacity-90" loading="lazy" />
                )}
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="uppercase tracking-widest text-gold/80">
                    {c.icon} {c.label}
                  </span>
                  {isMine && g.status !== 'published' && <span className="rounded-full bg-white/10 px-2 py-0.5 text-text-muted">draft</span>}
                  {isMine && g.sourceGuideId && g.followsSource && (
                    <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-300">follows library</span>
                  )}
                  {isMine && g.sourceGuideId && !g.followsSource && !offer && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-text-muted">customised</span>
                  )}
                  {offer && <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-amber-200">update available</span>}
                </div>
                <div className="font-bold group-hover:text-gold-light">{g.title}</div>
                {g.summary && <p className="mt-1 line-clamp-2 text-[13px] text-text-muted">{g.summary}</p>}
              </>
            );
            return isMine ? (
              <ClanLink
                key={g.id}
                href={`/admin/guides/${g.id}`}
                className="group rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40"
              >
                {body}
              </ClanLink>
            ) : (
              <div key={g.id} className="group flex flex-col rounded-xl border border-card-border bg-card-bg p-4">
                <div className="flex-1">{body}</div>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <ClanLink href={`/guides/${g.slug}`} target="_blank" className="text-text-muted hover:text-foreground">
                    Read ↗
                  </ClanLink>
                  {g.copyId ? (
                    <ClanLink href={`/admin/guides/${g.copyId}`} className="ml-auto text-emerald-300 hover:underline">
                      ✓ In your guides — open
                    </ClanLink>
                  ) : (
                    data.canEdit && (
                      <button
                        onClick={() => copy(g.id)}
                        disabled={busy === g.id}
                        className="ml-auto rounded-lg border border-gold/50 px-3 py-1 text-gold hover:bg-gold/10 disabled:opacity-50"
                      >
                        {busy === g.id ? 'Copying…' : 'Copy to our guides'}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
