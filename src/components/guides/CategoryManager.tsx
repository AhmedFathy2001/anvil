'use client';

import { useCallback, useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

interface Cat {
  id: number;
  key: string;
  label: string;
  icon: string;
  sortOrder: number;
  requiresLevels?: boolean;
  archived?: boolean;
  clanId?: number | null;
}

const input = 'rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none';

/**
 * Add, rename, reorder, archive and delete guide categories. `scope='platform'` manages the
 * platform list (and whether each needs every level); `scope='clan'` manages a clan's own extras and
 * shows the platform's beside them, read-only.
 */
export default function CategoryManager({ scope }: { scope: 'platform' | 'clan' }) {
  const { confirm, notify } = useDialog();
  const api = scope === 'platform' ? '/api/staff/guides/categories' : '/api/admin/guides/categories';
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState({ label: '', icon: '📖' });

  const load = useCallback(async () => {
    const res = await clanFetch(api, { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    setCats(j.categories);
    setCanEdit(j.canEdit);
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  const mine = (c: Cat) => (scope === 'platform' ? c.clanId == null : c.clanId != null);

  async function send(url: string, method: string, body?: unknown) {
    const res = await clanFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) notify(j.error ?? 'Failed', 'error');
    await load();
    return res.ok;
  }

  async function add() {
    if (!draft.label.trim()) return;
    if (await send(api, 'POST', { label: draft.label, icon: draft.icon })) setDraft({ label: '', icon: '📖' });
  }

  async function remove(c: Cat) {
    if (!(await confirm({ title: `Delete "${c.label}"?`, body: 'Only possible while no guide is filed under it. Archiving hides it from pickers instead.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await send(`${api}/${c.id}`, 'DELETE');
  }

  if (!cats) return <p className="text-sm text-text-muted">Loading…</p>;
  const editable = cats.filter(mine);
  const others = cats.filter((c) => !mine(c));

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-card-border rounded-xl border border-card-border bg-card-bg text-sm">
        {editable.map((c) => (
          <li key={c.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${c.archived ? 'opacity-60' : ''}`}>
            <input
              defaultValue={c.icon}
              disabled={!canEdit}
              onBlur={(e) => e.target.value !== c.icon && send(`${api}/${c.id}`, 'PATCH', { icon: e.target.value })}
              className={`${input} w-10 text-center`}
              aria-label="Icon"
            />
            <input
              defaultValue={c.label}
              disabled={!canEdit}
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.label && send(`${api}/${c.id}`, 'PATCH', { label: e.target.value })}
              className={`${input} min-w-0 flex-1`}
              aria-label="Name"
            />
            <input
              type="number"
              defaultValue={c.sortOrder}
              disabled={!canEdit}
              onBlur={(e) => Number(e.target.value) !== c.sortOrder && send(`${api}/${c.id}`, 'PATCH', { sortOrder: Number(e.target.value) })}
              className={`${input} w-16`}
              title="Order (lower first)"
              aria-label="Order"
            />
            {scope === 'platform' && (
              <label className="flex items-center gap-1 text-xs text-text-muted" title="Library guides here must cover Beginner, Intermediate and Advanced">
                <input type="checkbox" disabled={!canEdit} checked={c.requiresLevels !== false} onChange={(e) => send(`${api}/${c.id}`, 'PATCH', { requiresLevels: e.target.checked })} />
                needs every level
              </label>
            )}
            {canEdit && (
              <>
                <button onClick={() => send(`${api}/${c.id}`, 'PATCH', { archived: !c.archived })} className="text-xs text-text-muted hover:text-gold">
                  {c.archived ? 'Restore' : 'Archive'}
                </button>
                <button onClick={() => remove(c)} className="text-xs text-red-300 hover:underline">
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
        {editable.length === 0 && <li className="px-3 py-3 text-xs text-text-muted">{scope === 'clan' ? 'No categories of your own yet.' : 'No categories.'}</li>}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className={`${input} w-10 text-center`} aria-label="Icon" />
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={scope === 'clan' ? 'e.g. Clan PvM, Events' : 'New category'}
            className={`${input} w-56`}
          />
          <button onClick={add} className="rounded-lg bg-gold px-3 py-1 text-xs font-semibold text-brown-dark hover:bg-gold-light">
            Add category
          </button>
        </div>
      )}

      {scope === 'clan' && others.length > 0 && (
        <p className="text-xs text-text-muted">
          Anvil&apos;s categories, always available:{' '}
          {others
            .filter((c) => !c.archived)
            .map((c) => `${c.icon} ${c.label}`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
