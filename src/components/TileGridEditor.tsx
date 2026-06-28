'use client';

import { useMemo, useRef, useState } from 'react';
import type { Tile } from '@/lib/types';
import { SKILLS, SKILL_LABELS, BOSSES } from '@/lib/constants';
import type { TileCsvRow, TileCsvItem } from '@/lib/csvTiles';
import ItemAutocomplete from '@/components/ItemAutocomplete';
import NpcAutocomplete from '@/components/NpcAutocomplete';

// Fast, spreadsheet-style tile editor that lives on the site (replaces the round-trip to Google
// Sheets / CSV). Rows are tiles; common fields edit inline, type-specific config (items / NPCs /
// stat goal / timed) opens in an expandable detail row with real item & NPC autocomplete. Bulk
// create via "Add rows" / "Paste labels". Saving sends the whole grid through the existing
// /tiles/import pipeline (maps by position, updates + creates, resolves item names → ids), so
// there's no new save backend and autocomplete-picked items carry their id for a clean resolve.

type Kind = 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'timed';

interface DraftItem {
  id?: number;
  name: string;
  count: number;
}

interface Draft {
  key: string;
  id?: number; // existing tile id (absent for unsaved new rows) — needed to DELETE server-side
  label: string;
  description: string;
  kind: Kind;
  points: number;
  category: string;
  optional: boolean;
  trackedStat: string;
  statGoal: number | '';
  requiredAmount: number | '';
  items: DraftItem[];
  targetNpcs: string[];
  timedActivity: string;
  timeThresholdSeconds: number | '';
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'skill', label: 'Skill goal' },
  { value: 'boss', label: 'Boss KC' },
  { value: 'drop', label: 'Drop (pool)' },
  { value: 'collection', label: 'Collection' },
  { value: 'kill', label: 'Kill count' },
  { value: 'timed', label: 'Timed' },
];

let keySeq = 0;
const newKey = () => `d${keySeq++}`;

function kindOf(t: Tile): Kind {
  if (t.tileType === 'kill') return 'kill';
  if (t.tileType === 'timed') return 'timed';
  if (t.tileType === 'drop') {
    const isCollection = !!t.itemRequirements && t.itemRequirements !== '[]' && t.itemRequirements !== 'null';
    return isCollection ? 'collection' : 'drop';
  }
  if (t.statType === 'skill') return 'skill';
  if (t.statType === 'boss') return 'boss';
  return 'standard';
}

