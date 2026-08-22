'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Input from '@/components/Input';
import Select from '@/components/Select';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import { type TierBand } from '@/lib/tileFilter';
import type { TileConfig } from '@/lib/types';
import type { LibraryTask } from '@/lib/tileLibrary';
import { libraryShape, type Finding } from '@/lib/libraryShape';
import { blankTileConfig, payloadToCsvRow, toTileConfig } from './taskConfig';

// The clan's task catalogue, as an editable list. Boards draw from this, so it's worth curating:
// the tasks here decide what a generated board feels like.
//
// Tasks are authored with the SAME editor the board uses — kind picker, item search, thresholds,
// the lot. A task is just a tile without a board, so anything else would mean a second, worse tile
// editor and a curator staring at JSON.
//
// The page opens with the SHAPE of the pool (lib/libraryShape) rather than the pool itself: a flat
// list sorted by points could never show that Ultra held four tasks or that the same whip was in
// there twice, and those are the things that decide whether a generated board is any good.

interface Props {
  tierBands: TierBand[];
  seedTotal: number;
}

/**
 * Difficulty ramp, by band POSITION rather than key — bands are renamed and retuned by each clan,
 * so keying colours off 'ultra' would leave a custom band grey.
 */
const TIER_RAMP = [
  { bar: 'bg-text-muted', chip: 'bg-text-muted/15 text-text-muted border-text-muted/30', rail: 'border-l-text-muted' },
  { bar: 'bg-accent-green', chip: 'bg-accent-green/15 text-accent-green-light border-accent-green/30', rail: 'border-l-accent-green' },
  { bar: 'bg-gold', chip: 'bg-gold/15 text-gold border-gold/30', rail: 'border-l-gold' },
  { bar: 'bg-orange-500', chip: 'bg-orange-500/15 text-orange-400 border-orange-500/30', rail: 'border-l-orange-500' },
  { bar: 'bg-accent-red', chip: 'bg-accent-red/15 text-red-300 border-accent-red/30', rail: 'border-l-accent-red' },
];

function ramp(index: number, of: number) {
  if (of <= 1) return TIER_RAMP[2];
  // Spread however many bands the clan has across the five steps of the ramp.
  const step = Math.round((index / (of - 1)) * (TIER_RAMP.length - 1));
  return TIER_RAMP[Math.min(TIER_RAMP.length - 1, Math.max(0, step))];
}

/** One glyph per tile kind, so a row is recognised by shape before it's read. */
const KIND_MARK: Record<string, { mark: string; tone: string }> = {
  standard: { mark: '□', tone: 'bg-brown-light text-text-muted' },
  skill: { mark: '▲', tone: 'bg-blue-500/15 text-blue-300' },
  boss: { mark: '⚔', tone: 'bg-accent-red/15 text-red-300' },
  kill: { mark: '⚔', tone: 'bg-accent-red/15 text-red-300' },
  drop: { mark: '◈', tone: 'bg-purple-400/15 text-purple-300' },
  collection: { mark: '◈', tone: 'bg-purple-400/15 text-purple-300' },
  lap: { mark: '↻', tone: 'bg-teal-400/15 text-teal-300' },
  pvp: { mark: '☠', tone: 'bg-accent-red/15 text-red-300' },
  gain: { mark: '＋', tone: 'bg-teal-400/15 text-teal-300' },
  timed: { mark: '◷', tone: 'bg-blue-500/15 text-blue-300' },
  deathless: { mark: '♥', tone: 'bg-accent-green/15 text-accent-green-light' },
  lms: { mark: '★', tone: 'bg-gold/15 text-gold' },
  value: { mark: '◆', tone: 'bg-gold/15 text-gold' },
  diary: { mark: '✦', tone: 'bg-accent-green/15 text-accent-green-light' },
  ca: { mark: '✚', tone: 'bg-orange-500/15 text-orange-400' },
};

