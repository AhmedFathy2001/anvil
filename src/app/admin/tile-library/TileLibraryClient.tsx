'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import Textarea from '@/components/Textarea';
import { tileTierKey, type TierBand } from '@/lib/tileFilter';
import type { LibraryTask } from '@/lib/tileLibrary';

// The clan's task catalogue, as an editable list. Boards draw from this, so it's worth curating:
// the tasks here decide what a generated board feels like.
//
// Editing is deliberately scoped to what a curator changes in bulk — wording, value, category. The
// per-kind config (drop targets, thresholds, item lists) is carried verbatim from wherever the task
// came from and shown read-only; changing THAT is board work, and the board editor already does it
// properly with live locks. Harvesting an edited tile back replaces the task.

interface Props {
  tierBands: TierBand[];
  seedTotal: number;
}

export default function TileLibraryClient({ tierBands, seedTotal }: Props) {
  const [tasks, setTasks] = useState<LibraryTask[] | null>(null);
  const [pendingSeed, setPendingSeed] = useState(0);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<LibraryTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tile-library');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setPendingSeed(data.pendingSeedCount ?? 0);
    } catch {
      setMsg({ type: 'error', text: 'Could not load the task library.' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (tasks ?? []).forEach((t) => t.category && set.add(t.category));
    return [...set].sort();
  }, [tasks]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (q && !t.label.toLowerCase().includes(q) && !(t.category ?? '').toLowerCase().includes(q)) return false;
      if (tierFilter && t.tier !== tierFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, search, tierFilter, categoryFilter]);

  async function post(body: Record<string, unknown>, okText?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/tile-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'That didn’t work.' });
        return null;
      }
      if (okText) setMsg({ type: 'success', text: okText });
      await load();
      return data;
    } catch {
      setMsg({ type: 'error', text: 'That didn’t work.' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function importPack(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const packTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : null;
      if (!packTasks) {
        setMsg({ type: 'error', text: 'That file has no `tasks` array — is it a seed pack?' });
        return;
      }
      await post(
        {
          action: 'add',
          tasks: packTasks.map((t: { label?: string; points?: number; category?: string; config?: unknown }) => ({
            label: t.label ?? '',
            points: t.points ?? 0,
            category: t.category ?? null,
            config: t.config ?? {},
          })),
        },
        `Imported ${packTasks.length} task${packTasks.length === 1 ? '' : 's'}.`,
      );
    } catch {
      setMsg({ type: 'error', text: 'Could not read that file as JSON.' });
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tierLabel = (key: string | null) => tierBands.find((b) => b.key === key)?.label ?? '—';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-56"
        />
        <Select
          value={tierFilter}
          onChange={setTierFilter}
          ariaLabel="Filter by tier"
          className="w-40"
          options={[{ value: '', label: 'Any tier' }, ...tierBands.map((b) => ({ value: b.key, label: b.label }))]}
        />
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="Filter by category"
          className="w-44"
          options={[{ value: '', label: 'Any category' }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
        <span className="text-xs text-text-muted">
          {visible.length} of {tasks?.length ?? 0}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pendingSeed > 0 && (
            <button
              type="button"
              onClick={() => post({ action: 'seed' }, `Imported ${pendingSeed} starter tasks.`)}
              disabled={busy}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50"
              title={`${seedTotal} curated starter tasks ship with Anvil; ${pendingSeed} of them aren't in your library`}
            >
              Import {pendingSeed} starter task{pendingSeed === 1 ? '' : 's'}
            </button>
          )}
          <label className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors cursor-pointer">
            ⬆ Import pack
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importPack(f);
                e.target.value = '';
              }}
            />
          </label>
          <a
            href="/api/admin/tile-library/export"
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
            title="Download the whole library as a seed pack — share it with another site, or commit it as the default"
          >
            ⬇ Export pack
          </a>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Delete ${selected.size} task${selected.size === 1 ? '' : 's'} from the library?`)) return;
                post({ action: 'delete', ids: [...selected] }, `Deleted ${selected.size}.`).then(() => setSelected(new Set()));
              }}
              disabled={busy}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Delete {selected.size}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>{msg.text}</p>
      )}

      {/* List */}
      {tasks === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-text-muted">
          {tasks.length === 0
            ? 'Nothing here yet — import the starter tasks, a seed pack, or add a board’s tiles from its Tiles tab.'
            : 'No tasks match those filters.'}
        </p>
      ) : (
        <div className="border border-card-border rounded-xl overflow-hidden">
          {visible.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-3 py-2 text-sm ${i % 2 ? 'bg-card-bg' : 'bg-tile-bg'}`}
            >
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                className="accent-[var(--gold,#d4af37)]"
                aria-label={`Select ${t.label}`}
              />
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="flex-1 min-w-0 text-left hover:text-gold transition-colors"
              >
                <span className="block truncate">{t.label}</span>
                <span className="block text-[11px] text-text-muted truncate">
                  {t.tileType}
                  {t.category ? ` · ${t.category}` : ''}
                  {t.seedKey ? ' · starter' : t.sourceEventId ? ' · from a board' : ''}
                </span>
              </button>
              <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-gold/15 text-gold">
                {tierLabel(t.tier)}
              </span>
              <span className="shrink-0 text-xs text-text-muted tabular-nums w-14 text-right">{t.points}p</span>
            </div>
          ))}
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <EditTask
          task={editing}
          tierBands={tierBands}
          categories={categories}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const ok = await post({ action: 'update', id: editing.id, ...patch }, 'Saved.');
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditTask({
  task,
  tierBands,
  categories,
  busy,
  onClose,
  onSave,
}: {
  task: LibraryTask;
  tierBands: TierBand[];
  categories: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { label: string; description: string; points: number; category: string }) => void;
}) {
  const [label, setLabel] = useState(task.label);
  const [description, setDescription] = useState(task.description ?? '');
  const [points, setPoints] = useState(task.points);
  const [category, setCategory] = useState(task.category ?? '');

  const tier = tierTierLabel(points, tierBands);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${task.label}`}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg my-auto border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-card-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-5 bg-gold rounded-full shrink-0" />
            <h2 className="font-semibold truncate">Edit task</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Points <span className="text-text-muted/60">({tier})</span>
              </label>
              <NumberInput value={points} onChange={setPoints} min={0} max={100000} fallback={0} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="tile-library-categories"
                placeholder="e.g. Raids"
              />
              <datalist id="tile-library-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Read-only: the per-kind config travels with the task. Editing it belongs on a board,
              where the real tile editor (and its locking) lives. */}
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Tracking config <span className="text-text-muted/60">({task.tileType})</span>
            </label>
            <pre className="text-[11px] font-mono text-text-muted bg-brown-dark border border-card-border rounded-lg p-3 overflow-x-auto max-h-40">
              {JSON.stringify(task.config, null, 2)}
            </pre>
            <p className="text-[11px] text-text-muted mt-1">
              Carried from wherever this task came from. To change how it tracks, edit it on a board
              and add that board to the library again.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-card-border pt-3">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-text-muted hover:text-foreground">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !label.trim()}
              onClick={() => onSave({ label, description, points, category })}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gold text-brown-dark hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Live tier label for the points field — the same derivation the draw uses. */
function tierTierLabel(points: number, bands: TierBand[]): string {
  const key = tileTierKey(points, bands);
  return bands.find((b) => b.key === key)?.label ?? '—';
}
