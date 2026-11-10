'use client';

import { useMemo, useState } from 'react';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import Radio from '@/components/Radio';
import { useUnsavedChanges } from '@/components/UnsavedChanges';
import { useDialog } from '@/components/Confirm';
import RaceRouteMap from '@/components/board/RaceRouteMap';
import { clanFetch } from '@/lib/clanFetch';
import { cn } from '@/lib/utils';
import { deriveTileIcon } from '@/lib/tileIcons';
import { isPlaceholderTile } from '@/lib/placeholderTile';
import {
  RACE_ROAD_MODES,
  ROUTE_TEMPLATES,
  applyRouteTemplate,
  insertStep,
  isBranchingRoute,
  moveTileToStep,
  removeStep,
  routeEntries,
  swapSteps,
  toggleRouteLink,
  validateRoute,
  type RaceRoadMode,
  type RouteEntry,
  type RouteTemplate,
} from '@/lib/raceRoutes';
import type { Tile } from '@/lib/types';

interface Props {
  eventId: number;
  tiles: Tile[];
  eventStarted: boolean;
  /** Admins may edit the route mid-race (with a decision when it invalidates progress). */
  isAdmin?: boolean;
  raceBank: boolean;
  raceRoad: RaceRoadMode;
  /** A tile was created straight into a step (already saved as a blank tile). */
  onTileCreated: (tile: Tile) => void;
  /** The route was saved: each tile's new step / links / position. */
  onSaved: (update: Map<number, { raceStep: number | null; raceNext: number[] | null; position?: number }>) => void;
  onRaceBankChanged: (on: boolean) => void;
  /** Open a tile in the tile panel (null closes it). */
  onOpenTile: (id: number | null) => void;
  /** The tile open in the tile panel, so the map follows it ("Add & another" moves it on). */
  openTileId?: number | null;
  /** The tile panel sits beside the map (a wide screen): picking a tile opens it there at once. */
  panelBeside?: boolean;
  /** Tiles the map removed were deleted on Save (the page drops them from its list). */
  onTilesDeleted?: (ids: number[]) => void;
}

const btn = 'text-xs font-medium px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const goldBtn = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * A tile race's Map view (lib/raceRoutes): the players' road map, editable. Click a tile to open it
 * in the tile panel and get its road actions (link to the next or previous step, add a road beside
 * it, move it to another step, delete it); click a road to remove it; the "+" between steps slots a
 * new tile in. Shapes (templates) lay every tile out in one click, and every edit is one Undo away.
 * Nothing about the roads is stored until Save, and Save refuses a route that can't be played.
 * Tiles themselves (new blank ones included) save at once, like anywhere else on the page.
 */
