'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import Input from '@/components/Input';
import Select from '@/components/Select';
import AnvilTaskEditor, { type AnvilTaskDraft } from '@/components/AnvilTaskEditor';
import { tileTierKey, type TierBand } from '@/lib/tileFilter';
import { TILE_KIND_BADGES, tileKindKey, type TileKindLike } from '@/lib/tileKinds';
import type { AnvilTask } from '@/lib/libraryTasks';
import type { TaskOffer } from '@/lib/libraryTasks';
import type { LibraryProposal } from '@/lib/libraryProposals';

type Row = AnvilTask & { imported: boolean };

const STATUS_TEXT: Record<LibraryProposal['status'], string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Not taken',
  withdrawn: 'Withdrawn',
};

/**
 * Anvil's task library, from a clan's side: browse with filters, import what you want into your own
 * library (copies follow Anvil until you edit them), answer Anvil's updates to tasks you've edited,
 * and suggest new tasks or fixes for Anvil to review.
 */
export default function AnvilLibraryBrowser({ tierBands, onImported }: { tierBands: TierBand[]; onImported: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [offers, setOffers] = useState<TaskOffer[]>([]);
  const [mine, setMine] = useState<LibraryProposal[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('');
  const [kind, setKind] = useState('');
  const [hideImported, setHideImported] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [suggesting, setSuggesting] = useState<{ task: AnvilTask | null } | null>(null);

  const load = useCallback(async () => {
    const [t, o, p] = await Promise.all([
      clanFetch('/api/admin/library/tasks').then((r) => (r.ok ? r.json() : null)),
      clanFetch('/api/admin/library/offers').then((r) => (r.ok ? r.json() : null)),
      clanFetch('/api/library/proposals').then((r) => (r.ok ? r.json() : null)),
    ]);
    if (t) {
      setRows(t.tasks);
      setCategories(t.categories);
    } else setRows([]);
    setOffers(o?.offers ?? []);
    setMine(p?.proposals ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after its fetches resolve
    void load();
  }, [load]);

  const kindOf = (t: AnvilTask) => tileKindKey(t.config as TileKindLike);
  const visible = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (rows ?? []).filter((t) => {
      if (hideImported && t.imported) return false;
      if (category && t.category !== category) return false;
      if (tier && tileTierKey(t.points, tierBands) !== tier) return false;
      if (kind && kindOf(t) !== kind) return false;
      const hay = `${t.label} ${t.category ?? ''} ${t.description ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, q, category, tier, kind, hideImported, tierBands]);
  const kinds = useMemo(() => [...new Set((rows ?? []).map(kindOf))], [rows]);
  const importable = visible.filter((t) => !t.imported);

  async function importIds(ids: number[]) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await clanFetch('/api/admin/library/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error || 'That didn’t work.' });
      else {
        setMsg({ ok: true, text: `Added ${data.added} task${data.added === 1 ? '' : 's'} to your library. They follow Anvil’s updates until you edit them.` });
        setPicked(new Set());
        await load();
        onImported();
      }
    } finally {
      setBusy(false);
    }
  }

  async function answer(rowIds: number[], a: 'take' | 'keep') {
    setBusy(true);
    try {
      await clanFetch('/api/admin/library/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds, answer: a }),
      });
      await load();
      onImported();
    } finally {
      setBusy(false);
    }
  }

  async function suggest(draft: AnvilTaskDraft, note: string, target: AnvilTask | null): Promise<string | null> {
    const res = await clanFetch('/api/library/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: target ? 'task-edit' : 'task-new', targetTaskId: target?.id, payload: draft, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'Could not send that.';
    setMsg({ ok: true, text: 'Sent to Anvil for review. You’ll see the answer under “Your suggestions”.' });
    await load();
    return null;
  }

  async function withdraw(id: number) {
    await clanFetch(`/api/library/proposals/${id}`, { method: 'DELETE' });
    await load();
  }

  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-muted leading-relaxed">
        Tasks Anvil keeps set up and up to date. Add the ones you want to your library: they stay in step with Anvil
        until you change them, and then they&apos;re yours. Spot something wrong, or a task that&apos;s missing? Suggest it.
      </p>

      {offers.length > 0 && (
        <div className="rounded-xl border border-gold/35 bg-gold/[0.06] p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Anvil updated {offers.length} task{offers.length === 1 ? '' : 's'} you&apos;d changed
            </p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => answer(offers.map((o) => o.rowId), 'take')} className="text-xs px-2.5 py-1 rounded-lg bg-gold text-brown-dark font-semibold disabled:opacity-50">
                Take all
              </button>
              <button disabled={busy} onClick={() => answer(offers.map((o) => o.rowId), 'keep')} className="text-xs px-2.5 py-1 rounded-lg border border-card-border disabled:opacity-50">
                Keep mine
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {offers.map((o) => (
              <li key={o.rowId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  {o.label}
                  <span className="text-xs text-text-muted"> · Anvil&apos;s now: {o.task.label}, {o.task.points} pts</span>
                </span>
                <span className="flex gap-1.5">
                  <button disabled={busy} onClick={() => answer([o.rowId], 'take')} className="text-xs px-2 py-0.5 rounded border border-gold/40 text-gold disabled:opacity-50">
                    Take Anvil&apos;s
                  </button>
                  <button disabled={busy} onClick={() => answer([o.rowId], 'keep')} className="text-xs px-2 py-0.5 rounded border border-card-border disabled:opacity-50">
                    Keep mine
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-text-muted">Taking Anvil&apos;s version also makes the task follow Anvil again.</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search Anvil tasks" />
        <Select
          value={category}
          onChange={setCategory}
          ariaLabel="Category"
          options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          value={tier}
          onChange={setTier}
          ariaLabel="Difficulty"
          options={[{ value: '', label: 'All difficulties' }, ...tierBands.map((b) => ({ value: b.key, label: b.label }))]}
        />
        <Select
          value={kind}
          onChange={setKind}
          ariaLabel="Kind"
          options={[{ value: '', label: 'All kinds' }, ...kinds.map((k) => ({ value: k, label: TILE_KIND_BADGES[k]?.label ?? k }))]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-text-muted">
          <input type="checkbox" checked={hideImported} onChange={(e) => setHideImported(e.target.checked)} />
          Hide ones I have
        </label>
        <span className="text-text-muted">
          {visible.length} shown{picked.size ? ` · ${picked.size} picked` : ''}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={busy || picked.size === 0}
            onClick={() => importIds([...picked])}
            className="px-3 py-1.5 rounded-lg bg-gold text-brown-dark font-semibold text-sm disabled:opacity-40"
          >
            Add {picked.size || ''} to my library
          </button>
          <button
            disabled={busy || importable.length === 0}
            onClick={() => importIds(importable.map((t) => t.id))}
            className="px-3 py-1.5 rounded-lg border border-card-border text-sm disabled:opacity-40"
          >
            Add all {importable.length} shown
          </button>
          <button onClick={() => setSuggesting({ task: null })} className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-sm">
            Suggest a new task
          </button>
        </span>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{msg.text}</p>}

      {rows === null ? (
        <p className="text-sm text-text-muted">Loading Anvil&apos;s library…</p>
      ) : (
        <ul className="divide-y divide-card-border/60 rounded-xl border border-card-border bg-card-bg">
          {visible.map((t) => {
            const tierKey = tileTierKey(t.points, tierBands);
            const tierLabel = tierBands.find((b) => b.key === tierKey)?.label;
            const badge = TILE_KIND_BADGES[kindOf(t)];
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Pick ${t.label}`}
                  disabled={t.imported}
                  checked={picked.has(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">{t.label}</span>
                  <span className="block text-[11px] text-text-muted truncate">
                    {[t.category, tierLabel, `${t.points} pts`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {badge && <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>}
                {t.imported && <span className="text-[10px] text-accent-green-light whitespace-nowrap">In your library</span>}
                <button onClick={() => setSuggesting({ task: t })} className="text-[11px] text-text-muted hover:text-gold whitespace-nowrap">
                  Suggest a fix
                </button>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">Nothing matches those filters.</li>}
        </ul>
      )}

      {mine.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Your suggestions</h3>
          <ul className="space-y-1.5">
            {mine.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border border-card-border px-3 py-2">
                <span className="min-w-0">
                  {p.kind === 'task-new' ? 'New task' : p.kind === 'task-edit' ? 'Fix' : 'Board change'}:{' '}
                  {p.targetTitle ?? (p.payload as { label?: string }).label ?? 'board'}
                  <span className="text-xs text-text-muted"> · {STATUS_TEXT[p.status]}</span>
                  {p.reviewNote && <span className="block text-xs text-text-muted">Anvil: {p.reviewNote}</span>}
                </span>
                {p.status === 'pending' && (
                  <button onClick={() => withdraw(p.id)} className="text-xs text-text-muted hover:text-foreground">
                    Withdraw
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggesting && (
        <AnvilTaskEditor
          title={suggesting.task ? `Suggest a fix: ${suggesting.task.label}` : 'Suggest a new task'}
          task={suggesting.task}
          mode="suggest"
          lookupApi="/api/admin"
          categorySuggestions={categories}
          onSubmit={(draft, note) => suggest(draft, note, suggesting.task)}
          onClose={() => setSuggesting(null)}
        />
      )}
    </div>
  );
}