const UNKNOWN_KIND = { mark: '·', tone: 'bg-brown-light text-text-muted' };

export default function TileLibraryClient({ tierBands, seedTotal }: Props) {
  const [tasks, setTasks] = useState<LibraryTask[] | null>(null);
  const [pendingSeed, setPendingSeed] = useState(0);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /** Ids a finding has pointed at — the list narrows to them until dismissed. */
  const [focusIds, setFocusIds] = useState<number[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The editor target: an existing task, or 'new' for one that doesn't exist yet. `draft` holds the
  // TileConfig the editor is mounted with (item ids resolved), null while that resolution runs.
  const [editing, setEditing] = useState<LibraryTask | 'new' | null>(null);
  const [draft, setDraft] = useState<TileConfig | null>(null);
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

  const shape = useMemo(
    () => libraryShape(tasks ?? [], tierBands.map((b) => ({ key: b.key, label: b.label }))),
    [tasks, tierBands],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (focusIds && !focusIds.includes(t.id)) return false;
      if (q && !t.label.toLowerCase().includes(q) && !(t.category ?? '').toLowerCase().includes(q)) return false;
      if (tierFilter && t.tier !== tierFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (kindFilter && t.tileType !== kindFilter) return false;
      return true;
    });
  }, [tasks, search, tierFilter, categoryFilter, kindFilter, focusIds]);

  /** Grouped by band, hardest first — the end of the pool people actually curate. */
  const groups = useMemo(() => {
    const order = [...tierBands].reverse();
    const out = order.map((band, i) => ({
      band,
      ramp: ramp(tierBands.length - 1 - i, tierBands.length),
      rows: visible
        .filter((t) => t.tier === band.key)
        .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label)),
    }));
    const untiered = visible.filter((t) => !t.tier || !tierBands.some((b) => b.key === t.tier));
    if (untiered.length) {
      out.push({
        band: { key: '__none', label: 'No band', min: 0 },
        ramp: TIER_RAMP[0],
        rows: untiered.sort((a, b) => b.points - a.points),
      });
    }
    return out.filter((g) => g.rows.length > 0);
  }, [visible, tierBands]);

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

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function openTask(task: LibraryTask) {
    setEditing(task);
    setDraft(null);
    setDraft(
      await toTileConfig(task.config, {
        label: task.label,
        points: task.points,
        category: task.category,
        description: task.description,
      }),
    );
  }

  function openNew() {
    setEditing('new');
    setDraft(blankTileConfig());
  }

  function closeEditor() {
    setEditing(null);
    setDraft(null);
  }

  /** The editor hands back the same payload the board API would get; store it as a CSV row. */
  async function saveFromEditor(payload: Record<string, unknown>): Promise<TileConfig | null> {
    const config = payloadToCsvRow(payload);
    const common = {
      label: (payload.label as string) || 'Untitled task',
      points: (payload.points as number) ?? 0,
      category: (payload.category as string | null) ?? null,
      description: (payload.description as string | null) ?? null,
      config,
    };
    const ok =
      editing === 'new'
        ? await post({ action: 'add', tasks: [{ ...common, tileType: config.tileType ?? 'standard' }] }, 'Task added.')
        : await post({ action: 'update', id: (editing as LibraryTask).id, ...common }, 'Saved.');
    if (!ok) return null;
    closeEditor();
    return { ...(payload as unknown as TileConfig), updatedAt: null };
  }

  /** Save a copy under a new name, so a near-duplicate doesn't mean retyping the whole tile. */
  async function duplicate(task: LibraryTask) {
    await post(
      {
        action: 'add',
        tasks: [
          {
            label: `${task.label} (copy)`,
            points: task.points,
            category: task.category,
            description: task.description,
            config: task.config,
            tileType: task.tileType,
          },
        ],
      },
      'Duplicated.',
    );
  }

  async function deleteOne(task: LibraryTask) {
    if (!confirm(`Delete “${task.label}” from the library?`)) return;
    await post({ action: 'delete', ids: [task.id] }, 'Deleted.');
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
  }

  const anyFilter = !!(search || tierFilter || categoryFilter || kindFilter || focusIds);

  function clearFilters() {
    setSearch('');
    setTierFilter('');
    setCategoryFilter('');
    setKindFilter('');
    setFocusIds(null);
  }

  return (
    <div className="space-y-4">
      {tasks !== null && tasks.length > 0 && (
        <ShapePanel
          shape={shape}
          bands={tierBands}
          activeTier={tierFilter}
          onPickTier={(key) => {
            setFocusIds(null);
            setTierFilter((cur) => (cur === key ? '' : key));
          }}
          onFocus={(ids) => {
            clearFilters();
            setFocusIds(ids);
          }}
        />
      )}

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
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="Filter by category"
          className="w-44"
          options={[
            { value: '', label: 'Any category' },
            ...shape.categories.map((c) => ({ value: c.key, label: `${c.key} (${c.count})` })),
          ]}
        />
        <Select
          value={kindFilter}
          onChange={setKindFilter}
          ariaLabel="Filter by tile kind"
          className="w-40"
          options={[
            { value: '', label: 'Any kind' },
            ...shape.kinds.map((k) => ({ value: k.key, label: `${k.key} (${k.count})` })),
          ]}
        />
        <span className="text-xs text-text-muted">
          {visible.length === (tasks?.length ?? 0)
            ? `${visible.length} task${visible.length === 1 ? '' : 's'}`
            : `${visible.length} of ${tasks?.length ?? 0}`}
        </span>
        {anyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-gold hover:text-gold-light underline underline-offset-2"
          >
            Clear
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNew}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold text-brown-dark hover:bg-gold-light transition-colors"
          >
            ＋ New task
          </button>
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
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>{msg.text}</p>
      )}

      {/* List, grouped by difficulty band */}
      {tasks === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-text-muted">
          {tasks.length === 0
            ? 'Nothing here yet — import the starter tasks, a seed pack, or add a board’s tiles from its Tiles tab.'
            : 'No tasks match those filters.'}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.band.key);
            const points = g.rows.map((r) => r.points);
            return (
              <div key={g.band.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.band.key)}
                  aria-expanded={!isCollapsed}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 bg-brown-dark/40 border border-card-border ${
                    isCollapsed ? 'rounded-xl' : 'rounded-t-xl border-b-0'
                  } hover:bg-brown-light transition-colors text-left`}
                >
                  <span className={`w-2 h-2 rounded-sm ${g.ramp.bar}`} />
                  <span className="text-sm font-semibold">{g.band.label}</span>
                  <span className="text-[11px] text-text-muted tabular-nums">
                    {g.rows.length} · {Math.min(...points)}–{Math.max(...points)}p
                  </span>
                  <span className="ml-auto text-xs text-text-muted">{isCollapsed ? '▸' : '▾'}</span>
                </button>

                {!isCollapsed && (
                  <div className="border border-card-border rounded-b-xl overflow-hidden">
                    {g.rows.map((t) => {
                      const kind = KIND_MARK[t.tileType] ?? UNKNOWN_KIND;
                      return (
                        <div
                          key={t.id}
                          className={`group flex items-center gap-3 pr-3 py-1.5 text-sm border-l-[3px] ${g.ramp.rail} border-b border-card-border last:border-b-0 ${
                            selected.has(t.id) ? 'bg-gold/[0.07]' : 'bg-card-bg hover:bg-card-bg-hover'
                          } transition-colors`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggle(t.id)}
                            className="ml-3 accent-[var(--gold,#d4af37)]"
                            aria-label={`Select ${t.label}`}
                          />
                          <span
                            className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[13px] ${kind.tone}`}
                            title={t.tileType}
                            aria-hidden
                          >
                            {kind.mark}
                          </span>
                          <button
                            type="button"
                            onClick={() => openTask(t)}
                            className="flex-1 min-w-0 text-left hover:text-gold transition-colors"
                          >
                            <span className="block truncate">{t.label}</span>
                            <span className="block text-[11px] text-text-muted truncate">
                              {t.tileType}
                              {t.category ? ` · ${t.category}` : ''}
                              {t.seedKey ? ' · starter' : t.sourceEventId ? ' · from a board' : ''}
                            </span>
                          </button>
                          <span className="shrink-0 text-xs text-text-muted tabular-nums w-14 text-right">
                            {t.points}p
                          </span>
                          <span className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <RowAction label={`Edit ${t.label}`} onClick={() => openTask(t)} mark="✎" />
                            <RowAction
                              label={`Duplicate ${t.label}`}
                              onClick={() => duplicate(t)}
                              mark="⧉"
                              disabled={busy}
                            />
                            <RowAction
                              label={`Delete ${t.label}`}
                              onClick={() => deleteOne(t)}
                              mark="✕"
                              disabled={busy}
                              danger
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk bar — only ever present when there's a selection to act on. */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 border border-gold/30 rounded-xl bg-card-bg/95 backdrop-blur px-3.5 py-2.5 shadow-lg shadow-black/40">
          <span className="text-sm font-semibold text-gold">
            {selected.size} selected
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {(tasks ?? [])
              .filter((t) => selected.has(t.id))
              .reduce((n, t) => n + t.points, 0)}
            p combined
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Set(visible.map((t) => t.id)))}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-card-border hover:border-gold/40 hover:text-gold transition-colors"
          >
            Select all {visible.length} shown
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete ${selected.size} task${selected.size === 1 ? '' : 's'} from the library?`)) return;
              post({ action: 'delete', ids: [...selected] }, `Deleted ${selected.size}.`).then(() =>
                setSelected(new Set()),
              );
            }}
            disabled={busy}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            Delete {selected.size}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-text-muted hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Editor — the board's own tile editor, driving a task instead of a tile row. */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing === 'new' ? 'New task' : `Edit ${editing.label}`}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={closeEditor} />
          <div className="relative w-full max-w-2xl border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-card-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1 h-5 bg-gold rounded-full shrink-0" />
                <h2 className="font-semibold truncate">
                  {editing === 'new' ? 'New task' : editing.label}
                </h2>
              </div>
              <button
                onClick={closeEditor}
                aria-label="Close"
                className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              {draft === null ? (
                <p className="text-sm text-text-muted">Loading the task…</p>
              ) : (
                <TileTrackingConfig
                  initial={draft}
                  onSave={saveFromEditor}
                  onSaved={() => { /* saveFromEditor already refreshed the list and closed */ }}
                  pointsMode
                  tierBands={tierBands}
                  categorySuggestions={categories}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowAction({
  label,
  onClick,
  mark,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  mark: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-7 h-7 rounded-md grid place-items-center text-xs border border-transparent transition-colors disabled:opacity-40 ${
        danger
          ? 'text-text-muted hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10'
          : 'text-text-muted hover:text-gold hover:border-gold/30 hover:bg-gold/10'
      }`}
    >
      {mark}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   The shape of the pool, before the pool itself.
   --------------------------------------------------------------------------- */