export default function RaceRouteEditor({ eventId, tiles, eventStarted, isAdmin = false, raceBank, raceRoad, onTileCreated, onSaved, onRaceBankChanged, onOpenTile, openTileId = null, panelBeside = false, onTilesDeleted }: Props) {
  const { confirm, notify } = useDialog();
  const board = useMemo(() => tiles.filter((t) => t.parentTileId == null && !t.mission).sort((a, b) => a.position - b.position), [tiles]);
  const stored = useMemo(() => routeEntries(board), [board]);
  const [entries, setEntries] = useState<RouteEntry[]>(stored);
  // Every change pushes the route before it, so any edit (a template included) is one Undo away.
  const [history, setHistory] = useState<{ entries: RouteEntry[]; removed: number[] }[]>([]);
  // Tiles "Remove" took off the map: deleted for real when the roads are saved, so Undo can bring
  // them back until then.
  const [removed, setRemoved] = useState<number[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(openTileId);
  // "Link to…": clicks on the neighbouring steps add or remove roads from the selected tile.
  const [linking, setLinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [bank, setBank] = useState(raceBank);
  const [road, setRoad] = useState(raceRoad);
  // Mid-race only an admin edits, and an edit that invalidates finishes asks what to do first.
  const locked = eventStarted && !isAdmin;
  const liveEdit = eventStarted && isAdmin;
  // New tiles can only be made before the start (the tiles API refuses them after).
  const canAdd = !eventStarted;
  const [decision, setDecision] = useState<null | { preview: Preview; body: Record<string, unknown> }>(null);
  const branching = isBranchingRoute(board);
  useUnsavedChanges(dirty);

  // The map follows the tile panel: "Add & another" there moves on to the next blank tile.
  const [prevOpen, setPrevOpen] = useState(openTileId);
  if (openTileId !== prevOpen) {
    setPrevOpen(openTileId);
    if (openTileId != null) setSelected(openTileId);
  }

  // Tiles added elsewhere (the list) join the editor as unplaced.
  const known = new Set(entries.map((e) => e.id));
  const missing = board.filter((t) => !known.has(t.id));
  const gone = entries.filter((e) => !board.some((t) => t.id === e.id)).map((e) => e.id);
  const live: RouteEntry[] =
    missing.length || gone.length
      ? [...entries.filter((e) => !gone.includes(e.id)).map((e) => ({ ...e, next: e.next.filter((n) => !gone.includes(n)) })), ...missing.map((t) => ({ id: t.id, step: null, next: [] }))]
      : entries;

  const tileOf = (id: number) => board.find((t) => t.id === id);
  // What the map shows and saves: everything but the tiles waiting to be deleted.
  const shown: RouteEntry[] = removed.length ? live.filter((e) => !removed.includes(e.id)).map((e) => ({ ...e, next: e.next.filter((n) => !removed.includes(n)) })) : live;
  const nameOf = (id: number) => tileOf(id)?.label ?? `Tile ${id}`;
  const labelOf = (id: number) => `“${nameOf(id)}”`;
  const problems = validateRoute(shown, labelOf);
  const problemIds = new Set(problems.map((p) => p.tileId).filter((id): id is number => id != null));
  const placed = shown.filter((e) => e.step != null);
  const unplaced = shown.filter((e) => e.step == null);
  const lastStep = placed.reduce((m, e) => Math.max(m, e.step!), -1);
  const stepCount = lastStep + 1;
  const sel = shown.find((e) => e.id === selected) ?? null;
  const linkable = new Set(
    linking && sel?.step != null ? placed.filter((e) => e.step === sel.step! + 1 || e.step === sel.step! - 1).map((e) => e.id) : [],
  );
  const pending = dirty || missing.length > 0 || gone.length > 0 || removed.length > 0;
  const starts = placed.filter((e) => e.step === 0).length;
  const finishes = placed.filter((e) => e.step === lastStep).length;
  const playableLine = `${stepCount} step${stepCount === 1 ? '' : 's'}, ${starts} start${starts === 1 ? '' : 's'}, ${finishes} finish${finishes === 1 ? '' : 'es'}`;

  function change(next: RouteEntry[], dropped = 0, what = '', nextRemoved = removed) {
    setHistory((h) => [...h.slice(-40), { entries: live, removed }]);
    setEntries(next);
    setRemoved(nextRemoved);
    setDirty(true);
    setWarning(dropped > 0 ? `${what} removed ${dropped} road${dropped === 1 ? '' : 's'} that no longer ran to the next step.` : null);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setEntries(prev.entries);
    setRemoved(prev.removed);
    setDirty(history.length > 1);
    setWarning(null);
  }

  function resetEdits(to: RouteEntry[]) {
    setEntries(to);
    setRemoved([]);
    setHistory([]);
    setDirty(false);
    setWarning(null);
  }

  function pick(id: number | null) {
    setLinking(false);
    setSelected(id);
    if (panelBeside) onOpenTile(id);
  }

  function clickTile(id: number) {
    if (locked) return onOpenTile(id);
    if (linking && selected != null) {
      if (id === selected) return setLinking(false);
      if (linkable.has(id)) return change(toggleRouteLink(shown, selected, id));
    }
    pick(id);
  }

  async function clickRoad(from: number, to: number) {
    if (locked) return;
    if (!(await confirm({ title: 'Remove this road?', body: `The road from ${labelOf(from)} to ${labelOf(to)} goes. Both tiles stay.`, confirmLabel: 'Remove road' }))) return;
    change(toggleRouteLink(shown, from, to));
  }

  function applyTemplate(key: RouteTemplate) {
    change(applyRouteTemplate(key, board.map((t) => t.id)));
    setLinking(false);
    const meta = ROUTE_TEMPLATES.find((t) => t.key === key)!;
    notify(`Laid out as “${meta.label}”. Undo puts the last layout back.`);
  }

  async function makeStraight() {
    if (!(await confirm({ title: 'Back to one straight road?', body: 'Every tile leads to the next one in list order, and this saves straight away. Tasks stay as they are.', confirmLabel: 'Make it straight' }))) return;
    setSaving(true);
    try {
      if (liveEdit && !(await decideIfNeeded({ straight: true }))) return;
      const res = await clanFetch(`/api/events/${eventId}/race-route`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ straight: true, policy: 'keep' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error || 'Could not save the roads.', 'error');
      const update = new Map(board.map((t) => [t.id, { raceStep: null, raceNext: null }]));
      onSaved(update);
      resetEdits(routeEntries(board.map((t) => ({ ...t, raceStep: null, raceNext: null }))));
      setLinking(false);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (problems.length) return;
    setSaving(true);
    try {
      // Tiles taken off the map go first, so the route saved below no longer names them.
      if (removed.length) {
        const deleted: number[] = [];
        for (const id of removed) {
          const res = await clanFetch(`/api/events/${eventId}/tiles/${id}`, { method: 'DELETE' });
          if (res.ok) deleted.push(id);
        }
        if (deleted.length) onTilesDeleted?.(deleted);
        if (deleted.length < removed.length) {
          setRemoved((r) => r.filter((id) => !deleted.includes(id)));
          return notify('Some tiles could not be deleted, so the roads were not saved. Try again.', 'error');
        }
      }
      const routeBody = { route: shown.map((e) => ({ id: e.id, step: e.step, next: e.next })) };
      if (liveEdit && !(await decideIfNeeded(routeBody))) return;
      const res = await clanFetch(`/api/events/${eventId}/race-route`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...routeBody, policy: 'keep' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error || 'Could not save the roads.', 'error');
      const order: number[] = data.order ?? [];
      const update = new Map(shown.map((e) => [e.id, { raceStep: e.step, raceNext: e.next, position: order.indexOf(e.id) }]));
      onSaved(update);
      resetEdits(shown);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Mid-race: ask the server what this edit does to progress already made. Nothing affected → go
   * ahead (true). Otherwise open the decision dialog, which saves with the chosen policy itself, and
   * stop here (false).
   */
  async function decideIfNeeded(body: Record<string, unknown>): Promise<boolean> {
    const res = await clanFetch(`/api/events/${eventId}/race-route`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, preview: true }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'Could not check the edit.', 'error');
      return false;
    }
    const preview = data.preview as Preview;
    if (!preview?.teams?.length) return true;
    setDecision({ preview, body });
    return false;
  }

  async function applyDecision(policy: 'keep' | 'rollback', discord: 'keep' | 'edit' | 'delete') {
    if (!decision) return;
    setSaving(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-route`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...decision.body, policy, discord }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error || 'Could not save the roads.', 'error');
      const order: number[] = data.order ?? [];
      const saved = decision.body.straight ? routeEntries(board.map((t) => ({ ...t, raceStep: null, raceNext: null }))) : shown;
      onSaved(new Map(saved.map((e) => [e.id, { raceStep: e.step, raceNext: e.next, position: order.indexOf(e.id) }])));
      resetEdits(saved);
      setDecision(null);
      notify(policy === 'rollback' ? `Roads saved. ${decision.preview.totalTiles} finish${decision.preview.totalTiles === 1 ? '' : 'es'} rolled back.` : 'Roads saved. Finishes already made were kept.');
    } finally {
      setSaving(false);
    }
  }

  /** A new blank tile (saved at once, like any added tile); its place on the map is a route edit. */
  async function newTile(): Promise<Tile | null> {
    setBusy(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'Could not add a tile.', 'error');
        return null;
      }
      onTileCreated(data as Tile);
      return data as Tile;
    } finally {
      setBusy(false);
    }
  }

  async function addTileToStep(step: number) {
    const t = await newTile();
    if (!t) return;
    change([...shown, { id: t.id, step, next: [] }]);
    pick(t.id);
  }

  /** "Remove": the tile leaves the map now and is deleted when the roads are saved (Undo brings it back). */
  function removeTile(id: number) {
    change(live, 0, '', [...removed, id]);
    pick(null);
  }

  /** "Split into 2 roads": a new tile on the same step with the same roads in and out. */
  async function addBeside(id: number) {
    const from = shown.find((e) => e.id === id);
    if (from?.step == null) return;
    const t = await newTile();
    if (!t) return;
    const next = shown.map((e) => (e.next.includes(id) ? { ...e, next: [...e.next, t.id] } : e));
    change([...next, { id: t.id, step: from.step, next: [...from.next] }]);
    pick(t.id);
  }

  /**
   * The "+" between two steps: a new step holding one new tile, with roads from every tile on the
   * step before and to every tile on the step after — on a straight road, simply a tile slotted in.
   */
  async function insertTileStep(at: number) {
    const before = placed.filter((e) => e.step === at - 1).map((e) => e.id);
    const after = placed.filter((e) => e.step === at).map((e) => e.id);
    const t = await newTile();
    if (!t) return;
    const shifted = insertStep(shown, at).map((e) => (before.includes(e.id) ? { ...e, next: [...e.next, t.id] } : e));
    change([...shifted, { id: t.id, step: at, next: after }]);
    pick(t.id);
  }

  async function changeRoad(next: RaceRoadMode) {
    if (next === road) return;
    const prev = road;
    setRoad(next);
    const res = await clanFetch(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { raceRoad: next } }) });
    if (!res.ok) {
      setRoad(prev);
      const data = await res.json().catch(() => ({}));
      return notify(data.error || 'Could not save that setting.', 'error');
    }
    onRaceBankChanged(bank);
  }

  async function toggleBank(on: boolean) {
    setBank(on);
    const res = await clanFetch(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { raceBank: on } }) });
    if (!res.ok) {
      setBank(!on);
      const data = await res.json().catch(() => ({}));
      return notify(data.error || 'Could not save that setting.', 'error');
    }
    onRaceBankChanged(on);
  }

  const stepOptions = Array.from({ length: stepCount + 1 }, (_, s) => ({ value: String(s), label: s === stepCount ? `New step ${s + 1} (at the end)` : `Step ${s + 1}${s === 0 ? ' · start' : s === lastStep ? ' · finish' : ''}` }));
  const nodes = placed.map((e) => {
    const t = tileOf(e.id);
    return { id: e.id, step: e.step!, next: e.next, label: nameOf(e.id), icon: t ? t.icon ?? deriveTileIcon(t) : null };
  });
  const blankIds = new Set(board.filter((t) => isPlaceholderTile(t)).map((t) => t.id));
  const blankCount = placed.filter((e) => blankIds.has(e.id)).length;
  const roadMeta = RACE_ROAD_MODES.find((m) => m.key === road);
  const templateIds = board.length ? board.map((t) => t.id) : Array.from({ length: 8 }, (_, i) => -1 - i);

  return (
    <div className="space-y-4 min-w-0">
      {/* Start from a shape: one click lays every tile out; Undo puts the last layout back. */}
      {!locked && (
        <div className="@container border border-card-border rounded-xl bg-card-bg p-3 sm:p-4 space-y-3">
          <div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />Roads</h3>
              <p className="text-xs text-text-muted mt-1 max-w-2xl">
                {branching || dirty
                  ? 'Teams run from the start to the finish along the roads. Where a road splits they take one side; where roads meet they can switch. Every road has the same number of steps.'
                  : 'Right now the race is one straight road. Pick a shape to split it into roads that fork and meet again, or edit the map below.'}
              </p>
            </div>
          </div>
          {/* Sized by the card's own width (a container query), not the window's: two short cards a
              row in a narrow column, four, then all seven in one row. */}
          <div className="grid grid-cols-2 @md:grid-cols-4 @4xl:grid-cols-7 gap-2" role="list" aria-label="Start from a shape">
            {ROUTE_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="listitem"
                onClick={() => applyTemplate(t.key)}
                title={t.help}
                className="group text-left rounded-lg border border-card-border bg-brown-dark/40 hover:border-gold/50 hover:bg-gold/[0.06] transition-colors p-1.5 @md:p-2"
              >
                <TemplateThumb entries={applyRouteTemplate(t.key, templateIds)} />
                <span className="block mt-1 @md:mt-1.5 text-xs font-semibold text-foreground group-hover:text-gold">{t.label}</span>
              </button>
            ))}
            {/* The way back, at the end of the shapes: clears the layout and saves at once. */}
            <button
              type="button"
              role="listitem"
              onClick={makeStraight}
              disabled={saving}
              title="Clears the layout and saves: every tile leads to the next"
              className="rounded-lg border border-dashed border-card-border text-xs text-text-muted hover:text-foreground hover:border-gold/40 transition-colors p-1.5 @md:p-2 min-h-12 disabled:opacity-40"
            >
              Back to one straight road
            </button>
          </div>
        </div>
      )}

      {locked && <p className="text-xs text-text-muted">The roads are locked once the race starts — only an admin can change them. Click a tile to open it.</p>}
      {liveEdit && (
        <p className="text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 px-3 py-2">
          The race is live. Changes apply as soon as you save, and are recorded in the tile history. If an edit undoes progress a team already made, you’ll choose what happens to it before anything is saved.
        </p>
      )}

      <div className="space-y-2">
        {/* The selected tile's road actions, pinned to the top of the map. */}
        {!locked && (
          // Sticky under the site nav, so a long (vertical) map keeps its actions in reach.
          <div className={cn('sticky top-[4.5rem] z-20 min-h-12 rounded-xl border px-3 py-2 flex flex-wrap items-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,.35)]', sel ? 'border-gold/40 bg-[#221c15]' : 'border-card-border bg-card-bg')}>
            {sel ? (
              linking ? (
                <>
                  <span className="text-xs text-foreground">
                    Roads from <span className="text-gold font-semibold">{nameOf(sel.id)}</span>: click a tile on the step before or after to add a road, or a linked one to remove it.
                  </span>
                  <button type="button" className={cn(goldBtn, 'ml-auto')} onClick={() => setLinking(false)}>Done</button>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-foreground truncate max-w-[16rem]" title={nameOf(sel.id)}>{nameOf(sel.id)}</span>
                  <span className="text-xs text-text-muted">{sel.step == null ? 'not on the map yet' : `step ${sel.step + 1}`}</span>
                  <span className="flex flex-wrap items-center gap-1.5 ml-auto">
                    {!panelBeside && <button type="button" className={goldBtn} onClick={() => onOpenTile(sel.id)}>Write the task</button>}
                    {sel.step != null && <button type="button" className={btn} onClick={() => setLinking(true)}>Link to…</button>}
                    {sel.step != null && canAdd && <button type="button" className={btn} disabled={busy} onClick={() => void addBeside(sel.id)} title="A new tile next to this one, with the same roads in and out">Split into 2 roads</button>}
                    <div className="w-44">
                      <Select
                        value={sel.step == null ? '' : String(sel.step)}
                        placeholder="Put it on a step…"
                        onChange={(v) => {
                          const r = moveTileToStep(shown, sel.id, Number(v));
                          change(r.entries, r.dropped, 'Moving it');
                        }}
                        options={stepOptions}
                        ariaLabel="Step for this tile"
                      />
                    </div>
                    {canAdd && <button type="button" className={cn(btn, 'hover:text-red-300 hover:border-red-500/40')} onClick={() => removeTile(sel.id)} title="Deletes the tile when you save the roads; Undo brings it back">Remove</button>}
                    <button type="button" className={btn} onClick={() => pick(null)} aria-label="Deselect the tile">✕</button>
                  </span>
                </>
              )
            ) : (
              <span className="text-xs text-text-muted">
                Click a tile to {panelBeside ? 'write its task beside the map' : 'write its task'} and change its roads. Click a road to remove it.{canAdd ? ' The + between steps adds a tile there.' : ''}
              </span>
            )}
          </div>
        )}

        <RaceRouteMap
          nodes={nodes}
          onTileClick={clickTile}
          selectedId={selected}
          linkable={linkable}
          problemIds={problemIds}
          blankIds={blankIds}
          mobileList={false}
          shrink
          onLinkClick={locked ? undefined : (from, to) => void clickRoad(from, to)}
          overlay={
            locked || !canAdd
              ? undefined
              : (g) =>
                  Array.from({ length: g.last + 2 }, (_, at) => {
                    // Between step at-1 and step at; before the start and after the finish too.
                    const x = at === 0 ? g.stepX(0) - 84 * g.scale : at > g.last ? g.stepX(g.last) + 84 * g.scale : (g.stepX(at - 1) + g.stepX(at)) / 2;
                    if (stepCount === 0 && at > 0) return null;
                    const what = at === 0 ? 'Add a tile before the start' : at > g.last ? 'Add a tile after the finish' : `Add a tile between step ${at} and step ${at + 1}`;
                    // Vertical map (a narrow box): a thin full-width row between the steps.
                    if (g.vertical)
                      return (
                        <button
                          key={`ins${at}`}
                          type="button"
                          disabled={busy}
                          onClick={() => void insertTileStep(at)}
                          title={what}
                          aria-label={what}
                          className="absolute z-10 -translate-y-1/2 h-7 rounded-md border border-dashed border-gold/30 bg-[#141010]/70 text-[11px] text-gold/80 hover:text-gold hover:border-gold/60 hover:bg-gold/10 transition-colors disabled:opacity-30"
                          style={{ left: g.rowLeft, width: g.width - g.rowLeft - 8, top: g.insertY(at) }}
                        >
                          + Add a step here
                        </button>
                      );
                    return (
                      <button
                        key={`ins${at}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void insertTileStep(at)}
                        title={what}
                        aria-label={what}
                        className="absolute z-10 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/40 bg-[#141010] text-gold text-sm leading-none grid place-items-center opacity-60 hover:opacity-100 hover:bg-gold/15 focus-visible:opacity-100 transition-opacity disabled:opacity-30"
                        style={{ left: Math.min(g.width - 14, Math.max(14, x)), top: g.headY }}
                      >
                        +
                      </button>
                    );
                  })
          }
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-full border-2 border-dashed border-text-muted/40" />Not written yet{blankCount ? ` (${blankCount})` : ''}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-full border-2 border-red-500" />Needs a fix before saving</span>
          <span>A long race runs top to bottom when the map hasn’t room to go across.</span>
        </div>
        {stepCount === 0 && canAdd && !locked && (
          <button type="button" className={goldBtn} disabled={busy} onClick={() => void addTileToStep(0)}>+ Add the first tile</button>
        )}
      </div>

      {!locked && unplaced.length > 0 && (
        <div className="border border-card-border rounded-xl bg-card-bg p-3">
          <p className="text-xs text-text-muted mb-2">Not on the map yet — click one, then pick its step above:</p>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((e) => (
              <button key={e.id} type="button" onClick={() => pick(e.id)} className={`text-xs px-2 py-1 rounded-md border ${selected === e.id ? 'border-gold text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}>
                {nameOf(e.id)}
              </button>
            ))}
          </div>
        </div>
      )}

      {warning && <p className="text-xs text-amber-400">{warning}</p>}

      {!locked && problems.length > 0 && (
        <div className="border border-red-500/30 rounded-xl bg-card-bg p-3 space-y-2">
          <p className="text-xs font-semibold text-red-400">Fix {problems.length === 1 ? 'this' : `these ${problems.length}`} before saving:</p>
          <ul className="space-y-1">
            {problems.slice(0, 12).map((p, i) => (
              <li key={i} className="text-xs text-text-muted">
                {p.tileId != null ? (
                  <button type="button" className="text-left hover:text-foreground" onClick={() => pick(p.tileId)}>• {p.message}</button>
                ) : (
                  <>• {p.message}</>
                )}
              </li>
            ))}
            {problems.length > 12 && <li className="text-xs text-text-muted">…and {problems.length - 12} more.</li>}
          </ul>
        </div>
      )}
      {!locked && !pending && problems.length === 0 && stepCount > 0 && <p className="text-xs text-green-400">The route is playable: {playableLine}.</p>}

      {/* How a team's road is set at a fork, and early finishes: saved the moment they change. */}
      <details className="group border border-card-border rounded-xl bg-card-bg">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="font-semibold">At a fork</span>
            <span className="text-text-muted"> · {roadMeta?.label ?? road}{bank ? ' · early finishes banked' : ''}</span>
          </span>
          <span className="text-text-muted transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <div role="radiogroup" aria-label="How a team's road is set at a fork" className="grid gap-2 sm:grid-cols-3">
            {RACE_ROAD_MODES.map((m) => (
              <Choice
                key={m.key}
                name="race-road"
                checked={road === m.key}
                disabled={eventStarted}
                onSelect={() => void changeRoad(m.key)}
                title={m.label}
                body={m.key === 'choose' ? `${m.help} The captain (or team staff; any member if the team has neither) picks; an admin can reset a pick.` : m.help}
              />
            ))}
          </div>
          {eventStarted && <p className="text-[11px] text-text-muted">This can’t change once the event has started.</p>}
          <Checkbox
            checked={bank}
            onChange={(on) => void toggleBank(on)}
            disabled={eventStarted}
            label="Bank early finishes"
            description="Off: only tiles open on a team's road count. On: a valid finish on a tile the team hasn't reached yet is kept, and the tile completes the moment their road reaches it — it never skips ahead or opens anything early."
          />
        </div>
      </details>

      {/* The old step-by-step controls, for moving whole steps around. */}
      {!locked && stepCount > 0 && (
        <details className="group border border-card-border rounded-xl bg-card-bg">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm"><span className="font-semibold">Steps, one by one</span><span className="text-text-muted"> · move or remove a whole step</span></span>
            <span className="text-text-muted transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          </summary>
          <div className="divide-y divide-card-border border-t border-card-border">
            {Array.from({ length: stepCount }, (_, s) => {
              const n = placed.filter((e) => e.step === s).length;
              return (
                <div key={s} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="text-xs font-semibold text-foreground w-24 shrink-0">Step {s + 1}{s === 0 ? ' · start' : s === lastStep ? ' · finish' : ''}</span>
                  <span className="text-[11px] text-text-muted w-14 shrink-0">{n} tile{n === 1 ? '' : 's'}</span>
                  <div className="flex flex-wrap gap-1.5 ml-auto">
                    <button type="button" className={btn} disabled={s === 0} onClick={() => { const r = swapSteps(shown, s, -1); change(r.entries, r.dropped, 'Moving the step'); }} aria-label={`Move step ${s + 1} earlier`}>◀</button>
                    <button type="button" className={btn} disabled={s === lastStep} onClick={() => { const r = swapSteps(shown, s, 1); change(r.entries, r.dropped, 'Moving the step'); }} aria-label={`Move step ${s + 1} later`}>▶</button>
                    <button type="button" className={btn} onClick={() => { const next = insertStep(shown, s); const lost = shown.reduce((a, e) => a + e.next.length, 0) - next.reduce((a, e) => a + e.next.length, 0); change(next, lost, 'Adding the step'); }}>+ Empty step before</button>
                    {canAdd && <button type="button" className={btn} disabled={busy} onClick={() => void addTileToStep(s)}>+ Tile on this step</button>}
                    <button type="button" className={btn} onClick={() => { const r = removeStep(shown, s); change(r.entries, r.dropped, 'Removing the step'); }}>Remove step</button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {decision && <LiveEditDecision preview={decision.preview} saving={saving} onCancel={() => setDecision(null)} onApply={applyDecision} />}

      {/* The save bar: pinned to the bottom of the window while there are unsaved road changes. */}
      {!locked && pending && (
        <div
          role="status"
          className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-card-bg-hover/95 py-3 pl-5 pr-3 shadow-[0_18px_44px_rgba(0,0,0,.55)] backdrop-blur"
        >
          <div className="min-w-0 text-sm">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold align-middle" aria-hidden />
            <span className="text-text-muted">Unsaved road changes{removed.length ? ` (${removed.length} tile${removed.length === 1 ? '' : 's'} to delete)` : ''} · </span>
            {problems.length > 0 ? (
              <span className="text-red-300">{problems.length} thing{problems.length === 1 ? '' : 's'} to fix first</span>
            ) : (
              <span className="text-green-400">playable: {playableLine}</span>
            )}
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button type="button" disabled={saving} onClick={undo} className="min-h-10 rounded-lg px-3 text-sm text-text-muted hover:text-foreground disabled:opacity-50">
                Undo
              </button>
            )}
            {dirty && (
              <button type="button" disabled={saving} onClick={() => { resetEdits(stored); setLinking(false); }} className="min-h-10 rounded-lg px-3 text-sm text-text-muted hover:text-foreground disabled:opacity-50">
                Discard
              </button>
            )}
            <button
              type="button"
              disabled={saving || problems.length > 0}
              onClick={save}
              className="min-h-10 rounded-lg bg-gold px-5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save roads'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A template's shape in miniature: its steps left to right, a dot per tile, a line per road. */
function TemplateThumb({ entries }: { entries: RouteEntry[] }) {
  const W = 120;
  const H = 44;
  const placedE = entries.filter((e) => e.step != null);
  const last = placedE.reduce((m, e) => Math.max(m, e.step!), 0);
  const cols: number[][] = Array.from({ length: last + 1 }, () => []);
  for (const e of placedE) cols[e.step!].push(e.id);
  const tall = Math.max(1, ...cols.map((c) => c.length));
  const pos = new Map<number, { x: number; y: number }>();
  cols.forEach((c, s) =>
    c.forEach((id, i) => pos.set(id, { x: 6 + (last ? (s * (W - 12)) / last : (W - 12) / 2), y: c.length === 1 ? H / 2 : 6 + (i * (H - 12)) / Math.max(1, tall - 1) })),
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-7 @md:h-11" aria-hidden>
      {placedE.flatMap((e) =>
        e.next.filter((to) => pos.has(to)).map((to) => {
          const a = pos.get(e.id)!;
          const b = pos.get(to)!;
          return <line key={`${e.id}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4a3d30" strokeWidth={2.5} strokeLinecap="round" />;
        }),
      )}
      {[...pos.entries()].map(([id, p]) => (
        <circle key={id} cx={p.x} cy={p.y} r={2.6} fill="#e0aa1e" />
      ))}
    </svg>
  );
}

