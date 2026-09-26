'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanLink from '@/components/ClanLink';

import { useDialog } from '@/components/Confirm';
import { categoryOf } from '@/lib/guideCategories';

interface Row {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  version: number;
  updatedAt: string;
  copies: number;
  following: number;
}

/** The Anvil guide library — what every clan sees on /guides and copies from. */
export default function LibraryAdminClient({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const { ask, notify } = useDialog();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/staff/guides');
    if (res.ok) setRows((await res.json()).guides);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const title = await ask({ title: 'New library guide', label: 'Title', placeholder: 'e.g. Vorkath for beginners', confirmLabel: 'Create draft' });
    if (!title?.trim()) return;
    const res = await fetch('/api/staff/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return notify(j.error ?? 'Could not create', 'error');
    router.push(`/staff/guides/${j.guide.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gold">Guide library</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Anvil&apos;s own guides. Published ones show on every clan&apos;s Guides page and in the admin library to copy from. Copies that
            nobody edited follow along automatically; edited copies are offered each update with your note.
          </p>
        </div>
        {canEdit && (
          <button onClick={create} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light">
            New guide
          </button>
        )}
      </div>

      {!rows ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">The library is empty.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr className="border-b border-card-border">
                <th className="px-4 py-2 font-normal">Guide</th>
                <th className="px-4 py-2 font-normal">Status</th>
                <th className="px-4 py-2 font-normal">Version</th>
                <th className="px-4 py-2 font-normal">Copies</th>
                <th className="px-4 py-2 font-normal">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = categoryOf(r.category);
                return (
                  <tr key={r.id} className="border-b border-card-border/60 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <ClanLink href={`/staff/guides/${r.id}`} className="font-medium hover:text-gold">
                        {r.title}
                      </ClanLink>
                      <div className="text-[11px] text-text-muted">
                        {c.icon} {c.label}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          r.status === 'published' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/10 text-text-muted'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">v{r.version}</td>
                    <td className="px-4 py-2.5 text-text-muted">
                      {r.copies}
                      {r.copies > 0 && <span className="text-[11px]"> ({r.following} following)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">{r.updatedAt.slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