function ShapePanel({
  shape,
  bands,
  activeTier,
  onPickTier,
  onFocus,
}: {
  shape: ReturnType<typeof libraryShape>;
  bands: TierBand[];
  activeTier: string;
  onPickTier: (key: string) => void;
  onFocus: (ids: number[]) => void;
}) {
  const filled = shape.tiers.filter((t) => t.count > 0);
  return (
    <div className="grid gap-px lg:grid-cols-[1.4fr_1fr] rounded-xl overflow-hidden border border-card-border bg-card-border">
      <div className="bg-card-bg p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">Difficulty spread</span>
          <span className="text-[11px] text-text-muted tabular-nums">{shape.total} tasks</span>
        </div>

        {/* One bar, segmented by band. Clicking a segment filters to it. */}
        <div className="flex gap-0.5 h-7 mt-2.5 rounded-md overflow-hidden">
          {filled.map((t) => {
            const idx = bands.findIndex((b) => b.key === t.key);
            const r = ramp(idx < 0 ? 0 : idx, bands.length);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onPickTier(t.key)}
                aria-pressed={activeTier === t.key}
                title={`${t.label}: ${t.count} task${t.count === 1 ? '' : 's'}${
                  t.range ? ` · ${t.range.min}–${t.range.max}p` : ''
                }`}
                style={{ width: `${Math.max(4, t.share * 100)}%` }}
                className={`${r.bar} grid place-items-center text-[10px] font-bold text-brown-dark hover:brightness-110 transition-[filter] ${
                  activeTier && activeTier !== t.key ? 'opacity-40' : ''
                }`}
              >
                {t.share > 0.06 ? t.count : ''}
              </button>
            );
          })}
          {filled.length === 0 && <div className="flex-1 bg-brown-light" />}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-text-muted">
          {shape.tiers.map((t) => {
            const idx = bands.findIndex((b) => b.key === t.key);
            const r = ramp(idx < 0 ? 0 : idx, bands.length);
            return (
              <span key={t.key} className={`inline-flex items-center gap-1.5 ${t.count === 0 ? 'opacity-50' : ''}`}>
                <span className={`w-2 h-2 rounded-sm ${r.bar}`} />
                {t.label}
                <span className="tabular-nums">{t.count}</span>
              </span>
            );
          })}
        </div>

        {shape.findings.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {shape.findings.map((f) => (
              <FindingRow key={f.key} finding={f} onFocus={onFocus} />
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card-bg p-4">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">What the pool covers</span>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {shape.categories.length === 0 ? (
            <p className="text-xs text-text-muted">No task has a category yet.</p>
          ) : (
            shape.categories.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-card-border bg-brown-light/40 text-text-muted"
              >
                {c.key}
                <span className="tabular-nums text-foreground">{c.count}</span>
              </span>
            ))
          )}
        </div>

        <div className="mt-3 text-[11px] text-text-muted">
          <span className="text-foreground tabular-nums">{shape.kinds.length}</span> tile kind
          {shape.kinds.length === 1 ? '' : 's'} in use
          {shape.kinds.length > 0 && (
            <>
              {' · '}
              {shape.kinds
                .slice(0, 4)
                .map((k) => `${k.key} ${k.count}`)
                .join(', ')}
              {shape.kinds.length > 4 ? '…' : ''}
            </>
          )}
        </div>

        {shape.thinnest && (
          <p className="mt-3 text-[11px] text-text-muted">
            Thinnest band is{' '}
            <span className="text-foreground">{shape.thinnest.label}</span> at{' '}
            <span className="tabular-nums text-foreground">{shape.thinnest.count}</span> — the most
            you can draw from it without a repeat.
          </p>
        )}
      </div>
    </div>
  );
}

function FindingRow({ finding, onFocus }: { finding: Finding; onFocus: (ids: number[]) => void }) {
  const warn = finding.level === 'warn';
  return (
    <li
      className={`flex items-start gap-2 text-[11px] rounded-lg px-2.5 py-1.5 border ${
        warn
          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200/90'
          : 'border-card-border bg-brown-light/30 text-text-muted'
      }`}
    >
      <span className={warn ? 'text-yellow-400' : 'text-text-muted'}>{warn ? '⚠' : 'ⓘ'}</span>
      <span className="flex-1">{finding.message}</span>
      {finding.ids.length > 0 && (
        <button
          type="button"
          onClick={() => onFocus(finding.ids)}
          className="shrink-0 underline underline-offset-2 hover:text-gold"
        >
          Show
        </button>
      )}
    </li>
  );
}