function tileToDraft(t: Tile): Draft {
  const kind = kindOf(t);
  let items: DraftItem[] = [];
  if (kind === 'collection') {
    try {
      const reqs = JSON.parse(t.itemRequirements || '[]') as { itemId: number; name: string; requiredAmount: number }[];
      items = reqs.map((r) => ({ id: r.itemId, name: r.name && !/^Item #\d+$/.test(r.name) ? r.name : '', count: r.requiredAmount || 1 }));
    } catch { /* ignore */ }
  } else if (kind === 'drop') {
    try {
      const ids = JSON.parse(t.trackedItemIds || '[]') as number[];
      items = ids.map((id) => ({ id, name: '', count: 1 }));
    } catch { /* ignore */ }
  }
  let targetNpcs: string[] = [];
  try {
    targetNpcs = JSON.parse(t.targetNpcs || '[]') as string[];
  } catch { /* ignore */ }
  return {
    key: newKey(),
    id: t.id,
    label: t.label ?? '',
    description: t.description ?? '',
    kind,
    points: t.points ?? 1,
    category: t.category ?? '',
    optional: !!t.optional,
    trackedStat: t.trackedStat ?? '',
    statGoal: t.statGoal ?? '',
    requiredAmount: t.requiredAmount ?? '',
    items,
    targetNpcs,
    timedActivity: t.timedActivity ?? '',
    timeThresholdSeconds: t.timeThresholdSeconds ?? '',
  };
}

function blankDraft(label = ''): Draft {
  return {
    key: newKey(),
    label,
    description: '',
    kind: 'standard',
    points: 1,
    category: '',
    optional: false,
    trackedStat: '',
    statGoal: '',
    requiredAmount: '',
    items: [],
    targetNpcs: [],
    timedActivity: '',
    timeThresholdSeconds: '',
  };
}

function draftToRow(d: Draft): TileCsvRow {
  const base: TileCsvRow = {
    label: d.label.trim(),
    description: d.description.trim() || null,
    points: d.points,
    category: d.category.trim() || null,
    optional: d.optional,
  };
  const items = (): TileCsvItem[] => d.items.map((i) => ({ name: i.name, count: i.count, id: i.id }));
  switch (d.kind) {
    case 'skill':
      return { ...base, tileType: 'standard', trackedStat: d.trackedStat || null, statType: 'skill', statGoal: d.statGoal === '' ? null : d.statGoal };
    case 'boss':
      return { ...base, tileType: 'standard', trackedStat: d.trackedStat || null, statType: 'boss', statGoal: d.statGoal === '' ? null : d.statGoal };
    case 'drop':
      return { ...base, tileType: 'drop', requiredAmount: d.requiredAmount === '' ? null : d.requiredAmount, items: items() };
    case 'collection':
      return { ...base, tileType: 'drop', items: items() };
    case 'kill':
      return { ...base, tileType: 'kill', requiredAmount: d.requiredAmount === '' ? null : d.requiredAmount, targetNpcs: d.targetNpcs.length ? d.targetNpcs : null };
    case 'timed':
      return { ...base, tileType: 'timed', timedActivity: d.timedActivity.trim() || null, timeThresholdSeconds: d.timeThresholdSeconds === '' ? null : d.timeThresholdSeconds };
    default:
      return { ...base, tileType: 'standard' };
  }
}

export default function TileGridEditor({
  eventId,
  tiles,
  canAddRows,
  eventStarted,
  onSaved,
}: {
  eventId: number;
  tiles: Tile[];
  canAddRows: boolean;
  eventStarted: boolean;
  onSaved?: () => void;
}) {
  const initial = useMemo(
    () => [...tiles].sort((a, b) => a.position - b.position).map(tileToDraft),
    [tiles],
  );
  const [rows, setRows] = useState<Draft[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const baseCount = initial.length;

  function update(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function addRows(n: number) {
    setRows((prev) => [...prev, ...Array.from({ length: n }, () => blankDraft())]);
    setDirty(true);
  }

  async function removeRow(key: string) {
    const row = rows.find((r) => r.key === key);
    // Existing tiles must be deleted server-side — the import pipeline only updates/creates by
    // position, it never deletes. Unsaved new rows just drop locally.
    if (row?.id != null) {
      if (!confirm(`Delete tile "${row.label || 'Untitled'}" permanently?`)) return;
      try {
        const res = await fetch(`/api/events/${eventId}/tiles/${row.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMsg({ type: 'error', text: data.error || 'Could not delete tile.' });
          return;
        }
      } catch {
        setMsg({ type: 'error', text: 'Could not delete tile.' });
        return;
      }
      onSaved?.();
    }
    setRows((prev) => prev.filter((r) => r.key !== key));
    if (expanded === key) setExpanded(null);
  }

  function applyPaste() {
    const labels = pasteText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (labels.length) {
      setRows((prev) => [...prev, ...labels.map((l) => blankDraft(l))]);
      setDirty(true);
    }
    setPasteText('');
    setPasteOpen(false);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const rowsPayload = rows.map(draftToRow);
      const res = await fetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Save failed' });
        return;
      }
      const bits: string[] = [];
      if (data.applied) bits.push(`updated ${data.applied}`);
      if (data.created) bits.push(`added ${data.created}`);
      setMsg({ type: 'success', text: `Saved — ${bits.join(', ') || 'no changes'}${data.ignored ? ` · ${data.ignored} ignored` : ''}.` });
      setDirty(false);
      onSaved?.();
    } catch {
      setMsg({ type: 'error', text: 'Could not save the grid.' });
    } finally {
      setSaving(false);
    }
  }

  const cell = 'bg-brown-dark border border-card-border rounded px-2 py-1 text-xs text-foreground focus:border-gold/50 focus:outline-none';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {canAddRows && (
          <>
            <button onClick={() => addRows(1)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors">+ Row</button>
            <button onClick={() => addRows(10)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors">+ 10 rows</button>
            <button onClick={() => { setPasteOpen(true); setTimeout(() => pasteRef.current?.focus(), 50); }} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors">Paste labels…</button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-[11px] text-yellow-400">Unsaved changes</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green-light hover:bg-accent-green/30 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>

      {eventStarted && (
        <p className="text-[11px] text-text-muted">Event has started — label / type / items are locked server-side; points, category, optional and stat goals still save.</p>
      )}
      {msg && <p className={`text-xs ${msg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>{msg.text}</p>}

      {/* Grid */}
      <div className="overflow-x-auto border border-card-border rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brown-dark/60 text-text-muted">
              <th className="px-2 py-2 text-left font-medium w-10">#</th>
              <th className="px-2 py-2 text-left font-medium min-w-[180px]">Label</th>
              <th className="px-2 py-2 text-left font-medium w-32">Type</th>
              <th className="px-2 py-2 text-left font-medium w-16">Points</th>
              <th className="px-2 py-2 text-left font-medium w-32">Category</th>
              <th className="px-2 py-2 text-center font-medium w-14">Opt.</th>
              <th className="px-2 py-2 text-left font-medium min-w-[160px]">Config</th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isNew = i >= baseCount;
              const needsDetail = r.kind === 'drop' || r.kind === 'collection' || r.kind === 'kill';
              return (
                <>
                  <tr key={r.key} className="border-t border-card-border/60">
                    <td className="px-2 py-1 text-text-muted">{i + 1}{isNew && <span className="text-accent-green-light">*</span>}</td>
                    <td className="px-2 py-1"><input value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} className={`${cell} w-full`} placeholder={`Tile ${i + 1}`} /></td>
                    <td className="px-2 py-1">
                      <select value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as Kind })} className={`${cell} w-full`}>
                        {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><input type="number" value={r.points} onChange={(e) => update(r.key, { points: parseInt(e.target.value, 10) || 0 })} className={`${cell} w-full`} /></td>
                    <td className="px-2 py-1"><input value={r.category} onChange={(e) => update(r.key, { category: e.target.value })} className={`${cell} w-full`} placeholder="—" /></td>
                    <td className="px-2 py-1 text-center"><input type="checkbox" checked={r.optional} onChange={(e) => update(r.key, { optional: e.target.checked })} className="accent-gold" /></td>
                    <td className="px-2 py-1">{configCell(r, needsDetail, expanded, setExpanded, update, cell)}</td>
                    <td className="px-2 py-1 text-center"><button onClick={() => removeRow(r.key)} className="text-text-muted hover:text-red-400" title="Remove row">&times;</button></td>
                  </tr>
                  {expanded === r.key && needsDetail && (
                    <tr key={`${r.key}-detail`} className="bg-brown-dark/40">
                      <td />
                      <td colSpan={7} className="px-3 py-3">{detailEditor(r, update, cell)}</td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-text-muted">No tiles yet. {canAddRows ? 'Use “+ Row” or “Paste labels” to start.' : ''}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-muted">Rows marked <span className="text-accent-green-light">*</span> are new and will be created on save. Drop / collection / kill rows open a detail panel for item &amp; NPC autocomplete.</p>

      {/* Paste-labels modal */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setPasteOpen(false)}>
          <div className="w-full max-w-md bg-card-bg border border-card-border rounded-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground">Paste labels</h3>
            <p className="text-xs text-text-muted">One tile per line. Each becomes a new Standard tile you can configure after.</p>
            <textarea ref={pasteRef} value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-gold/50 focus:outline-none" placeholder={'Cluck Norris\nBeefcake\nRat King'} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPasteOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground">Cancel</button>
              <button onClick={applyPaste} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25">Add rows</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function configCell(
  r: Draft,
  needsDetail: boolean,
  expanded: string | null,
  setExpanded: (k: string | null) => void,
  update: (key: string, patch: Partial<Draft>) => void,
  cell: string,
) {
  if (r.kind === 'skill' || r.kind === 'boss') {
    const opts = r.kind === 'skill'
      ? SKILLS.map((s) => ({ value: s, label: SKILL_LABELS[s] ?? s }))
      : BOSSES.map((b) => ({ value: b.key, label: b.label }));
    return (
      <div className="flex items-center gap-1">
        <select value={r.trackedStat} onChange={(e) => update(r.key, { trackedStat: e.target.value })} className={`${cell} flex-1`}>
          <option value="">{r.kind === 'skill' ? 'skill…' : 'boss…'}</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" value={r.statGoal} onChange={(e) => update(r.key, { statGoal: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })} className={`${cell} w-20`} placeholder={r.kind === 'skill' ? 'XP' : 'KC'} />
      </div>
    );
  }
  if (r.kind === 'timed') {
    return (
      <div className="flex items-center gap-1">
        <input value={r.timedActivity} onChange={(e) => update(r.key, { timedActivity: e.target.value })} className={`${cell} flex-1`} placeholder="activity" />
        <input type="number" value={r.timeThresholdSeconds} onChange={(e) => update(r.key, { timeThresholdSeconds: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })} className={`${cell} w-20`} placeholder="sec" />
      </div>
    );
  }
  if (needsDetail) {
    const count = r.kind === 'kill' ? r.targetNpcs.length : r.items.length;
    const noun = r.kind === 'kill' ? 'NPC' : 'item';
    return (
      <button onClick={() => setExpanded(expanded === r.key ? null : r.key)} className="text-xs px-2 py-1 rounded border border-card-border text-text-muted hover:text-foreground hover:border-gold/40">
        {count > 0 ? `${count} ${noun}${count !== 1 ? 's' : ''}` : `add ${noun}s`} {expanded === r.key ? '▲' : '▾'}
      </button>
    );
  }
  return <span className="text-text-muted">—</span>;
}

function detailEditor(r: Draft, update: (key: string, patch: Partial<Draft>) => void, cell: string) {
  if (r.kind === 'kill') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {r.targetNpcs.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 text-xs bg-red-500/15 text-red-300 rounded px-2 py-0.5">
              {n}
              <button onClick={() => update(r.key, { targetNpcs: r.targetNpcs.filter((x) => x !== n) })} className="hover:text-red-100">&times;</button>
            </span>
          ))}
          {r.targetNpcs.length === 0 && <span className="text-xs text-text-muted">No NPCs yet.</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64"><NpcAutocomplete excludeNames={r.targetNpcs} onPick={(name) => update(r.key, { targetNpcs: [...r.targetNpcs, name] })} /></div>
          <label className="text-xs text-text-muted flex items-center gap-1">Kills needed
            <input type="number" value={r.requiredAmount} onChange={(e) => update(r.key, { requiredAmount: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })} className={`${cell} w-20`} />
          </label>
        </div>
      </div>
    );
  }
  // drop / collection
  const isPool = r.kind === 'drop';
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        {r.items.map((it, idx) => (
          <div key={`${it.id ?? it.name}-${idx}`} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs bg-accent-green/15 text-accent-green-light rounded px-2 py-0.5 flex-1">
              {it.name || `Item #${it.id}`}
              {it.id != null && <span className="text-[10px] text-text-muted">#{it.id}</span>}
            </span>
            {!isPool && (
              <input type="number" value={it.count} min={1} onChange={(e) => {
                const count = parseInt(e.target.value, 10) || 1;
                update(r.key, { items: r.items.map((x, j) => (j === idx ? { ...x, count } : x)) });
              }} className={`${cell} w-16`} title="Count needed" />
            )}
            <button onClick={() => update(r.key, { items: r.items.filter((_, j) => j !== idx) })} className="text-text-muted hover:text-red-400">&times;</button>
          </div>
        ))}
        {r.items.length === 0 && <span className="text-xs text-text-muted">No items yet.</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-72"><ItemAutocomplete excludeIds={r.items.map((i) => i.id).filter((x): x is number => x != null)} onPick={(it) => update(r.key, { items: [...r.items, { id: it.id, name: it.name, count: 1 }] })} /></div>
        {isPool && (
          <label className="text-xs text-text-muted flex items-center gap-1">Need any
            <input type="number" value={r.requiredAmount} onChange={(e) => update(r.key, { requiredAmount: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })} className={`${cell} w-16`} />
            of these
          </label>
        )}
      </div>
      <p className="text-[11px] text-text-muted">{isPool ? 'Pool: any of these items counts toward the “need any N” total.' : 'Collection: each item needs its own count; tile completes when all are met.'}</p>
    </div>
  );
}
