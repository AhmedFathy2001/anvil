'use client';

import { useCallback, useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

interface Run {
  id: number;
  layout: string;
  label: string;
  createdAt: string;
  posts: number;
  created: number;
}

/**
 * Past bulk posts, each undoable in one go: Anvil deletes the channels, forum and category it made
 * for the run (or, for a run into an existing channel, each post). `refreshKey` reloads the list after
 * a new bulk post.
 */
export default function BulkRunsList({ refreshKey }: { refreshKey: number }) {
  const { confirm, notify } = useDialog();
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch('/api/admin/guides/bulk-runs', { cache: 'no-store' });
    if (res.ok) setRuns((await res.json()).runs ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function remove(r: Run) {
    const ok = await confirm({
      title: 'Remove this bulk post from Discord?',
      body:
        r.layout === 'existing'
          ? `Deletes the ${r.posts} guide post${r.posts === 1 ? '' : 's'} it made in that channel.`
          : `Deletes what Anvil created for it — ${r.created} channel${r.created === 1 ? '' : 's'}/categor${r.created === 1 ? 'y' : 'ies'} — and everything posted in them. Your guides stay on the site.`,
      confirmLabel: 'Remove from Discord',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(r.id);
    try {
      const res = await clanFetch(`/api/admin/guides/bulk-runs/${r.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({ errors: ['Failed'] }));
      if (j.ok) notify('Removed from Discord');
      else notify(`Partly removed: ${(j.errors ?? []).join(' ')}`, 'error');
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!runs.length) return null;
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-3">
      <h3 className="mb-2 text-sm font-semibold">Bulk posts in Discord</h3>
      <ul className="divide-y divide-card-border text-xs">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="text-text-muted">
              {r.posts} post{r.posts === 1 ? '' : 's'} · {r.createdAt.slice(0, 10)}
            </span>
            <button
              type="button"
              onClick={() => remove(r)}
              disabled={busy != null}
              className="rounded border border-red-950 px-2 py-0.5 text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              {busy === r.id ? 'Removing…' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