type Preview = { teams: { teamId: number; teamName: string; tiles: { id: number; label: string; step: number }[] }[]; totalTiles: number };

/**
 * The decision a mid-race edit needs when it undoes progress: every affected team and tile across
 * the whole edit, then Keep (whoever got it, got it) or Roll back, and what to do in Discord.
 */
function LiveEditDecision({ preview, saving, onCancel, onApply }: { preview: Preview; saving: boolean; onCancel: () => void; onApply: (p: 'keep' | 'rollback', d: 'keep' | 'edit' | 'delete') => void }) {
  const [policy, setPolicy] = useState<'keep' | 'rollback'>('keep');
  const [discord, setDiscord] = useState<'keep' | 'edit' | 'delete'>('edit');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="live-edit-title">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-card-border bg-card-bg p-4 space-y-4">
        <div>
          <h3 id="live-edit-title" className="text-base font-bold flex items-center gap-2"><span className="w-1 h-5 bg-gold rounded-full" />This edit changes progress already made</h3>
          <p className="text-xs text-text-muted mt-1">
            {preview.totalTiles} finish{preview.totalTiles === 1 ? '' : 'es'} across {preview.teams.length} team{preview.teams.length === 1 ? '' : 's'} no longer follow the new route:
          </p>
        </div>
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {preview.teams.map((t) => (
            <li key={t.teamId} className="text-sm">
              <span className="font-semibold">{t.teamName}</span>
              <span className="block text-xs text-text-muted">{t.tiles.map((x) => `${x.label} (step ${x.step + 1})`).join(' · ')}</span>
            </li>
          ))}
        </ul>
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-text-muted mb-1">What happens to those finishes</legend>
          <Choice checked={policy === 'keep'} onSelect={() => setPolicy('keep')} title="Keep" body="Whoever got it, got it. The finishes stay and the new route applies from now on." />
          <Choice checked={policy === 'rollback'} onSelect={() => setPolicy('rollback')} title="Roll back" body="Remove these finishes (and anything after them on that team’s road). Scores and standings update, and the affected players are told on the site and in the plugin." />
        </fieldset>
        {policy === 'rollback' && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-text-muted mb-1">Their Discord posts</legend>
            <Choice checked={discord === 'keep'} onSelect={() => setDiscord('keep')} title="Leave them" body="The original “tile complete” posts stay as they are." />
            <Choice checked={discord === 'edit'} onSelect={() => setDiscord('edit')} title="Mark them as rolled back" body="Edits each post: the title struck through and “Rolled back by an admin” added; the picture stays." />
            <Choice checked={discord === 'delete'} onSelect={() => setDiscord('delete')} title="Delete them" body="Removes the posts from the channel." />
            <p className="text-[11px] text-text-muted">Posts sent before Anvil kept their message ids can’t be changed — those get a short “rolled back by an admin” correction post instead.</p>
          </fieldset>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btn} onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className={goldBtn} onClick={() => onApply(policy, discord)} disabled={saving}>{saving ? 'Saving…' : policy === 'rollback' ? 'Roll back and save' : 'Keep and save'}</button>
        </div>
      </div>
    </div>
  );
}

function Choice({ checked, onSelect, title, body, name, disabled = false }: { checked: boolean; onSelect: () => void; title: string; body: string; name?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${checked ? 'border-gold/60 bg-gold/10' : 'border-card-border'}`}>
      <Radio checked={checked} onChange={onSelect} name={name} disabled={disabled} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-text-muted">{body}</span>
      </span>
    </label>
  );
}
